"use client";
import { Fragment, type ReactNode } from "react";

/** Minimal and safe Markdown rendering (no raw HTML): headings, lists, bold, italic, links, [N1] citations. */
export function Markdown({ text, refs }: { text: string; refs?: Record<string, { url: string | null; title: string }> }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(<Tag key={out.length}>{list.items.map((it, i) => <li key={i}>{inline(it, refs)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    const ul = l.match(/^\s*[-*•]\s+(.*)/), ol = l.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    flush();
    if (!l.trim()) continue;
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) { out.push(h[1].length <= 2 ? <h2 key={out.length}>{inline(h[2], refs)}</h2> : <h3 key={out.length}>{inline(h[2], refs)}</h3>); continue; }
    out.push(<p key={out.length}>{inline(l, refs)}</p>);
  }
  flush();
  return <div className="prose-mp">{out}</div>;
}

function inline(s: string, refs?: Record<string, { url: string | null; title: string }>): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[NEQ]\d*(?:[,;\s]+[NEQ]\d*)*\]|\[[^\]]+\]\(https?:\/\/[^)]+\)|`[^`]+`)/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > last) parts.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={parts.length}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={parts.length}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("*")) parts.push(<em key={parts.length}>{t.slice(1, -1)}</em>);
    else if (/^\[[NEQ]/.test(t) && !t.includes("](")) {
      const ids = t.slice(1, -1).split(/[,;\s]+/).filter(Boolean);
      parts.push(
        <sup key={parts.length} className="mx-0.5">
          {ids.map((id, i) => {
            const r = refs?.[id];
            return (
              <Fragment key={id}>
                {i > 0 && ","}
                {r?.url ? <a href={r.url} target="_blank" rel="noreferrer" title={r.title} className="text-info no-underline">{id}</a> : <span className="text-dim" title={r?.title}>{id}</span>}
              </Fragment>
            );
          })}
        </sup>,
      );
    } else {
      const lm = t.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      parts.push(lm ? <a key={parts.length} href={lm[2]} target="_blank" rel="noreferrer">{lm[1]}</a> : t);
    }
    last = m.index! + t.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
