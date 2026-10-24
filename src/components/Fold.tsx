import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
/** taller sections take a little longer, so the speed looks the same */
const duration = (px: number) => Math.round(Math.min(320, Math.max(160, 120 + px * 0.3)));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * A collapsible panel section (native <details>, so it works with the keyboard, screen readers and find-in-page).
 * Opening and closing slide the body open/closed (height + fade, Web Animations API, no package).
 * A click during the animation reverses it from where it is. With "reduce motion" switched on in the
 * operating system, sections open and close at once.
 */
export default function Fold({ title, hint, open = false, children }: { title: ReactNode; hint?: ReactNode; open?: boolean; children: ReactNode }) {
  // isOpen = the <details> open attribute; expanded = where it is heading (the +/− icon turns at once)
  const [isOpen, setOpen] = useState(open);
  const [expanded, setExpanded] = useState(open);
  const body = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);
  const closing = useRef(false);

  const run = (el: HTMLDivElement, from: number, to: number, done?: () => void) => {
    el.style.overflow = "hidden";
    const a = el.animate(
      [{ height: `${from}px`, opacity: from === 0 ? 0 : 1 }, { height: `${to}px`, opacity: to === 0 ? 0 : 1 }],
      // "forwards" keeps the last frame (height 0) until the section has really closed; without it the
      // full body showed again for one frame before disappearing (the flicker seen when closing)
      { duration: duration(Math.abs(to - from)), easing: EASE, fill: "forwards" },
    );
    anim.current = a;
    a.onfinish = () => {
      done?.();                 // closing: flushSync closes the <details> now, in this same frame
      a.cancel();               // then drop the held frame; the section is already closed or fully open
      el.style.overflow = "";
      if (anim.current === a) anim.current = null;
    };
    a.oncancel = () => { el.style.overflow = ""; };
  };

  const toggle = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const el = body.current;
    const wantOpen = !isOpen || closing.current;
    setExpanded(wantOpen);
    if (!el || reducedMotion()) {
      anim.current?.cancel();
      closing.current = false;
      setOpen(wantOpen);
      return;
    }
    const from = isOpen ? el.getBoundingClientRect().height : 0;
    anim.current?.cancel();
    if (wantOpen) {
      closing.current = false;
      if (!isOpen) flushSync(() => setOpen(true)); // the body must be on the page before it can be measured
      run(el, from, el.scrollHeight);
    } else {
      closing.current = true;
      run(el, from, 0, () => {
        closing.current = false;
        flushSync(() => setOpen(false));
      });
    }
  };

  return (
    <details
      className="fold"
      data-expanded={expanded ? "true" : "false"}
      open={isOpen}
      // also fires when the browser opens the section itself (e.g. find-in-page)
      onToggle={(e) => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        if (closing.current) return;
        setOpen(o);
        setExpanded(o);
      }}
    >
      <summary onClick={toggle}>
        <span>{title}</span>
        {hint != null && <span className="hint">{hint}</span>}
        <i className="fold-icon" aria-hidden="true" />
      </summary>
      <div ref={body} className="fold-anim">
        <div className="fold-body">{children}</div>
      </div>
    </details>
  );
}
