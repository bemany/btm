// Admin-Ansicht aller Feedback-Einträge (Bugs + Feature-Requests).
//
// Pro Eintrag:
//   • Type-Pill, Title, Status-Picker
//   • Body, Context (Pfad + Theme + User-Agent), Submitter, Timestamp
//   • „Prompt für Claude Code kopieren" — generiert einen kompletten
//     Briefing-Text, der direkt in Claude Code eingefügt werden kann
//   • „In Claude Code Cloud öffnen" — externer Link mit URL-Parameter
//
// Status-Workflow: open → in_progress → done | wontfix.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { FeedbackEntry, FeedbackStatus } from '../../data/api';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';

const FEEDBACK_KEY = ['btm', 'feedback'] as const;

const STATUS_OPTIONS: FeedbackStatus[] = ['open', 'in_progress', 'done', 'wontfix'];

export function FeedbackList() {
  const t = useT();
  const [locale] = useLocale();
  const users = useStore((s) => s.users);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'bug' | 'feature'>('all');

  const { data: items = [], isLoading } = useQuery({
    queryKey: FEEDBACK_KEY,
    queryFn: api.listFeedback,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: FEEDBACK_KEY });

  const setStatus = async (id: string, status: FeedbackStatus) => {
    try {
      await api.updateFeedback(id, { status });
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t('feedback.delete_confirm'))) return;
    try {
      await api.deleteFeedback(id);
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  const buildPrompt = (item: FeedbackEntry): string => {
    const submitter = users.find((u) => u.id === item.submitterId);
    const submitterName = submitter?.name ?? 'Unbekannt';
    const submitterEmail = submitter?.email ?? '—';
    const typeLabel = item.type === 'bug' ? 'Bug-Report' : 'Feature-Request';
    const verbDe = item.type === 'bug' ? 'behoben' : 'umgesetzt';
    const lines: string[] = [];
    lines.push(`# ${typeLabel} aus BTM`);
    lines.push('');
    lines.push(`**Feedback-ID:** \`${item.id}\``);
    lines.push(`**Typ:** ${item.type}`);
    lines.push(`**Titel:** ${item.title}`);
    lines.push(`**Eingereicht von:** ${submitterName} (\`${item.submitterId ?? '—'}\`, ${submitterEmail})`);
    lines.push(`**Datum:** ${new Date(item.createdAt).toLocaleString('de-DE')}`);
    if (item.contextPath) lines.push(`**War auf Seite:** \`${item.contextPath}\``);
    if (item.contextTheme) lines.push(`**Aktives Theme:** \`${item.contextTheme}\``);
    if (item.contextUserAgent) {
      const ua = item.contextUserAgent.length > 180 ? item.contextUserAgent.slice(0, 177) + '…' : item.contextUserAgent;
      lines.push(`**Browser:** ${ua}`);
    }
    lines.push('');
    lines.push('## Beschreibung');
    lines.push('');
    lines.push(item.body);
    lines.push('');
    lines.push('## Kontext zum BTM-Repo');
    lines.push('');
    lines.push('- Repo: https://github.com/bemany/btm (privat)');
    lines.push('- Lokal: ~/Documents/GitHub/btm');
    lines.push('- Frontend: Vite + React + TypeScript, Backend: Hono + Drizzle + Postgres');
    lines.push('- Live-URL: https://btm.bethesna.org');
    lines.push('- Setup-Doku: ~/Documents/GitHub/btm/CLAUDE.md');
    lines.push('');
    lines.push('## DB-Zugriff falls du nachschauen willst');
    lines.push('');
    lines.push('```bash');
    lines.push(`ssh -i ~/.ssh/id_ed25519 root@142.93.172.15 "docker exec -i btm-postgres psql -U btm -d btm" \\`);
    lines.push(`  -c "SELECT * FROM feedback WHERE id = '${item.id}';"`);
    lines.push('```');
    lines.push('');
    lines.push('## Aufgabe');
    lines.push('');
    lines.push(
      item.type === 'bug'
        ? 'Analysiere das Problem, finde die Ursache im Code, implementiere einen Fix, baue + deploye nach DO-VPS (siehe CLAUDE.md → Deploy-Workflow), pushe nach `main`.'
        : 'Schlage eine Implementierung vor und setze das Feature um. Baue + deploye nach DO-VPS, pushe nach `main`.',
    );
    lines.push('');
    lines.push('## Abschluss — Reporter benachrichtigen + Status setzen');
    lines.push('');
    lines.push(`Sobald die Änderung live ist, markiere das Feedback als erledigt — das schreibt:`);
    lines.push(`  1. \`feedback.status = 'done'\` (mit kurzer Resolution-Note in \`adminNote\`)`);
    lines.push(`  2. In-App-Notification an ${submitterName} (taucht in seiner/ihrer Inbox auf)`);
    lines.push(`  3. E-Mail an ${submitterEmail} mit Hinweis dass es ${verbDe} wurde`);
    lines.push('');
    lines.push(`Brauchst dafür einen Admin-API-Token (Einstellungen → API-Tokens, mit Scope \`write\`):`);
    lines.push('');
    lines.push('```bash');
    lines.push(`curl -X POST https://btm.bethesna.org/api/feedback/${item.id}/resolve \\`);
    lines.push(`  -H "Authorization: Bearer btm_DEIN_ADMIN_TOKEN" \\`);
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '{"resolutionNote": "Kurz erklären was du gemacht hast (1-2 Sätze) — landet als Notiz in der Inbox-Notification + Mail beim User."}'`);
    lines.push('```');
    lines.push('');
    lines.push(`Wenn du den Reporter nicht benachrichtigen willst (z.B. wontfix/duplikat), nutze stattdessen PATCH mit dem gewünschten Status:`);
    lines.push('');
    lines.push('```bash');
    lines.push(`curl -X PATCH https://btm.bethesna.org/api/feedback/${item.id} \\`);
    lines.push(`  -H "Authorization: Bearer btm_DEIN_ADMIN_TOKEN" \\`);
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '{"status": "wontfix", "adminNote": "Grund kurz erklären"}'`);
    lines.push('```');
    return lines.join('\n');
  };

  const copyPrompt = async (item: FeedbackEntry) => {
    const prompt = buildPrompt(item);
    try {
      await navigator.clipboard.writeText(prompt);
      showToast(t('feedback.prompt_copied'));
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  const openInClaudeCloud = (item: FeedbackEntry) => {
    const prompt = buildPrompt(item);
    // Claude.ai akzeptiert ?q= Query-Parameter im Web — kürzen falls zu lang
    const trimmed = prompt.length > 4000 ? prompt.slice(0, 3997) + '…' : prompt;
    const url = `https://claude.ai/new?q=${encodeURIComponent(trimmed)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fb-admin">
      <div className="fb-admin-head">
        <div className="fb-admin-filter">
          {(['all', 'bug', 'feature'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`fb-admin-filter-btn ${filter === f ? 'is-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {t(`feedback.filter_${f}` as 'feedback.filter_all')}
              {f !== 'all' && (
                <span className="fb-admin-filter-count">
                  {items.filter((i) => i.type === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {isLoading && filtered.length === 0 ? (
        <div className="fb-admin-empty">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="fb-admin-empty">{t('feedback.empty')}</div>
      ) : (
        <div className="fb-admin-list">
          {filtered.map((item) => {
            const submitter = users.find((u) => u.id === item.submitterId);
            return (
              <article key={item.id} className={`fb-admin-card status-${item.status}`}>
                <header className="fb-admin-card-head">
                  <span className={`fb-type-pill type-${item.type}`}>
                    <Icon name={item.type === 'bug' ? 'bug' : 'sparkles'} size={11} />
                    {t(`feedback.type_${item.type}` as 'feedback.type_bug')}
                  </span>
                  <h3 className="fb-admin-card-title">{item.title}</h3>
                  <select
                    className="fb-status-select"
                    value={item.status}
                    onChange={(e) => setStatus(item.id, e.target.value as FeedbackStatus)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {t(`feedback.status_${s}` as 'feedback.status_open')}
                      </option>
                    ))}
                  </select>
                </header>
                <p className="fb-admin-card-body">{item.body}</p>
                <div className="fb-admin-card-meta">
                  {submitter && (
                    <span>
                      <Icon name="user" size={10} /> {submitter.name}
                    </span>
                  )}
                  <span>
                    <Icon name="clock" size={10} />{' '}
                    {new Date(item.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {item.contextPath && (
                    <span className="fb-admin-card-meta-mono">
                      <Icon name="link-2" size={10} /> {item.contextPath}
                    </span>
                  )}
                </div>
                <div className="fb-admin-card-actions">
                  <button
                    type="button"
                    className="fb-action-btn"
                    onClick={() => copyPrompt(item)}
                  >
                    <Icon name="copy" size={11} /> {t('feedback.copy_prompt')}
                  </button>
                  <button
                    type="button"
                    className="fb-action-btn"
                    onClick={() => openInClaudeCloud(item)}
                  >
                    <Icon name="external-link" size={11} /> {t('feedback.open_in_claude')}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="fb-action-btn fb-action-danger"
                    onClick={() => remove(item.id)}
                    title={t('common.delete')}
                  >
                    <Icon name="trash-2" size={11} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
