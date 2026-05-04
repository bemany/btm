// Office-Display: Admin generiert einen TV-Token + bekommt die URL zum Aufkleben
// auf einen Office-Bildschirm. Nutzt das bestehende API-Token-System mit
// einem Naming-Schema "TV: <Bezeichnung>" damit man sie auf einen Blick erkennt.

import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import {
  listApiTokens,
  createApiToken,
  revokeApiToken,
  type ApiTokenRow,
} from '../../data/apiTokens';

interface Props {
  onClose: () => void;
}

const TV_PREFIX = 'TV: ';

function tvUrl(plain: string): string {
  return `${window.location.origin}/tv?token=${encodeURIComponent(plain)}`;
}

export function TVSetupDrawer({ onClose }: Props) {
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('Empfangsbildschirm');
  const [creating, setCreating] = useState(false);
  const [freshUrl, setFreshUrl] = useState<{ url: string; name: string } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const all = await listApiTokens();
      setTokens(all.filter((t) => t.name.startsWith(TV_PREFIX) && !t.revokedAt));
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
      const { token, plain } = await createApiToken({ name: TV_PREFIX + name.trim() });
      setFreshUrl({ url: tvUrl(plain), name: token.name });
      setName('Empfangsbildschirm');
      await refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Token konnte nicht erstellt werden');
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    if (!window.confirm('Diesen TV-Zugang widerrufen? Der Bildschirm verliert sofort den Zugriff.')) return;
    await revokeApiToken(id);
    await refresh();
    showToast('TV-Zugang widerrufen');
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('In Zwischenablage kopiert');
    } catch {
      showToast('Kopieren fehlgeschlagen');
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
            <Icon name="monitor" size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <h3>Office-Display · TV-Setup</h3>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
              Wandbildschirm ohne Login mit Live-Status der Aufgaben
            </div>
          </div>
          <button className="x" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Frisch erstellte URL */}
          {freshUrl && (
            <div className="apit-fresh">
              <div className="apit-fresh-head">
                <Icon name="check-circle-2" size={14} style={{ color: 'var(--ok-500)' }} />
                <span>
                  „{freshUrl.name}" angelegt — kopier&#39;s dir jetzt, der Token wird nie wieder
                  angezeigt:
                </span>
              </div>
              <div className="apit-fresh-row">
                <code className="apit-fresh-code">{freshUrl.url}</code>
                <button className="tb-btn" onClick={() => copy(freshUrl.url)}>
                  <Icon name="copy" size={12} /> URL kopieren
                </button>
              </div>
              <div className="apit-fresh-foot">
                Diese URL auf dem Office-Bildschirm öffnen — kein Login nötig. Die Seite läuft
                fullscreen und aktualisiert sich automatisch.
              </div>
            </div>
          )}

          {/* Anlegen */}
          <form onSubmit={onCreate} className="apit-form">
            <label>
              <div className="eyebrow">Neuer Office-Display</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Empfangsbildschirm, Office-Wand, Konferenzraum"
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
                      <Icon name="plus" size={12} /> URL erstellen
                    </>
                  )}
                </button>
              </div>
              <div className="hint">
                Erzeugt einen API-Token mit Schreibrechten — die TV-Seite liest aber nur. Bei
                Verlust des Bildschirms (Display geklaut, Cache geleert) hier widerrufen.
              </div>
            </label>
          </form>

          {/* Bestehende */}
          <div className="eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>
            Aktive Office-Displays · {tokens.length}
          </div>

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 12 }}>
              Lade …
            </div>
          ) : tokens.length === 0 ? (
            <div className="apit-empty">
              <Icon name="monitor" size={24} style={{ color: 'var(--ink-300)' }} />
              <div>Noch kein Office-Display eingerichtet.</div>
            </div>
          ) : (
            <div className="apit-list">
              {tokens.map((t) => (
                <div key={t.id} className="apit-row">
                  <div className="apit-row-main">
                    <div className="apit-row-name">{t.name.replace(TV_PREFIX, '')}</div>
                    <div className="apit-row-meta">
                      <code>{t.prefix}…</code>
                      <span>·</span>
                      <span>angelegt {new Date(t.createdAt).toLocaleDateString('de-DE')}</span>
                      {t.lastUsedAt ? (
                        <>
                          <span>·</span>
                          <span>
                            zuletzt online{' '}
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
                          <span style={{ color: 'var(--ink-400)' }}>noch nie online</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button className="apit-revoke" onClick={() => onRevoke(t.id)}>
                    <Icon name="trash-2" size={13} /> Widerrufen
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hinweis */}
          <div className="apit-mcp">
            <div className="apit-mcp-head">
              <Icon name="info" size={14} style={{ color: 'var(--accent-500)' }} />
              <span>So richtest du den Bildschirm ein</span>
            </div>
            <ol style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.6 }}>
              <li>Oben einen neuen Display-Token erstellen, URL kopieren.</li>
              <li>Auf dem Office-Bildschirm Browser → URL öffnen → F11 (Vollbild).</li>
              <li>Tab nicht schließen — die Seite hält sich selbst aktuell.</li>
              <li>Neu starten via Browser-Reload reicht — kein Login nötig.</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
