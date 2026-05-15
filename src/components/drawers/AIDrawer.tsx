import { useState } from 'react';
import type { ScreenId, Priority } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { filterAssignableProjects } from '../../lib/projectFilters';

interface ExtractedTask {
  title: string;
  proj: string;
  who: string;
  estH: number;
  prio: Priority;
  due: string;
  notes: string;
}

type Tab = 'text' | 'file';
type Phase = 'input' | 'thinking' | 'result';

export interface AIDrawerProps {
  setActive: (id: ScreenId) => void;
}

export function AIDrawer({ setActive }: AIDrawerProps) {
  const projects = useStore((s) => s.projects);
  const currentUser = useStore((s) => s.currentUser);
  const tasks = useStore((s) => s.tasks);
  const users = useStore((s) => s.users);
  const addTask = useStore((s) => s.addTask);
  const setUI = useStore((s) => s.setUI);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [picks, setPicks] = useState<boolean[]>([]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editedTasks, setEditedTasks] = useState<ExtractedTask[]>([]);

  const close = () => setUI({ drawer: null });

  const extract = async () => {
    setPhase('thinking');
    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        result: { tasks: Array<{
          title: string;
          description?: string;
          project_id?: string | null;
          assignee_id?: string | null;
          est_h?: number;
          prio?: 'low' | 'med' | 'high';
          due?: string | null;
          notes?: string;
        }> };
      };
      const extracted: ExtractedTask[] = (data.result?.tasks ?? []).map((tk) => ({
        title: tk.title,
        proj: tk.project_id ?? '',
        who: tk.assignee_id ?? '',
        estH: typeof tk.est_h === 'number' ? tk.est_h : 1,
        prio: (tk.prio ?? 'med') as Priority,
        due: tk.due ?? '',
        notes: tk.notes ?? tk.description ?? '',
      }));
      setEditedTasks(extracted);
      setPicks(extracted.map(() => true));
      setPhase('result');
      if (extracted.length === 0) {
        showToast(t('ai_drawer.no_tasks'));
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('toast.api_unreachable'));
      setPhase('input');
    }
  };

  const create = async () => {
    let added = 0;
    for (let i = 0; i < editedTasks.length; i++) {
      if (!picks[i]) continue;
      const e = editedTasks[i];
      const exists = tasks.find((tk) => tk.title === e.title);
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
        due: e.due || null,
      });
      added++;
    }
    showToast(
      added === 1 ? t('ai_drawer.create_toast_one', { count: added }) : t('ai_drawer.create_toast_many', { count: added }),
    );
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
            <h3>{t('ai_drawer.title')}</h3>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
              {t('ai_drawer.sub')}
            </div>
          </div>
          <button className="x" onClick={close}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="ai-tabs">
          {(
            [
              ['text', t('ai_drawer.tab_text')],
              ['file', t('ai_drawer.tab_file')],
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
                    {t('ai_drawer.text_eyebrow')}
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
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                      {t('ai_drawer.text_hint')}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                      {t('ai_drawer.text_chars', { count: text.length })}
                    </span>
                  </div>
                </>
              )}
              {tab === 'file' && (
                <div style={{ border: '2px dashed var(--ink-300)', borderRadius: 8, padding: 60, textAlign: 'center' }}>
                  <Icon name="upload-cloud" size={36} style={{ color: 'var(--ink-400)' }} />
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 10 }}>{t('ai_drawer.file_dropzone')}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 4 }}>{t('ai_drawer.file_dropzone_sub')}</div>
                </div>
              )}
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
                <span>{t('ai_drawer.thinking_step1')}</span>
              </div>
              <div className="ai-thinking">
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span>{t('ai_drawer.thinking_step2')}</span>
              </div>
              <div className="ai-thinking">
                <span className="dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span>{t('ai_drawer.thinking_step3')}</span>
              </div>
            </div>
          )}

          {phase === 'result' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Icon name="check-circle-2" size={18} style={{ color: 'var(--ok-500)' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {editedTasks.length === 1
                      ? t('ai_drawer.extracted_one', { count: editedTasks.length })
                      : t('ai_drawer.extracted_many', { count: editedTasks.length })}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                    {t('ai_drawer.extracted_sub')}
                  </div>
                </div>
                <div style={{ flex: 1 }} />
                <button className="filter-chip" onClick={() => setPicks(picks.map(() => true))}>
                  {t('ai_drawer.select_all')}
                </button>
                <button className="filter-chip" onClick={() => setPicks(picks.map(() => false))}>
                  {t('ai_drawer.select_none')}
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
                          {fmtNum(e.estH)}h
                        </span>
                      </div>
                    </div>
                    <div className="ai-row-actions">
                      <button
                        className="ai-row-icon"
                        onClick={() => setPreviewIdx(previewIdx === i ? null : i)}
                        title={t('ai_drawer.preview_label')}
                      >
                        <Icon name={previewIdx === i ? 'eye-off' : 'eye'} size={14} />
                      </button>
                      <button className="ai-row-icon" onClick={() => setEditIdx(i)} title={t('ai_drawer.edit_label')}>
                        <Icon name="pencil" size={14} />
                      </button>
                      <span className="src">{t('ai_drawer.line_label', { n: i + 1 })}</span>
                    </div>
                  </div>
                  {previewIdx === i && (
                    <div className="ai-row-preview">
                      <div className="ai-prev-grid">
                        <div className="ai-prev-cell">
                          <div className="eyebrow">{t('ai_drawer.field_project')}</div>
                          <div>
                            <ProjTag id={e.proj} />
                          </div>
                        </div>
                        <div className="ai-prev-cell">
                          <div className="eyebrow">{t('ai_drawer.field_assignee')}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <Avatar id={e.who} size={18} />
                            {users.find((u) => u.id === e.who)?.name ?? e.who}
                          </div>
                        </div>
                        <div className="ai-prev-cell">
                          <div className="eyebrow">{t('ai_drawer.field_estimate')}</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {fmtNum(e.estH)}h
                          </div>
                        </div>
                        <div className="ai-prev-cell">
                          <div className="eyebrow">{t('ai_drawer.field_priority')}</div>
                          <div style={{ fontSize: 12, textTransform: 'capitalize' }}>
                            {e.prio === 'high' ? t('prio.high') : e.prio === 'med' ? t('prio.med') : t('prio.low')}
                          </div>
                        </div>
                        {e.due && (
                          <div className="ai-prev-cell">
                            <div className="eyebrow">{t('ai_drawer.field_due')}</div>
                            <div style={{ fontSize: 12 }}>{e.due}</div>
                          </div>
                        )}
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
                            {t('ai_drawer.field_source')}
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
                      <h4>{t('ai_drawer.edit_modal_title')}</h4>
                      <div style={{ flex: 1 }} />
                      <button className="x" onClick={() => setEditIdx(null)}>
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                    <div className="ai-edit-body">
                      <label>
                        <div className="eyebrow">{t('ai_drawer.field_title')}</div>
                        <input
                          type="text"
                          value={editedTasks[editIdx].title}
                          onChange={(ev) =>
                            setEditedTasks(
                              editedTasks.map((tk, j) =>
                                j === editIdx ? { ...tk, title: ev.target.value } : tk,
                              ),
                            )
                          }
                        />
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label>
                          <div className="eyebrow">{t('ai_drawer.field_project')}</div>
                          <select
                            value={editedTasks[editIdx].proj}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((tk, j) =>
                                  j === editIdx ? { ...tk, proj: ev.target.value } : tk,
                                ),
                              )
                            }
                          >
                            {(() => {
                              const { favorites, others } = filterAssignableProjects(projects, {
                                currentUserId: currentUser,
                                showOnlyFavorites: true,
                                includeIds: editedTasks[editIdx].proj ? [editedTasks[editIdx].proj] : [],
                              });
                              if (favorites.length > 0 && others.length > 0) {
                                return (
                                  <>
                                    <optgroup label="★ Favoriten">
                                      {favorites.map((p) => (
                                        <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Andere Projekte">
                                      {others.map((p) => (
                                        <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                                      ))}
                                    </optgroup>
                                  </>
                                );
                              }
                              return [...favorites, ...others].map((p) => (
                                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                              ));
                            })()}
                          </select>
                        </label>
                        <label>
                          <div className="eyebrow">{t('ai_drawer.field_assignee')}</div>
                          <select
                            value={editedTasks[editIdx].who}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((tk, j) =>
                                  j === editIdx ? { ...tk, who: ev.target.value } : tk,
                                ),
                              )
                            }
                          >
                            {users
                              .filter((u) => u.status === 'active' || u.status === 'invited')
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                  {u.status === 'invited' ? t('task_detail.user_invited_suffix') : ''}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          <div className="eyebrow">{t('ai_drawer.field_estimate_h')}</div>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={editedTasks[editIdx].estH}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((tk, j) =>
                                  j === editIdx ? { ...tk, estH: parseFloat(ev.target.value) || 0 } : tk,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          <div className="eyebrow">{t('ai_drawer.field_priority')}</div>
                          <select
                            value={editedTasks[editIdx].prio}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((tk, j) =>
                                  j === editIdx ? { ...tk, prio: ev.target.value as Priority } : tk,
                                ),
                              )
                            }
                          >
                            <option value="low">{t('prio.low')}</option>
                            <option value="med">{t('prio.med')}</option>
                            <option value="high">{t('prio.high')}</option>
                          </select>
                        </label>
                        <label>
                          <div className="eyebrow">{t('ai_drawer.field_due')}</div>
                          <input
                            type="date"
                            value={editedTasks[editIdx].due}
                            onChange={(ev) =>
                              setEditedTasks(
                                editedTasks.map((tk, j) =>
                                  j === editIdx ? { ...tk, due: ev.target.value } : tk,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                    <div className="ai-edit-foot">
                      <div style={{ flex: 1 }} />
                      <button className="tb-btn accent" onClick={() => setEditIdx(null)}>
                        <Icon name="check" size={13} /> {t('ai_drawer.edit_apply')}
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
                {t('ai_drawer.result_sub')}
              </span>
              <div style={{ flex: 1 }} />
              <button className="tb-btn" onClick={close}>
                {t('ai_drawer.cancel')}
              </button>
              <button className="tb-btn accent" onClick={extract}>
                <Icon name="sparkles" size={13} /> {t('ai_drawer.extract')}
              </button>
            </>
          )}
          {phase === 'result' && (
            <>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                {t('ai_drawer.landing', { count: picks.filter(Boolean).length })}
              </span>
              <div style={{ flex: 1 }} />
              <button className="tb-btn" onClick={() => setPhase('input')}>
                {t('common.back')}
              </button>
              <button className="tb-btn accent" onClick={create} disabled={!picks.some(Boolean)}>
                <Icon name="check" size={13} /> {t('ai_drawer.apply', { count: picks.filter(Boolean).length })}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
