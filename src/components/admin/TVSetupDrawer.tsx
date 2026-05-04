// Office-Display: Admin generiert TV-Token + bekommt eine URL.
// URL wird zusammen mit einem Auto-Reload-Intervall im Backend gespeichert
// (apiTokens.displayUrl + refreshSeconds), damit der Admin sie später
// nochmal kopieren kann ohne den Token zu rotieren.

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
const RELOAD_PRESETS: Array<{ s: number; label: string }> = [
  { s: 300, label: '5 min' },
  { s: 900, label: '15 min' },
  { s: 1800, label: '30 min' },
  { s: 3600, label: '1 h' },
  { s: 14400, label: '4 h' },
  { s: 86400, label: '24 h' },
];

function fullUrl(displayUrl: string | null): string {
  if (!displayUrl) return '';
  if (displayUrl.startsWith('http')) return displayUrl;
  return window.location.origin + displayUrl;
}

export function TVSetupDrawer({ onClose }: Props) {
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('Empfangsbildschirm');
  const [refreshSec, setRefreshSec] = useState(1800);
  const [creating, setCreating] = useState(false);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);

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
      const { token, plain } = await createApiToken({
        name: TV_PREFIX + name.trim(),
        // Server speichert die URL — wir geben das Template mit Platzhalter rein
        displayUrlTemplate: `/tv?token={plain}&reload=${refreshSec}`,
        refreshSeconds: refreshSec,
      });
      // Live-URL anzeigen (frisch erstellt = enthält den plain-Token bereits ersetzt
      // im display_url des Servers, ABER um sicher zu sein nehmen wir den plain hier).
      const url = `${window.location.origin}/tv?token=${encodeURIComponent(plain)}&reload=${refreshSec}`;
      setFreshUrl(url);
      // Token-Display in der Liste sehen alle danach via displayUrl
      void token; // wird gespeichert mit displayUrl
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
                <span>URL erstellt — bleibt auch in der Liste unten gespeichert.</span>
              </div>
              <div className="apit-fresh-row">
                <code className="apit-fresh-code">{freshUrl}</code>
                <button className="tb-btn" onClick={() => copy(freshUrl)}>
                  <Icon name="copy" size={12} /> URL kopieren
                </button>
              </div>
              <div className="apit-fresh-foot">
                Diese URL auf dem Office-Bildschirm öffnen — kein Login nötig. Die Seite läuft
                fullscreen und reloaded sich automatisch alle{' '}
                {RELOAD_PRESETS.find((p) => p.s === refreshSec)?.label ?? `${refreshSec}s`}.
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
            </label>

            <div style={{ marginTop: 14 }}>
              <div
                className="eyebrow"
                style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                Auto-Reload alle
                <span className="mono" style={{ color: 'var(--ink-700)', fontSize: 11 }}>
                  {RELOAD_PRESETS.find((p) => p.s === refreshSec)?.label ?? `${refreshSec}s`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RELOAD_PRESETS.map((p) => (
                  <button
                    key={p.s}
                    type="button"
                    onClick={() => setRefreshSec(p.s)}
                    className={`filter-chip ${refreshSec === p.s ? 'active' : ''}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="hint">
                Die TV-Seite reloaded sich automatisch im gewählten Intervall — sorgt für frische
                Daten ohne manuellen Eingriff.
              </div>
            </div>
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
              {tokens.map((t) => {
                const url = fullUrl(t.displayUrl);
                return (
                  <div
                    key={t.id}
                    className="apit-row"
                    style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="apit-row-main">
                        <div className="apit-row-name">{t.name.replace(TV_PREFIX, '')}</div>
                        <div className="apit-row-meta">
                          <code>{t.prefix}…</code>
                          <span>·</span>
                          <span>angelegt {new Date(t.createdAt).toLocaleDateString('de-DE')}</span>
                          {t.refreshSeconds && (
                            <>
                              <span>·</span>
                              <span>
                                Reload alle{' '}
                                {RELOAD_PRESETS.find((p) => p.s === t.refreshSeconds)?.label ??
                                  `${t.refreshSeconds}s`}
                              </span>
                            </>
                          )}
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
                    {url && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <code
                          style={{
                            flex: 1,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: 'var(--ink-700)',
                            background: 'var(--cream-100)',
                            border: '1px solid var(--ink-100)',
                            borderRadius: 6,
                            padding: '6px 10px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            userSelect: 'all',
                          }}
                          title={url}
                        >
                          {url}
                        </code>
                        <button className="tb-btn" onClick={() => copy(url)}>
                          <Icon name="copy" size={12} /> Kopieren
                        </button>
                        <a className="tb-btn" href={url} target="_blank" rel="noopener noreferrer">
                          <Icon name="external-link" size={12} /> Öffnen
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Hinweis */}
          <div className="apit-mcp">
            <div className="apit-mcp-head">
              <Icon name="info" size={14} style={{ color: 'var(--accent-500)' }} />
              <span>So richtest du den Bildschirm ein</span>
            </div>
            <ol style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.6 }}>
              <li>Oben einen neuen Display anlegen (Name + Reload-Intervall).</li>
              <li>URL aus der Liste kopieren oder „Öffnen" klicken.</li>
              <li>Auf dem Office-Bildschirm Browser → URL öffnen → F11 (Vollbild).</li>
              <li>Tab nicht schließen — die Seite reloaded sich automatisch.</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
