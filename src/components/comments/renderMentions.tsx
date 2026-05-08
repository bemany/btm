// Rendert Comment-Body. Mention-Tokens (`@[Name](id)`) werden in
// <span class="mention-pill">@<aktueller User-Name>|@<fallback>(deleted)</span>
// umgewandelt; Plain-Text dazwischen bleibt erhalten (mit \n → <br>).

import type { ReactNode } from 'react';
import type { AppUser } from '../../store/types';
import { useT } from '../../i18n';

const MENTION_RE = /@\[([^\]]+)\]\(([A-Za-z0-9_-]+)\)/g;

export interface RenderMentionsProps {
  body: string;
  users: AppUser[];
}

export function RenderMentions({ body, users }: RenderMentionsProps) {
  const t = useT();
  const userById = new Map(users.map((u) => [u.id, u]));
  const out: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;

  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    if (start > lastIdx) {
      out.push(...renderText(body.slice(lastIdx, start), () => key++));
    }
    const cachedName = m[1];
    const userId = m[2];
    const user = userById.get(userId);
    const display = user?.name ?? cachedName;
    out.push(
      <span
        key={`m-${key++}`}
        className={`mention-pill ${user ? '' : 'is-deleted'}`}
        title={user ? user.email : t('comments.mention_deleted_user')}
      >
        @{display}
      </span>,
    );
    lastIdx = start + m[0].length;
  }
  if (lastIdx < body.length) {
    out.push(...renderText(body.slice(lastIdx), () => key++));
  }
  return <>{out}</>;
}

function renderText(text: string, nextKey: () => number): ReactNode[] {
  // \n → <br>, alles andere als plain
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`br-${nextKey()}`} />);
    if (line) out.push(<span key={`t-${nextKey()}`}>{line}</span>);
  });
  return out;
}
