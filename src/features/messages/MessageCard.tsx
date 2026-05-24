import { Fragment } from "react";
import { useToast } from "../../components/Toast";
import { copyText } from "../../lib/clipboard";
import { renderSegments, renderTemplate } from "../../lib/template";
import type { MessageTemplate } from "../../data/seed";
import type { MessageVars } from "../../types";

interface Props {
  msg: MessageTemplate;
  vars: MessageVars;
}

export function MessageCard({ msg, vars }: Props) {
  const { show } = useToast();
  const segments = renderSegments(msg.body, vars);

  async function onCopy() {
    const text = renderTemplate(msg.body, vars);
    const ok = await copyText(text);
    show(ok ? "복사됨" : "복사 실패");
  }

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold tabular-nums text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
            {msg.no}
          </span>
          <h3 className="truncate text-sm font-semibold">{msg.title}</h3>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          복사
        </button>
      </header>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
        {segments.map((seg, i) =>
          seg.missing ? (
            <span
              key={i}
              className="rounded bg-red-100 px-1 font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              {seg.text}
            </span>
          ) : (
            <Fragment key={i}>{seg.text}</Fragment>
          )
        )}
      </p>
    </article>
  );
}
