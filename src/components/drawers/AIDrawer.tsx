import { useState } from 'react';
import type { ScreenId, Priority } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { ChatPane } from './ChatPane';

const SAMPLE_MD = `# FahrerApp — PM-Anleitung Etappe 1: Web-Tech, ASO-Listings & Schema

Acht Aufgaben für KW 19. Quick-Wins zuerst, dann Code, dann Store-Listings.

| # | Aufgabe                                       | Wer    | Zeit   |
|---|-----------------------------------------------|--------|--------|
| 1 | Web: index.html Meta-Tags                     | Arne   | 30 min |
| 2 | Web: robots.txt + sitemap.xml                 | Arne   | 30 min |
| 3 | Web: og:image korrigieren                     | Arne   | 1 h    |
| 4 | Web: JSON-LD Schema einbinden                 | Arne   | 30 min |
| 5 | Lighthouse-Audit + Fix Top-3 Findings         | Arne   | 1,5 h  |
| 6 | App-Store: Screenshots iPhone 15 Pro Max      | Hakan  | 1,5 h  |
| 7 | Play-Store: Feature-Graphic 1024×500          | Amon   | 1 h    |
| 8 | Anwalt-Feedback DSGVO einarbeiten             | PM     | 2 h    |
`;

interface ExtractedTask {
  title: string;
  proj: string;
  who: string;
  estH: number;
  prio: Priority;
  notes: string;
}

const EXTRACTED: ExtractedTask[] = [
  { title: 'Web: index.html Meta-Tags korrigieren', proj: 'P1', who: 'AR', estH: 0.5, prio: 'high', notes: 'Tabelle Zeile 1 · "Web: index.html Meta-Tags · Arne · 30 min" — Quick-Win, vor Lighthouse-Audit erledigen.' },
  { title: 'Web: robots.txt + sitemap.xml anlegen', proj: 'P1', who: 'AR', estH: 0.5, prio: 'med', notes: 'Tabelle Zeile 2 · sitemap.xml mit Routen aus app/router.ts generieren.' },
  { title: 'Web: og:image korrigieren', proj: 'P1', who: 'AR', estH: 1.0, prio: 'med', notes: 'Tabelle Zeile 3 · 1200×630 PNG, Asset von Hakan beziehen.' },
  { title: 'Web: JSON-LD Schema einbinden', proj: 'P1', who: 'AR', estH: 0.5, prio: 'low', notes: 'Tabelle Zeile 4 · Organization + MobileApplication Schema.' },
  { title: 'Lighthouse-Audit + Fix Top-3 Findings', proj: 'P1', who: 'AR', estH: 1.5, prio: 'high', notes: 'Tabelle Zeile 5 · Performance, A11y, SEO — Top-3 fixen, Rest Backlog.' },
  { title: 'App-Store: Screenshots iPhone 15 Pro Max', proj: 'P3', who: 'HK', estH: 1.5, prio: 'med', notes: 'Tabelle Zeile 6 · 6 Screens, deutsch + englisch.' },
  { title: 'Play-Store: Feature-Graphic 1024×500', proj: 'P3', who: 'AM', estH: 1.0, prio: 'low', notes: 'Tabelle Zeile 7 · Brand-Asset von Amon.' },
  { title: 'Anwalt-Feedback DSGVO einarbeiten', proj: 'P2', who: 'PM', estH: 2.0, prio: 'high', notes: 'Tabelle Zeile 8 · Anwalts-Feedback eingegangen 02.05., zwei Punkte: Auftragsverarbeitung & Cookie-Banner.' },
];

type Tab = 'text' | 'file' | 'chat';
type Phase = 'input' | 'thinking' | 'result';

export interface AIDrawerProps {
  setActive: (id: ScreenId) => void;
}

export function AIDrawer({ setActive }: AIDrawerProps) {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const addTask = useStore((s) => s.addTask);
  const setUI = useStore((s) => s.setUI);

  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState(SAMPLE_MD);
  const [phase, setPhase] = useState<Phase>('input');
  const [picks, setPicks] = useState<boolean[]>(EXTRACTED.map(() => true));
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editedTasks, setEditedTasks] = useState<ExtractedTask[]>(EXTRACTED.map((t) => ({ ...t })));

  const close = () => setUI({ drawer: null });

  const extract = () => {
    setPhase('thinking');
    setTimeout(() => setPhase('result'), 1600);
  };

  const create = async () => {
    let added = 0;
    for (let i = 0; i < editedTasks.length; i++) {
      if (!picks[i]) continue;
      const e = editedTasks[i];
      const exists = tasks.find((t) => t.title === e.title);
      if (exists) continue;
      // Demo-Persona-IDs (AR/HK/AM/PM) sind keine gültigen User-IDs am Server.
      // Fallback: nur durchreichen wenn die ID auch in der User-Liste existiert.
      const validAssignee = users.find((u) => u.id === e.who) ? e.who : null;
      const validProj = projects.find((p) => p.id === e.proj) ? e.proj : null;
      await addTask({
        title: e.title,
        proj: validProj,
        who: validAssignee ?? '',
        estH: e.estH,
        prio: e.prio,
      });
      added++;
    }
    showToast(`${added} Aufgabe${added === 1 ? '' : 'n'} angelegt → Wochenboard`);
    close();
    setActive('board');
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={close} />
      <div className="drawer wide">
        <div className="drawer-head">
          <div
            style={{
              width: 32,
              height: 32,
              background: 'var(--accent-500)',
              borderRadius: 6,
              color: 'var(--cream-50)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="sparkles" size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <h3>Planungsassistent</h3>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
              PM-Anleitungen → Tasks · ⌘K zum Öffnen / Schließen
            </div>
          </div>
          <button className="x" onClick={close}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="ai-tabs">
          {(
            [
              ['text', 'Freitext / E-Mail'],
              ['file', 'Datei hochladen'],
              ['chat', 'Chat'],
            ] as Array<[Tab, string]>
          ).map(([id, lbl]) => (
            <button key={id} className={`ai-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {lbl}
            </button>
          ))}
        </div>

        <div className="drawer-body">
          {phase === 'input' && (
            <>
              {tab === 'text' && (
                <>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>
                    PM-Anleitung Etappe 1 · aus Claude-Skill
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: 280,
                      background: 'var(--cream-100)',
                      border: '1px solid var(--ink-200)',
                      borderRadius: 8,
                      padding: 14,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--ink-700)',
                      lineHeight: 1.6,
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    <span className="pill todo">
                      <Icon name="paperclip" size={9} /> 1 Anhang
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                      fahrerapp-etappe-1.md · 4,2 KB
                    </span>
                    <div style={{ flex: 1 }} />
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                      {text.length} Zeichen
                    </span>
                  </div>
                </>
              )}
              {tab === 'file' && (
                <div style={{ border: '2px dashed var(--ink-300)', borderRadius: 8, padding: 60, textAlign: 'center' }}>
                  <Icon name="upload-cloud" size={36} style={{ color: 'var(--ink-400)' }} />
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 10 }}>PDF, DOCX, MD, TXT hier ablegen</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>oder klicken zum Auswählen</div>
                </div>
              )}
              {tab === 'chat' && <ChatPane setText={setText} setTab={setTab} extract={extract} />}
            </>
          )}

          {phase === 'thinking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ai-thinking">
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span>Lese Markdown-Tabelle…</span>
              </div>
              <div className="ai-thinking">
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span>Erkenne 8 Aufgaben mit Zuweisung & Zeitschätzung</span>
              </div>
              <div className="ai-thinking">
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span>Mappe Personen → AR, HK, AM, PM · Projekte → E1, E3, E2</span>
              </div>
            </div>
          )}

          {phase === 'result' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Icon name="check-circle-2" size={18} style={{ color: 'var(--ok-500)' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{EXTRACTED.length} Aufgaben extrahiert</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                    Editierbar · Quelle: fahrerapp-etappe-1.md
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                <button className="filter-chip" onClick={() => setPicks(picks.map(() => true))}>
                  Alle
                </button>
                <button className="filter-chip" onClick={() => setPicks(picks.map(() => false))}>
                  Keine
                </button>
              </div>
              {editedTasks.map((e, i) => (
                <div key={i} className={`ai-task-row ${previewIdx === i ? 'expanded' : ''}`}>
                  <div className="ai-row-main">
                    <input
                      type="checkbox"
                      checked={picks[i]}
                      onChange={() => setPicks(picks.map((p, j) => (j === i ? !p : p)))}
                    />
                    <div className="ti">
                      <div>{e.title}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                        <ProjTag id={e.proj} />
                        <Avatar id={e.who} size={16} />
                        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                          {e.estH.toFixed(1).replace('.', ',')}h
                        </span>
                      </div>
                    </div>
                    <div className="ai-row-actions">
                      <button
                        className="ai-row-icon"
                        onClick={() => setPreviewIdx(previewIdx === i ? null : i)}
                        title="Vorschau"
                      >
                        <Icon name={previewIdx === i ? 'eye-off' : 'eye'} size={14} />
                      </button>
                      <button className="ai-row-icon" onClick={() => setEditIdx(i)} title="Bearbeiten">
                        <Icon name="pencil" size={14} />
                      </button>
                      <span className="src">Z. {i + 1}</span>
                    </div>
                  </div>
                  {previewIdx === i && (
                    <div className="ai-row-preview">
                      <div className="ai-prev-grid">
                        <div className="ai-prev-cell">
                          <div className="eyebrow">Projekt</div>
                          <div>
                            <ProjTag id={e.proj} />
                          </div>
                        </div>
                        <div className="ai-prev-cell">
                          <div className="eyebrow">Zugewiesen</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <Avatar id={e.who} size={18} />
                            {users.find((u) => u.id === e.who)?.name ?? e.who}
                          </div>
                        </div>
                        <div className="ai-prev-cell">
                          <div className="eyebrow">Schätzung</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {e.estH.toFixed(1).replace('.', ',')}h
                          </div>
                        </div>
                        <div className="ai-prev-cell">
                          <div className="eyebrow">Priorität</div>
                          <div style={{ fontSize: 12, textTransform: 'capitalize' }}>
                            {e.prio === 'high' ? 'hoch' : e.prio === 'med' ? 'mittel' : 'niedrig'}
                          </div>
                        </div>
                      </div>
                      {e.notes && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '8px 10px',
                            background: 'var(--cream-50)',
                            borderRadius: 6,
                            fontSize: 12,
                            color: 'var(--ink-700)',
                            lineHeight: 1.5,
                          }}
                        >
                          <div className="eyebrow" style={{ marginBottom: 4 }}>
                            Quelle
                          </div>
                          {e.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {editIdx !== null && (
                <div className="ai-edit-overlay" onClick={() => setEditIdx(null)}>
                  <div className="ai-edit-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="ai-edit-head">
                      <Icon name="pencil" size={14} />
                      <h4>Aufgabe bearbeiten</h4>
                      <div style={{ flex: 1 }} />
                      <button className="x" onClick={() => setEditIdx(null)}>
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                    <div className="ai-edit-body">
                      <label>
                        <div className="eyebrow">Titel</div>
                        <input
                          type="text"
                          value={editedTasks[editIdx].title}
                          onChange={(ev) =>
                            setEditedTasks(
                              editedTasks.map((t, j) =>
                                j === editIdx ? { ...t, title: ev.target.value } : t,
                              ),
                            )
                          }
                        />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label>
                          <div className="eyebrow">Projekt</div>
                          <select
                            value={editedTasks[editIdx].proj}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((t, j) =>
                                  j === editIdx ? { ...t, proj: ev.target.value } : t,
                                ),
                              )
                            }
                          >
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code} · {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <div className="eyebrow">Zugewiesen</div>
                          <select
                            value={editedTasks[editIdx].who}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((t, j) =>
                                  j === editIdx ? { ...t, who: ev.target.value } : t,
                                ),
                              )
                            }
                          >
                            {users
                              .filter((u) => u.status === 'active')
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          <div className="eyebrow">Schätzung (h)</div>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={editedTasks[editIdx].estH}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((t, j) =>
                                  j === editIdx ? { ...t, estH: parseFloat(ev.target.value) || 0 } : t,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          <div className="eyebrow">Priorität</div>
                          <select
                            value={editedTasks[editIdx].prio}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((t, j) =>
                                  j === editIdx ? { ...t, prio: ev.target.value as Priority } : t,
                                ),
                              )
                            }
                          >
                            <option value="low">niedrig</option>
                            <option value="med">mittel</option>
                            <option value="high">hoch</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="ai-edit-foot">
                      <button
                        className="tb-btn"
                        onClick={() => {
                          setEditedTasks(
                            editedTasks.map((t, j) => (j === editIdx ? { ...EXTRACTED[editIdx] } : t)),
                          );
                        }}
                      >
                        Zurücksetzen
                      </button>
                      <div style={{ flex: 1 }} />
                      <button className="tb-btn accent" onClick={() => setEditIdx(null)}>
                        <Icon name="check" size={13} /> Übernehmen
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="drawer-foot">
          {phase === 'input' && (
            <>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                KI extrahiert Aufgaben + Zeitschätzungen + Zuweisungen
              </span>
              <div style={{ flex: 1 }} />
              <button className="tb-btn" onClick={close}>
                Abbrechen
              </button>
              <button className="tb-btn accent" onClick={extract}>
                <Icon name="sparkles" size={13} /> Aufgaben extrahieren
              </button>
            </>
          )}
          {phase === 'result' && (
            <>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                {picks.filter(Boolean).length} ausgewählt · landen im Backlog
              </span>
              <div style={{ flex: 1 }} />
              <button className="tb-btn" onClick={() => setPhase('input')}>
                Zurück
              </button>
              <button className="tb-btn accent" onClick={create} disabled={!picks.some(Boolean)}>
                <Icon name="check" size={13} /> {picks.filter(Boolean).length} Aufgaben anlegen
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
