// Mention-Token-Format im Comment-Body: `@[Display Name](userId)`.
// Sichtbar wie ein Markdown-Link, robust gegen Rename (nur die ID zählt
// fürs Auflösen, der Name dient als Cache + Fallback wenn der User
// gelöscht wurde) und kopierbar/inspizierbar in jedem Plain-Text-Tool.

const MENTION_RE = /@\[([^\]]+)\]\(([A-Za-z0-9_-]+)\)/g;

/** Eindeutige User-IDs, die in einem Body erwähnt werden. */
export function extractMentionedUserIds(body: string): string[] {
  const ids = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) ids.add(m[2]);
  return [...ids];
}

/**
 * Rendert Tokens als plain `@<Name>` für die Notification-Excerpt.
 * Truncate auf max Zeichen mit Ellipsis. Tokens werden so verkürzt, dass
 * keine kaputten halben Tokens im Excerpt landen.
 */
export function renderForExcerpt(body: string, max = 140): string {
  const plain = body.replace(MENTION_RE, (_full, name) => `@${name}`);
  return plain.length > max ? plain.slice(0, max - 1) + '…' : plain;
}
