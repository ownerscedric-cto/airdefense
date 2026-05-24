import type { MessageVars } from "../types";

const PLACEHOLDER_RE = /\{\{\s*([^}\s]+)\s*\}\}/g;

export function renderTemplate(body: string, vars: MessageVars): string {
  return body.replace(PLACEHOLDER_RE, (_, key: string) => {
    const v = (vars as unknown as Record<string, string>)[key];
    if (v && v.trim().length > 0) return v;
    return `[${key}]`;
  });
}

export interface RenderedSegment {
  text: string;
  missing: boolean;
}

export function renderSegments(body: string, vars: MessageVars): RenderedSegment[] {
  const out: RenderedSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(body)) !== null) {
    if (m.index > lastIndex) {
      out.push({ text: body.slice(lastIndex, m.index), missing: false });
    }
    const key = m[1];
    const v = (vars as unknown as Record<string, string>)[key];
    if (v && v.trim().length > 0) {
      out.push({ text: v, missing: false });
    } else {
      out.push({ text: `[${key}]`, missing: true });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) {
    out.push({ text: body.slice(lastIndex), missing: false });
  }
  return out;
}
