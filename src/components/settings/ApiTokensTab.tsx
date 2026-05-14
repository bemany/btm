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

// Setup-Prompt für Claude (Feature FTTMD2R8-LH). Wird in die Zwischenablage
// kopiert und vom User in Claude Desktop eingefügt. Claude liest die
// Anweisungen, schreibt die Config selbst (Filesystem-MCP), bittet um
// Neustart und ruft danach me + list_week auf — User sieht direkt seine
// geplanten Aufgaben. Token wird inline eingebettet, sonst muss der User
// hinterher noch suchen + tauschen → reibungsärmster Pfad.
function buildSetupPrompt(token: string, locale: 'de' | 'en'): string {
  const tokenLine = token || (locale === 'en' ? '<YOUR-BTM-TOKEN>' : '<DEIN-BTM-TOKEN>');
  if (locale === 'en') {
    return `Hey Claude, please help me connect BTM (my internal task tool) so you can manage my tasks, projects and timers.

**Step 1 — Update the Claude Desktop config**

The file lives at:
- macOS: \`~/Library/Application Support/Claude/claude_desktop_config.json\`
- Windows: \`%APPDATA%\\Claude\\claude_desktop_config.json\`
- Linux: \`~/.config/Claude/claude_desktop_config.json\`

If the file does not exist yet, create it. If it exists, **only add the \`btm\` entry inside \`mcpServers\`** — don't overwrite other servers.

\`\`\`json
{
  "mcpServers": {
    "btm": {
      "url": "https://btm.bethesna.org/api/mcp",
      "headers": {
        "Authorization": "Bearer ${tokenLine}"
      }
    }
  }
}
\`\`\`

If you don't have filesystem access, show me the exact file path + JSON and I'll paste it myself.

**Step 2 — Ask me to restart**

Tell me: "Please quit Claude Desktop (menu Claude → Quit) and open it again."

**Step 3 — After the restart**

Once you see the \`btm\` tools in your toolset:
1. Call \`me\` and greet me by my first name.
2. Call \`list_week\` and show me my planned tasks for this week as a short list — one line per task with project · title · planned hours.

Let's go.`;
  }
  return `Hey Claude, hilf mir bitte BTM (mein internes Task-Tool) mit dir zu verbinden, damit du meine Aufgaben, Projekte und Timer verwalten kannst.

**Schritt 1 — Claude-Desktop-Konfig aktualisieren**

Die Datei liegt hier:
- macOS: \`~/Library/Application Support/Claude/claude_desktop_config.json\`
- Windows: \`%APPDATA%\\Claude\\claude_desktop_config.json\`
- Linux: \`~/.config/Claude/claude_desktop_config.json\`

Falls die Datei noch nicht existiert: leg sie an. Falls schon vorhanden: **füge nur den \`btm\`-Eintrag im \`mcpServers\`-Block hinzu** — überschreib keine anderen Server.

\`\`\`json
{
  "mcpServers": {
    "btm": {
      "url": "https://btm.bethesna.org/api/mcp",
      "headers": {
        "Authorization": "Bearer ${tokenLine}"
      }
    }
  }
}
\`\`\`

Wenn du keinen Filesystem-Zugriff hast, zeig mir den exakten Pfad + JSON und ich pflege ihn selber ein.

**Schritt 2 — Bitte mich um Neustart**

Sag mir: „Bitte beende Claude Desktop einmal (Menü Claude → Quit) und öffne es wieder."

**Schritt 3 — Nach dem Neustart**

Sobald du die \`btm\`-Tools im Toolset siehst:
1. Ruf \`me\` auf und begrüß mich mit Vornamen.
2. Ruf \`list_week\` auf und zeig mir meine geplanten Aufgaben dieser Woche als kurze Liste — eine Zeile pro Task mit Projekt · Titel · geplante Stunden.

Los geht's.`;
}

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

  // Wir greifen für den Wizard-Button auf das Klartext-Token zurück. Vorrang
  // hat ein gerade frisch erstellter Token (UI-State), sonst der erste in
  // der Liste, der einen `tokenPlain` hat (interner Trade-off — wir
  // speichern Klartext, siehe Schema-Kommentar).
  const fallbackPlain = tokens.find((t) => !!t.tokenPlain)?.tokenPlain ?? '';
  const promptToken = freshlyCreated?.plain ?? fallbackPlain ?? '';

  const copyPrompt = async (tokenOverride?: string) => {
    const prompt = buildSetupPrompt(tokenOverride ?? promptToken, locale);
    try {
      await navigator.clipboard.writeText(prompt);
      showToast(t('api_tokens.wizard_prompt_copied'));
    } catch {
      showToast(t('api_tokens.copy_failed_toast'));
    }
  };

  const hasFreshToken = !!freshlyCreated;
  const hasAnyPlainToken = !!promptToken;
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="set-pane">
      <p className="set-intro">{t('api_tokens.drawer_sub')}</p>

      {/* ── Claude-Setup-Wizard ───────────────────────────────────────── */}
      <div className="apit-wizard">
        <div className="apit-wizard-head">
          <Icon name="sparkles" size={16} style={{ color: 'var(--accent-500)' }} />
          <h4>{t('api_tokens.wizard_title')}</h4>
        </div>
        <p className="apit-wizard-sub">{t('api_tokens.wizard_sub')}</p>

        <ol className="apit-wizard-steps">
          <li className={hasAnyPlainToken ? 'is-done' : ''}>
            <div className="apit-wizard-step-num">{hasAnyPlainToken ? '✓' : '1'}</div>
            <div className="apit-wizard-step-text">
              <div className="apit-wizard-step-title">
                {hasAnyPlainToken ? t('api_tokens.wizard_step1_done') : t('api_tokens.wizard_step1')}
              </div>
              <div className="apit-wizard-step-body">{t('api_tokens.wizard_step1_body')}</div>
            </div>
          </li>
          <li>
            <div className="apit-wizard-step-num">2</div>
            <div className="apit-wizard-step-text">
              <div className="apit-wizard-step-title">{t('api_tokens.wizard_step2')}</div>
              <div className="apit-wizard-step-body">
                {hasAnyPlainToken
                  ? t('api_tokens.wizard_step2_body')
                  : t('api_tokens.wizard_step2_btn_placeholder_hint')}
              </div>
              <button
                type="button"
                className={`tb-btn ${hasAnyPlainToken ? 'accent' : ''} apit-wizard-cta`}
                onClick={() => copyPrompt()}
              >
                <Icon name="copy" size={12} />
                {hasAnyPlainToken
                  ? t('api_tokens.wizard_step2_btn')
                  : t('api_tokens.wizard_step2_btn_placeholder')}
              </button>
            </div>
          </li>
          <li>
            <div className="apit-wizard-step-num">3</div>
            <div className="apit-wizard-step-text">
              <div className="apit-wizard-step-title">{t('api_tokens.wizard_step3')}</div>
              <div className="apit-wizard-step-body">{t('api_tokens.wizard_step3_body')}</div>
            </div>
          </li>
        </ol>
      </div>

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
          {tokens.map((tok) => {
            const revealed = revealedIds.has(tok.id);
            const hasPlain = !!tok.tokenPlain;
            return (
              <div key={tok.id} className="apit-row">
                <div className="apit-row-main">
                  <div className="apit-row-name">{tok.name}</div>
                  <div className="apit-row-meta">
                    {hasPlain && revealed ? (
                      <code className="apit-row-plain">{tok.tokenPlain}</code>
                    ) : (
                      <code>{tok.prefix}…</code>
                    )}
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
                  {!hasPlain && (
                    <div className="apit-row-legacy-hint">{t('api_tokens.plain_unavailable')}</div>
                  )}
                </div>
                <div className="apit-row-actions">
                  {hasPlain && (
                    <>
                      <button
                        type="button"
                        className="apit-row-iconbtn"
                        onClick={() => toggleReveal(tok.id)}
                        title={revealed ? t('api_tokens.hide_token') : t('api_tokens.show_token')}
                        aria-label={revealed ? t('api_tokens.hide_token') : t('api_tokens.show_token')}
                      >
                        <Icon name={revealed ? 'eye-off' : 'eye'} size={13} />
                      </button>
                      <button
                        type="button"
                        className="apit-row-iconbtn"
                        onClick={() => copy(tok.tokenPlain!)}
                        title={t('api_tokens.copy')}
                        aria-label={t('api_tokens.copy')}
                      >
                        <Icon name="copy" size={13} />
                      </button>
                      <button
                        type="button"
                        className="apit-row-iconbtn"
                        onClick={() => copyPrompt(tok.tokenPlain!)}
                        title={t('api_tokens.copy_prompt_for_token')}
                        aria-label={t('api_tokens.copy_prompt_for_token')}
                      >
                        <Icon name="sparkles" size={13} />
                      </button>
                    </>
                  )}
                  <button className="apit-revoke" onClick={() => onRevoke(tok.id)} title={t('api_tokens.revoke')}>
                    <Icon name="trash-2" size={13} /> {t('api_tokens.revoke')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <details className="apit-mcp">
        <summary className="apit-mcp-head">
          <Icon name="settings-2" size={14} style={{ color: 'var(--ink-500)' }} />
          <span>{t('api_tokens.wizard_advanced')}</span>
          <Icon name="chevron-down" size={13} style={{ marginLeft: 'auto' }} />
        </summary>
        <div className="apit-mcp-body">
          <div className="apit-mcp-step-label">A · Claude Desktop (manuell)</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-700)' }}>
            Datei <code>claude_desktop_config.json</code> ergänzen:
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

          <div className="apit-mcp-step-label">C · Verfügbare Tools (14)</div>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--ink-700)' }}>
            <code>me</code> · <code>list_tasks</code> · <code>create_task</code> · <code>update_task</code> ·{' '}
            <code>move_task</code> · <code>delete_task</code> · <code>list_projects</code> ·{' '}
            <code>create_project</code> · <code>list_users</code> · <code>start_timer</code> ·{' '}
            <code>stop_timer</code> · <code>get_live_timer</code> · <code>list_week</code> ·{' '}
            <code>list_activity</code>
          </p>

          <div className="apit-mcp-step-label">D · Quick-Test (curl)</div>
          <pre className="apit-mcp-code">{`curl "https://btm.bethesna.org/api/mcp?token=<dein-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</pre>
        </div>
      </details>
    </div>
  );
}
