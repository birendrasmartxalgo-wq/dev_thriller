import { useToasts } from "@/store/toast";

export function ToastRegion() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toast-region" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.kind === "error" ? " err" : ""}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
