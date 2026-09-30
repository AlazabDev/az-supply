import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id.server";
import { getDaftraSnapshot } from "@/lib/ai/daftra-context.server";

const MODEL = "openai/gpt-6-astra";

function systemPrompt(snapshot: string) {
  return `أنت مساعد مالي لمدير الحسابات في شركة العزب، تجيب باللغة العربية فقط اعتمادًا على سجلات نظام دفترة المرفقة أدناه (بصيغة JSON).
القواعد:
- استند فقط إلى البيانات المرفقة. إن لم تكفِ البيانات للإجابة فقل ذلك بوضوح ولا تخمّن.
- اذكر الأرقام الدقيقة (المبالغ مع العملة، الأعداد، التواريخ) واحسب المجاميع بعناية.
- اذكر السجلات ذات الصلة بأرقامها، واجعل كل سجل رابطًا: الفاتورة [فاتورة رقم X](/invoices/ID)، الطلب [طلب X](/orders/ID). مشتريات الموردين اذكر رقمها واسم المورد.
- حالة الفاتورة: مسودة إن draft؛ مدفوعة إن paid ≥ total؛ متأخرة إن unpaid > 0 وتاريخ due قبل today؛ مدفوعة جزئيًا إن paid > 0؛ وإلا غير مدفوعة.
- استخدم جداول Markdown عند عرض أكثر من 3 سجلات، واختم بملخص قصير.
البيانات:
${snapshot}`;
}

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!url || !anon || !apiKey) return json(500, "الخدمة غير مهيأة");

        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json(401, "يجب تسجيل الدخول");
        const supabase = createClient<Database>(url, anon, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (authErr || !userId) return json(401, "يجب تسجيل الدخول");

        let body: { messages?: UIMessage[]; threadId?: string };
        try {
          body = await request.json();
        } catch {
          return json(400, "طلب غير صالح");
        }
        const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        const threadId = String(body.threadId ?? "");
        if (!messages.length || !/^[0-9a-f-]{36}$/i.test(threadId)) return json(400, "طلب غير صالح");

        const { data: thread } = await supabase
          .from("ai_threads")
          .select("id,title")
          .eq("id", threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return json(404, "المحادثة غير موجودة");

        let snapshot: string;
        try {
          snapshot = await getDaftraSnapshot();
        } catch (e) {
          console.error("Daftra snapshot failed", e instanceof Error ? e.message : e);
          return json(502, "تعذر جلب البيانات من دفترة، حاول لاحقًا");
        }

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: provider.responses(MODEL),
          system: systemPrompt(snapshot),
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
          maxRetries: 0,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          sendReasoning: true,
          onError: (err) => {
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 429) return "تم تجاوز حد الطلبات، حاول بعد قليل.";
            if (status === 402) return "نفد رصيد الذكاء الاصطناعي في مساحة العمل.";
            if (status === 403) return "تم رفض الطلب من مزود النموذج.";
            return "حدث خطأ أثناء توليد الإجابة.";
          },
          onFinish: async ({ messages: all }) => {
            const rows = all.map((m) => ({
              thread_id: threadId,
              user_id: userId,
              message_id: m.id,
              role: m.role,
              parts: m.parts as unknown as Database["public"]["Tables"]["ai_messages"]["Insert"]["parts"],
            }));
            const { error } = await supabase.from("ai_messages").upsert(rows, { onConflict: "thread_id,message_id" });
            if (error) console.error("Saving messages failed", error.message);
            const firstUser = all.find((m) => m.role === "user");
            const firstText = firstUser?.parts.find((p) => p.type === "text");
            const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
            if (thread.title === "محادثة جديدة" && firstText && "text" in firstText) {
              patch.title = firstText.text.slice(0, 60);
            }
            const { error: tErr } = await supabase.from("ai_threads").update(patch).eq("id", threadId);
            if (tErr) console.error("Updating thread failed", tErr.message);
          },
        });
        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
