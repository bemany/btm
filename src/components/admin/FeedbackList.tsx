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
import type { FeedbackEntry, FeedbackStatus, FeedbackType } from '../../data/api';
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
  // Status-Filter: Default 'active' = offen + in Arbeit. 'done' und
  // 'wontfix' sind damit per Default ausgeblendet — wer alte erledigte
  // sehen will, wechselt auf 'done' / 'wontfix' / 'all'.
  type StatusFilterValue = 'active' | 'all' | 'open' | 'in_progress' | 'done' | 'wontfix';
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('active');
  // Edit-Mode pro Item — null = keine Bearbeitung läuft.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; body: string; type: FeedbackType }>({
    title: '',
    body: '',
    type: 'bug',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  // Multi-Select für Sammel-Prompt (FwQQWBHfTid). Set von Feedback-IDs.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const { data: items = [], isLoading } = useQuery({
    queryKey: FEEDBACK_KEY,
    queryFn: api.listFeedback,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Counts pro Status-Wert für die Dropdown-Labels.
  const statusCounts = useMemo(() => {
    const base = filter === 'all' ? items : items.filter((i) => i.type === filter);
    return {
      total: base.length,
      active: base.filter((i) => i.status === 'open' || i.status === 'in_progress').length,
      open: base.filter((i) => i.status === 'open').length,
      in_progress: base.filter((i) => i.status === 'in_progress').length,
      done: base.filter((i) => i.status === 'done').length,
      wontfix: base.filter((i) => i.status === 'wontfix').length,
    };
  }, [items, filter]);

  const filtered = useMemo(() => {
    // Erst nach Typ filtern, dann nach Status
    let list = filter === 'all' ? items : items.filter((i) => i.type === filter);
    if (statusFilter === 'active') {
      list = list.filter((i) => i.status === 'open' || i.status === 'in_progress');
    } else if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    return list;
  }, [items, filter, statusFilter]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: FEEDBACK_KEY });

  const setStatus = async (id: string, status: FeedbackStatus) => {
    try {
      await api.updateFeedback(id, { status });
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  const startEdit = (item: FeedbackEntry) => {
    setEditingId(item.id);
    setEditForm({ title: item.title, body: item.body, type: item.type });
  };
  const cancelEdit = () => {
    setEditingId(null);
  };
  const saveEdit = async (id: string) => {
    if (savingEdit) return;
    if (!editForm.title.trim() || !editForm.body.trim()) {
      showToast(t('feedback.edit_required'));
      return;
    }
    setSavingEdit(true);
    try {
      await api.updateFeedback(id, {
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        type: editForm.type,
      });
      setEditingId(null);
      refresh();
      showToast(t('feedback.edit_saved'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setSavingEdit(false);
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
    lines.push('- Repo: https://github.com/bemany/btm');
    lines.push('- Frontend: Vite + React + TypeScript, Backend: Hono + Drizzle + Postgres');
    lines.push(`- Live-URL: ${window.location.origin}`);
    lines.push('- Setup-Doku: CLAUDE.md im Repo-Root');
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
    lines.push(`curl -X POST ${window.location.origin}/api/feedback/${item.id}/resolve \\`);
    lines.push(`  -H "Authorization: Bearer btm_DEIN_ADMIN_TOKEN" \\`);
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '{"resolutionNote": "Kurz erklären was du gemacht hast (1-2 Sätze) — landet als Notiz in der Inbox-Notification + Mail beim User."}'`);
    lines.push('```');
    lines.push('');
    lines.push(`Wenn du den Reporter nicht benachrichtigen willst (z.B. wontfix/duplikat), nutze stattdessen PATCH mit dem gewünschten Status:`);
    lines.push('');
    lines.push('```bash');
    lines.push(`curl -X PATCH ${window.location.origin}/api/feedback/${item.id} \\`);
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

  // Sammel-Prompt für mehrere Feedbacks — gemeinsamer Repo-Kontext-Header,
  // dann pro Feedback ein Block, am Ende einmalig die Resolve-Curl-Templates.
  // Reihenfolge: gleiche Sort wie in der Liste (neueste zuerst aus der API,
  // im UI in `filtered` durchgereicht).
  const buildBatchPrompt = (items: FeedbackEntry[]): string => {
    const lines: string[] = [];
    const n = items.length;
    const bugs = items.filter((i) => i.type === 'bug').length;
    const features = items.filter((i) => i.type === 'feature').length;
    lines.push(`# ${n} Feedbacks aus BTM — Sammelbearbeitung`);
    lines.push('');
    lines.push(`**Mix:** ${bugs} Bug-Report${bugs === 1 ? '' : 's'} + ${features} Feature-Request${features === 1 ? '' : 's'}`);
    lines.push('');
    lines.push('## Kontext zum BTM-Repo');
    lines.push('');
    lines.push('- Repo: https://github.com/bemany/btm');
    lines.push('- Frontend: Vite + React + TypeScript, Backend: Hono + Drizzle + Postgres');
    lines.push(`- Live-URL: ${window.location.origin}`);
    lines.push('- Setup-Doku: CLAUDE.md im Repo-Root');
    lines.push('');
    lines.push('## Aufgabe (für alle unten gelisteten Feedbacks)');
    lines.push('');
    lines.push('Arbeite die Feedbacks der Reihe nach durch. Verwandte Items (z.B. mehrere CSS-Bugs am gleichen Screen) dürfen in einem Commit zusammengefasst werden, müssen aber einzeln resolved werden damit jeder Submitter eine Inbox- + Mail-Benachrichtigung bekommt.');
    lines.push('');
    lines.push('Pro Feedback:');
    lines.push('1. Code implementieren');
    lines.push('2. `npm run build` + Deploy nach DO-VPS (siehe CLAUDE.md → Deploy-Workflow)');
    lines.push('3. Feedback per `POST /api/feedback/{id}/resolve` als done markieren — mit kurzer Resolution-Note (1–2 Sätze) was du gemacht hast');
    lines.push('4. `git push origin main`');
    lines.push('');
    items.forEach((item, idx) => {
      const submitter = users.find((u) => u.id === item.submitterId);
      const submitterName = submitter?.name ?? 'Unbekannt';
      const submitterEmail = submitter?.email ?? '—';
      lines.push('---');
      lines.push('');
      lines.push(`## ${idx + 1}/${n} · ${item.type === 'bug' ? '🐛 Bug' : '✨ Feature'} · \`${item.id}\``);
      lines.push('');
      lines.push(`**Titel:** ${item.title}`);
      lines.push(`**Status:** ${item.status}`);
      lines.push(`**Eingereicht von:** ${submitterName} (${submitterEmail})`);
      lines.push(`**Datum:** ${new Date(item.createdAt).toLocaleString('de-DE')}`);
      if (item.contextPath) lines.push(`**War auf Seite:** \`${item.contextPath}\``);
      if (item.contextTheme) lines.push(`**Aktives Theme:** \`${item.contextTheme}\``);
      lines.push('');
      lines.push('### Beschreibung');
      lines.push('');
      lines.push(item.body);
      lines.push('');
    });
    lines.push('---');
    lines.push('');
    lines.push('## Resolve-Template (pro Feedback)');
    lines.push('');
    lines.push('```bash');
    lines.push(`curl -X POST ${window.location.origin}/api/feedback/<ID>/resolve \\`);
    lines.push('  -H "Authorization: Bearer btm_DEIN_ADMIN_TOKEN" \\');
    lines.push('  -H "Content-Type: application/json" \\');
    lines.push('  -d \'{"resolutionNote": "..."}\'');
    lines.push('```');
    lines.push('');
    lines.push('Wontfix-Variante (kein Mail/Notification an Submitter):');
    lines.push('');
    lines.push('```bash');
    lines.push(`curl -X PATCH ${window.location.origin}/api/feedback/<ID> \\`);
    lines.push('  -H "Authorization: Bearer btm_DEIN_ADMIN_TOKEN" \\');
    lines.push('  -H "Content-Type: application/json" \\');
    lines.push('  -d \'{"status": "wontfix", "adminNote": "..."}\'');
    lines.push('```');
    return lines.join('\n');
  };

  const copyBatchPrompt = async () => {
    const items = filtered.filter((i) => selectedIds.has(i.id));
    if (items.length === 0) return;
    try {
      await navigator.clipboard.writeText(buildBatchPrompt(items));
      showToast(t('feedback.batch_prompt_copied', { count: items.length }));
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  // „Alle sichtbaren auswählen" — beachtet die aktuellen Filter (Type/Status).
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));
  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      // Nur die sichtbaren abwählen (andere ggf. selektierte erhalten bleiben).
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const i of filtered) next.delete(i.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const i of filtered) next.add(i.id);
        return next;
      });
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
        <div className="fb-admin-status-filter">
          <label className="fb-admin-status-label" htmlFor="fb-status-filter-select">
            {t('feedback.status_filter_label')}
          </label>
          <select
            id="fb-status-filter-select"
            className="fb-admin-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
          >
            <option value="active">
              {t('feedback.status_filter_active')} ({statusCounts.active})
            </option>
            <option value="open">
              {t('feedback.status_open')} ({statusCounts.open})
            </option>
            <option value="in_progress">
              {t('feedback.status_in_progress')} ({statusCounts.in_progress})
            </option>
            <option value="done">
              {t('feedback.status_done')} ({statusCounts.done})
            </option>
            <option value="wontfix">
              {t('feedback.status_wontfix')} ({statusCounts.wontfix})
            </option>
            <option value="all">
              {t('feedback.status_filter_all')} ({statusCounts.total})
            </option>
          </select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="fb-admin-bulkbar" role="region" aria-label={t('feedback.bulk_label')}>
          <label className="fb-admin-bulkbar-toggle">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allVisibleSelected && selectedIds.size > 0;
              }}
              onChange={toggleAllVisible}
              aria-label={t('feedback.bulk_select_all_visible')}
            />
            <span>
              {t('feedback.bulk_selected', { count: selectedIds.size })}
            </span>
          </label>
          <div style={{ flex: 1 }} />
          <button type="button" className="fb-action-btn" onClick={clearSelection}>
            <Icon name="x" size={11} /> {t('feedback.bulk_clear')}
          </button>
          <button
            type="button"
            className="fb-action-btn fb-action-primary"
            onClick={copyBatchPrompt}
          >
            <Icon name="copy" size={11} /> {t('feedback.bulk_copy_prompt')}
          </button>
        </div>
      )}

      {isLoading && filtered.length === 0 ? (
        <div className="fb-admin-empty">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="fb-admin-empty">{t('feedback.empty')}</div>
      ) : (
        <div className="fb-admin-list">
          {filtered.map((item) => {
            const submitter = users.find((u) => u.id === item.submitterId);
            return (
              <article
                key={item.id}
                className={`fb-admin-card status-${item.status} ${editingId === item.id ? 'is-editing' : ''} ${selectedIds.has(item.id) ? 'is-selected' : ''}`}
              >
                <header className="fb-admin-card-head">
                  {editingId !== item.id && (
                    <input
                      type="checkbox"
                      className="fb-admin-card-checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={t('feedback.bulk_select_one', { title: item.title })}
                      title={t('feedback.bulk_select_one', { title: item.title })}
                    />
                  )}
                  {editingId === item.id ? (
                    <select
                      className="fb-type-select"
                      value={editForm.type}
                      onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as FeedbackType }))}
                      disabled={savingEdit}
                    >
                      <option value="bug">{t('feedback.type_bug')}</option>
                      <option value="feature">{t('feedback.type_feature')}</option>
                    </select>
                  ) : (
                    <span className={`fb-type-pill type-${item.type}`}>
                      <Icon name={item.type === 'bug' ? 'bug' : 'sparkles'} size={11} />
                      {t(`feedback.type_${item.type}` as 'feedback.type_bug')}
                    </span>
                  )}
                  {editingId === item.id ? (
                    <input
                      type="text"
                      className="fb-edit-title"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      disabled={savingEdit}
                      maxLength={200}
                      placeholder={t('feedback.edit_title_placeholder')}
                    />
                  ) : (
                    <h3 className="fb-admin-card-title">{item.title}</h3>
                  )}
                  <select
                    className="fb-status-select"
                    value={item.status}
                    onChange={(e) => setStatus(item.id, e.target.value as FeedbackStatus)}
                    disabled={editingId === item.id}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {t(`feedback.status_${s}` as 'feedback.status_open')}
                      </option>
                    ))}
                  </select>
                </header>
                {editingId === item.id ? (
                  <textarea
                    className="fb-edit-body"
                    value={editForm.body}
                    onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                    disabled={savingEdit}
                    rows={5}
                    maxLength={20_000}
                    placeholder={t('feedback.edit_body_placeholder')}
                  />
                ) : (
                  <p className="fb-admin-card-body">{item.body}</p>
                )}
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
                  {editingId === item.id ? (
                    <>
                      <button
                        type="button"
                        className="fb-action-btn fb-action-primary"
                        onClick={() => saveEdit(item.id)}
                        disabled={savingEdit}
                      >
                        <Icon name="check" size={11} /> {t('feedback.edit_save')}
                      </button>
                      <button
                        type="button"
                        className="fb-action-btn"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                      >
                        <Icon name="x" size={11} /> {t('feedback.edit_cancel')}
                      </button>
                      <div style={{ flex: 1 }} />
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="fb-action-btn"
                        onClick={() => startEdit(item)}
                        title={t('feedback.edit_btn')}
                      >
                        <Icon name="pencil" size={11} /> {t('feedback.edit_btn')}
                      </button>
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
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
