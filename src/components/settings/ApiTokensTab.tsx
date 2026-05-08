import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import {
  listApiTokens,
  createApiToken,
  revokeApiToken,
  type ApiTokenRow,
} from '../../data/apiTokens';
import { useT, useLocale } from '../../i18n';

export function ApiTokensTab() {
  const t = useT();
  const [locale] = useLocale();
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('Claude (Desktop)');
  const [creating, setCreating] = useState(false);
  const [freshlyCreated, setFreshlyCreated] = useState<{ plain: string; row: ApiTokenRow } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setTokens(await listApiTokens());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { token, plain } = await createApiToken({ name: name.trim() });
      setFreshlyCreated({ plain, row: token });
      setName('Claude (Desktop)');
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('api_tokens.create_failed'));
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    if (!window.confirm(t('api_tokens.revoke_confirm'))) return;
    await revokeApiToken(id);
    if (freshlyCreated?.row.id === id) setFreshlyCreated(null);
    await refresh();
    showToast(t('api_tokens.revoke_toast'));
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('api_tokens.copied_toast'));
    } catch {
      showToast(t('api_tokens.copy_failed_toast'));
    }
  };

  return (
    <div className="set-pane">
      <p className="set-intro">{t('api_tokens.drawer_sub')}</p>

      {freshlyCreated && (
        <div className="apit-fresh">
          <div className="apit-fresh-head">
            <Icon name="check-circle-2" size={14} style={{ color: 'var(--ok-500)' }} />
            <span>{t('api_tokens.fresh_lead', { name: freshlyCreated.row.name })}</span>
          </div>
          <div className="apit-fresh-row">
            <code className="apit-fresh-code">{freshlyCreated.plain}</code>
            <button className="tb-btn" onClick={() => copy(freshlyCreated.plain)}>
              <Icon name="copy" size={12} /> {t('api_tokens.copy')}
            </button>
          </div>
          <div className="apit-fresh-foot">{t('api_tokens.fresh_foot')}</div>
        </div>
      )}

      <form onSubmit={onCreate} className="apit-form">
        <label>
          <div className="eyebrow">{t('api_tokens.new_token')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('api_tokens.token_name_placeholder')}
              className="apit-input"
              disabled={creating}
              required
            />
            <button type="submit" className="tb-btn accent" disabled={creating || !name.trim()}>
              {creating ? (
                <>
                  <Icon name="loader-2" size={12} className="login-spin" /> {t('api_tokens.creating')}
                </>
              ) : (
                <>
                  <Icon name="plus" size={12} /> {t('api_tokens.create')}
                </>
              )}
            </button>
          </div>
          <div className="hint">{t('api_tokens.create_hint')}</div>
        </label>
      </form>

      <div className="eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>
        {t('api_tokens.active_count', { count: tokens.length })}
      </div>

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 12 }}>
          {t('api_tokens.loading')}
        </div>
      ) : tokens.length === 0 ? (
        <div className="apit-empty">
          <Icon name="key-round" size={24} style={{ color: 'var(--ink-300)' }} />
          <div>{t('api_tokens.empty')}</div>
        </div>
      ) : (
        <div className="apit-list">
          {tokens.map((tok) => (
            <div key={tok.id} className="apit-row">
              <div className="apit-row-main">
                <div className="apit-row-name">{tok.name}</div>
                <div className="apit-row-meta">
                  <code>{tok.prefix}…</code>
                  <span>·</span>
                  <span>
                    {t('api_tokens.created_label', {
                      date: new Date(tok.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE'),
                    })}
                  </span>
                  {tok.lastUsedAt ? (
                    <>
                      <span>·</span>
                      <span>
                        {t('api_tokens.last_used_label', {
                          when: new Date(tok.lastUsedAt).toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>·</span>
                      <span style={{ color: 'var(--ink-400)' }}>{t('api_tokens.never_used')}</span>
                    </>
                  )}
                </div>
              </div>
              <button className="apit-revoke" onClick={() => onRevoke(tok.id)} title={t('api_tokens.revoke')}>
                <Icon name="trash-2" size={13} /> {t('api_tokens.revoke')}
              </button>
            </div>
          ))}
        </div>
      )}

      <details className="apit-mcp">
        <summary className="apit-mcp-head">
          <Icon name="sparkles" size={14} style={{ color: 'var(--accent-500)' }} />
          <span>Mit Claude verbinden (MCP)</span>
          <Icon name="chevron-down" size={13} style={{ marginLeft: 'auto' }} />
        </summary>
        <div className="apit-mcp-body">
          <p>
            BTM hat einen eingebauten MCP-Server. Damit kannst du in Claude Desktop oder Claude Web direkt
            Aufgaben anlegen, planen und abhaken — per natürlicher Sprache.
          </p>

          <div className="apit-mcp-step-label">A · Claude Desktop (empfohlen)</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-700)' }}>
            Verlässlichster Weg. Datei <code>claude_desktop_config.json</code> ergänzen:
          </p>
          <pre className="apit-mcp-code">{`{
  "mcpServers": {
    "btm": {
      "url": "https://btm.bethesna.org/api/mcp",
      "headers": {
        "Authorization": "Bearer <dein-token-oben>"
      }
    }
  }
}`}</pre>
          <p style={{ fontSize: 11.5, color: 'var(--ink-500)', margin: '6px 0 14px' }}>
            Pfad auf macOS: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> ·{' '}
            Windows: <code>%APPDATA%\Claude\claude_desktop_config.json</code>. Danach Claude Desktop neu starten.
          </p>

          <div className="apit-mcp-step-label">B · Claude Web (claude.ai) — eingeschränkt</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-700)' }}>
            In Claude → Settings → <b>Connectors</b> → <b>Add custom connector</b>:
          </p>
          <pre className="apit-mcp-code">{`Name              BTM
Remote MCP URL    https://btm.bethesna.org/api/mcp?token=<dein-token-oben>`}</pre>
          <p style={{ fontSize: 11.5, color: 'var(--ink-500)', margin: '6px 0 14px', lineHeight: 1.5 }}>
            ⚠️ Claude.ai-Connectors haben aktuell einen bekannten Anthropic-Broker-Bug
            (Issues{' '}
            <a href="https://github.com/anthropics/claude-ai-mcp/issues/143" target="_blank" rel="noopener noreferrer">
              #143
            </a>
            ,{' '}
            <a href="https://github.com/anthropics/claude-ai-mcp/issues/214" target="_blank" rel="noopener noreferrer">
              #214
            </a>
            ): auch spec-konforme Server zeigen oft „Couldn't reach the MCP server". Falls's bei dir passt — super;
            sonst nimm Desktop. Der Token gehört in die URL, weil Claude.ai keinen Header-Slot bietet — behandel die
            URL wie ein Passwort.
          </p>

          <div className="apit-mcp-step-label">C · Beispiel-Prompts</div>
          <ul style={{ margin: '4px 0 14px 18px', padding: 0, fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.6 }}>
            <li>„Was hab ich diese Woche offen?"</li>
            <li>„Leg eine Aufgabe an: Lighthouse-Audit fertigmachen, Projekt P1, 1.5h."</li>
            <li>„Schieb meine erste In-Arbeit-Task auf Erledigt."</li>
            <li>„Starte den Timer für die og:image-Task."</li>
          </ul>

          <div className="apit-mcp-step-label">D · Verfügbare Tools (14)</div>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--ink-700)' }}>
            <code>me</code> · <code>list_tasks</code> · <code>create_task</code> · <code>update_task</code> ·{' '}
            <code>move_task</code> · <code>delete_task</code> · <code>list_projects</code> ·{' '}
            <code>create_project</code> · <code>list_users</code> · <code>start_timer</code> ·{' '}
            <code>stop_timer</code> · <code>get_live_timer</code> · <code>list_week</code> ·{' '}
            <code>list_activity</code>
          </p>

          <div className="apit-mcp-step-label">E · Quick-Test</div>
          <pre className="apit-mcp-code">{`curl "https://btm.bethesna.org/api/mcp?token=<dein-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</pre>
        </div>
      </details>
    </div>
  );
}
