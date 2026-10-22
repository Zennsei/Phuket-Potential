import { useState, type ReactNode } from "react";

/** A collapsible panel section (native <details>, so it works with the keyboard and screen readers). */
export default function Fold({ title, hint, open = false, children }: { title: ReactNode; hint?: ReactNode; open?: boolean; children: ReactNode }) {
  const [isOpen, setOpen] = useState(open);
  return (
    <details className="fold" open={isOpen} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span>{title}</span>
        {hint != null && <span className="hint">{hint}</span>}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}
