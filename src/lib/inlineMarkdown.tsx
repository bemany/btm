// Mini-Inline-Markdown-Renderer für Release-Notes-Texte.
//
// Unterstützt:
//   **bold**     → <strong>
//   `code`       → <code>
//
// Bewusst minimal: keine Links, keine Listen, keine Headlines — die Texte
// in releases.ts sind kurze Sätze, mehr wäre over-engineered. Sicher gegen
// HTML-Injection: wir parsen den String token-weise und geben React-Knoten
// zurück, kein dangerouslySetInnerHTML.

import type { ReactNode } from 'react';

// Pattern erfasst entweder **bold** oder `code` als zwei capture-groups.
// Greedy auf bold: matched alles bis zum nächsten `**`.
const TOKEN_RE = /\*\*([^*]+?)\*\*|`([^`]+?)`/g;

export function renderInlineMarkdown(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      out.push(text.slice(lastIndex, start));
    }
    if (match[1] !== undefined) {
      out.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      out.push(<code key={key++}>{match[2]}</code>);
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }
  return out;
}
