import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ct/AppShell";
import { AssistantMark, ThreadList, useCreateThread } from "@/components/assistant/ThreadList";

export const Route = createFileRoute("/_authenticated/assistant/")({
  head: () => ({
    meta: [
      { title: "المساعد المالي — أسئلة دفترة" },
      { name: "description", content: "اسأل بالعربية عن الطلبات والفواتير ومشتريات الموردين واحصل على إجابة من سجلات دفترة." },
      { property: "og:title", content: "المساعد المالي — أسئلة دفترة" },
      { property: "og:description", content: "إجابات مدعومة بسجلات دفترة الفعلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantHome,
});

function AssistantHome() {
  const { create, busy } = useCreateThread();
  return (
    <AppShell>
      <div dir="rtl" className="grid gap-2 lg:grid-cols-[260px_1fr]">
        <ThreadList />
        <section className="panel flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <AssistantMark className="size-14" />
          <h2 className="text-lg font-semibold">المساعد المالي</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            اسأل بالعربية عن الطلبات والفواتير ومشتريات الموردين، وسيجيبك المساعد بالأرقام والسجلات من دفترة.
          </p>
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            ابدأ سؤالًا جديدًا
          </button>
        </section>
      </div>
    </AppShell>
  );
}
