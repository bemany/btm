import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import {
  listApiTokens,
  createApiToken,
  revokeApiToken,
  type ApiTokenRow,
} from '../../data/apiTokens';

interface ApiTokensDrawerProps {
  onClose: () => void;
}

export function ApiTokensDrawer({ onClose }: ApiTokensDrawerProps) {
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
      showToast(err instanceof Error ? err.message : 'Token konnte nicht erstellt werden');
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    if (!window.confirm('Token wirklich widerrufen? MCP-Clients mit diesem Token können sich nicht mehr verbinden.'))
      return;
    await revokeApiToken(id);
    if (freshlyCreated?.row.id === id) setFreshlyCreated(null);
    await refresh();
    showToast('Token widerrufen');
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('In Zwischenablage kopiert');
    } catch {
      showToast('Kopieren fehlgeschlagen — manuell auswählen');
    }
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer wide">
        <div className="drawer-head">
          <div
            style={{
              width: 32,
              height: 32,
              background: 'var(--ink-900)',
              borderRadius: 6,
              color: 'var(--cream-50)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="key-round" size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <h3>API-Tokens</h3>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
              Personal Access Tokens · für MCP, CLI &amp; programmatic Access
            </div>
          </div>
          <button className="x" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Frisch erstelltes Token */}
          {freshlyCreated && (
            <div className="apit-fresh">
              <div className="apit-fresh-head">
                <Icon name="check-circle-2" size={14} style={{ color: 'var(--ok-500)' }} />
                <span>
                  „{freshlyCreated.row.name}" angelegt — kopier&#39;s dir jetzt, der Token wird nie wieder angezeigt:
                </span>
              </div>
              <div className="apit-fresh-row">
                <code className="apit-fresh-code">{freshlyCreated.plain}</code>
                <button className="tb-btn" onClick={() => copy(freshlyCreated.plain)}>
                  <Icon name="copy" size={12} /> Kopieren
                </button>
              </div>
              <div className="apit-fresh-foot">
                Schick&#39;s niemandem, leg ihn nicht in Repos ab. Bei Verlust einfach widerrufen + neu erstellen.
              </div>
            </div>
          )}

          {/* Erstellen */}
          <form onSubmit={onCreate} className="apit-form">
            <label>
              <div className="eyebrow">Neuer Token</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Claude (Desktop), CLI, MacBook"
                  className="apit-input"
                  disabled={creating}
                  required
                />
                <button type="submit" className="tb-btn accent" disabled={creating || !name.trim()}>
                  {creating ? (
                    <>
                      <Icon name="loader-2" size={12} className="login-spin" /> Erstelle …
                    </>
                  ) : (
                    <>
                      <Icon name="plus" size={12} /> Token erstellen
                    </>
                  )}
                </button>
              </div>
              <div className="hint">Tokens haben volle Lese- und Schreib-Rechte deines Accounts (Scope = read+write).</div>
            </label>
          </form>

          {/* Liste */}
          <div className="eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>
            Aktive Tokens · {tokens.length}
          </div>

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 12 }}>
              Lade …
            </div>
          ) : tokens.length === 0 ? (
            <div className="apit-empty">
              <Icon name="key-round" size={24} style={{ color: 'var(--ink-300)' }} />
              <div>Noch keine Tokens.</div>
            </div>
          ) : (
            <div className="apit-list">
              {tokens.map((t) => (
                <div key={t.id} className="apit-row">
                  <div className="apit-row-main">
                    <div className="apit-row-name">{t.name}</div>
                    <div className="apit-row-meta">
                      <code>{t.prefix}…</code>
                      <span>·</span>
                      <span>angelegt {new Date(t.createdAt).toLocaleDateString('de-DE')}</span>
                      {t.lastUsedAt ? (
                        <>
                          <span>·</span>
                          <span>
                            zuletzt benutzt{' '}
                            {new Date(t.lastUsedAt).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>·</span>
                          <span style={{ color: 'var(--ink-400)' }}>nie benutzt</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    className="apit-revoke"
                    onClick={() => onRevoke(t.id)}
                    title="Widerrufen"
                  >
                    <Icon name="trash-2" size={13} /> Widerrufen
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* MCP-Hinweis */}
          <div className="apit-mcp">
            <div className="apit-mcp-head">
              <Icon name="sparkles" size={14} style={{ color: 'var(--accent-500)' }} />
              <span>Mit Claude verbinden (MCP)</span>
            </div>
            <p>
              BTM stellt einen MCP-Server zur Verfügung, mit dem du in Claude Desktop oder Claude Code direkt
              Aufgaben anlegst, durchsuchst und abhakst. Du brauchst dafür einen Token von oben.
            </p>
            <p>
              Setup-Anleitung folgt hier — bis dahin lässt sich der Token bereits programmatisch nutzen:
            </p>
            <pre className="apit-mcp-code">{`curl https://btm.bethesna.org/api/me \\
  -H "Authorization: Bearer btm_<dein-token>"`}</pre>
          </div>
        </div>
      </div>
    </>
  );
}
