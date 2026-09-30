import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/ct/AppShell";
import { AssistantMark, ThreadList } from "@/components/assistant/ThreadList";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("ai_messages")
      .select("message_id,role,parts")
      .eq("thread_id", params.threadId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.message_id, role: r.role, parts: r.parts }) as unknown as UIMessage);
  },
  head: () => ({
    meta: [
      { title: "محادثة — المساعد المالي" },
      { name: "description", content: "محادثة مع المساعد المالي حول سجلات دفترة." },
      { property: "og:title", content: "محادثة — المساعد المالي" },
      { property: "og:description", content: "إجابات من سجلات دفترة الفعلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThreadPage,
});

const SUGGESTIONS = [
  "ما إجمالي الفواتير المتأخرة ومن أكبر العملاء المدينين؟",
  "كم حصّلنا هذا الشهر مقارنة بالشهر الماضي؟",
  "ما الطلبات المتأخرة عن موعد التسليم؟",
  "ما إجمالي مشترياتنا من كل مورد؟",
];

function ThreadPage() {
  const { threadId } = Route.useParams();
  const initial = Route.useLoaderData();
  return (
    <AppShell>
      <div dir="rtl" className="grid gap-2 lg:grid-cols-[260px_1fr]">
        <ThreadList activeId={threadId} />
        <ChatWindow key={threadId} threadId={threadId} initial={initial} />
      </div>
    </AppShell>
  );
}

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant",
        body: { threadId },
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const t = data.session?.access_token;
          return t ? { Authorization: `Bearer ${t}` } : {};
        },
      }),
    [threadId],
  );
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => {
      let msg = e.message;
      try {
        msg = JSON.parse(e.message).error ?? msg;
      } catch {
        /* plain text */
      }
      setError(msg || "تعذر الاتصال، تحقق من الشبكة");
    },
    onFinish: () => qc.invalidateQueries({ queryKey: ["ai-threads"] }),
  });
  const busy = status === "submitted" || status === "streaming";

  function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    sendMessage({ text: q });
  }

  return (
    <section className="panel flex h-[calc(100vh-190px)] min-h-[480px] flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AssistantMark className="size-12" />
              <p className="text-sm text-muted-foreground">اسأل عن الطلبات أو الفواتير أو مشتريات الموردين</p>
              <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-[var(--radius-sm)] border border-border px-3 py-2 text-start text-xs"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent
                className={m.role === "user" ? "!bg-primary !text-primary-foreground" : undefined}
              >
                {m.parts.map((p, i) => {
                  if (p.type === "text")
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{p.text}</MessageResponse>
                    ) : (
                      <p key={i} className="whitespace-pre-wrap">{p.text}</p>
                    );
                  if (p.type === "reasoning" && p.text && m.role === "assistant")
                    return (
                      <details key={i} className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">طريقة التفكير</summary>
                        <p className="mt-1 whitespace-pre-wrap">{p.text}</p>
                      </details>
                    );
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer>جارٍ مراجعة سجلات دفترة…</Shimmer>}
          {error && (
            <p className="rounded-[var(--radius-sm)] border px-3 py-2 text-sm" style={{ color: "var(--critical)", borderColor: "var(--critical)" }}>
              {error}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-border p-2">
        <PromptInput onSubmit={(msg: PromptInputMessage) => send(msg.text)}>
          <PromptInputTextarea autoFocus placeholder="اكتب سؤالك عن الطلبات أو الفواتير أو المشتريات…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}
