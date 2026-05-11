import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import type { Project, ScreenId } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { NewProjectModal } from './NewProjectModal';
import { useT, useLocale } from '../../i18n';

type ProjectsView = 'cards' | 'list';
const VIEW_STORAGE_KEY = 'btm.projectsView';

function loadView(): ProjectsView {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    return v === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

export interface ProjectsScreenProps {
  setActive: (id: ScreenId) => void;
}

export function ProjectsScreen({ setActive }: ProjectsScreenProps) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const setFilter = useStore((s) => s.setFilter);
  const setUI = useStore((s) => s.setUI);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editProj, setEditProj] = useState<Project | null>(null);
  const [view, setView] = useState<ProjectsView>(() => loadView());

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    const onOpen = () => setShowNew(true);
    window.addEventListener('btm:open-new-project', onOpen);
    return () => window.removeEventListener('btm:open-new-project', onOpen);
  }, []);

  const filtered = projects.filter(
    (p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()),
  );

  // Pro Projekt vorab die Stats berechnen — wir brauchen sie in Card+List
  function statsFor(p: Project) {
    const projectTasks = tasks.filter((tk) => tk.proj === p.id);
    const done = projectTasks.filter((tk) => tk.col === 'done').length;
    const planned = projectTasks.reduce((a, b) => a + b.estH, 0);
    const logged = projectTasks.reduce((a, b) => a + b.loggedH, 0);
    const pct = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;
    const assignees = [...new Set(projectTasks.map((tk) => tk.who).filter(Boolean))] as string[];
    return { projectTasks, done, planned, logged, pct, assignees };
  }

  const VIEW_OPTIONS: { id: ProjectsView; icon: string; label: string }[] = [
    { id: 'cards', icon: 'layout-grid', label: t('layout.cards') },
    { id: 'list', icon: 'list', label: t('layout.list') },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">{t('projects.eyebrow')}</div>
          <h1>{t('projects.title_h1')}</h1>
          <div className="subtitle">
            {projects.length === 0
              ? t('projects.sub_empty')
              : projects.length === 1
              ? t('projects.sub_active_one', { count: projects.length })
              : t('projects.sub_active_many', { count: projects.length })}
          </div>
        </div>
        <div className="right" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <div
            className="view-toggle"
            style={{
              display: 'inline-flex',
              background: 'var(--cream-100)',
              border: '1px solid var(--ink-200)',
              borderRadius: 6,
              padding: 2,
            }}
          >
            {VIEW_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setView(o.id)}
                style={{
                  border: 0,
                  background: view === o.id ? 'var(--ink-900)' : 'transparent',
                  color: view === o.id ? 'var(--cream-50)' : 'var(--ink-700)',
                  padding: '5px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                }}
                title={o.label}
              >
                <Icon name={o.icon} size={12} /> {o.label}
              </button>
            ))}
          </div>
          <button className="tb-btn primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={14} /> {t('projects.new_project')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div className="tb-search" style={{ width: 320 }}>
          <Icon name="search" size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('projects.search_placeholder')} />
        </div>
      </div>

      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {filtered.map((p) => {
            const s = statsFor(p);
            return (
              <div
                key={p.id}
                className="proj-card"
                style={{ ['--proj-color' as keyof CSSProperties]: p.color } as CSSProperties}
                onClick={() => setUI({ projectDetailId: p.id })}
              >
                <div className="head">
                  <span className="code">{p.code}</span>
                  {p.due && (
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                      {t('projects.due_short', {
                        date: new Date(p.due).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
                          day: '2-digit',
                          month: 'short',
                        }),
                      })}
                    </span>
                  )}
                  <div style={{ flex: 1 }} />
                  <div className="proj-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="proj-card-action"
                      title={t('projects.open_action')}
                      onClick={() => {
                        setFilter({ proj: p.id, who: 'all' });
                        setActive('board');
                      }}
                    >
                      <Icon name="eye" size={13} />
                    </button>
                    <button
                      className="proj-card-action"
                      title={t('projects.edit_action')}
                      onClick={() => setEditProj(p)}
                    >
                      <Icon name="pencil" size={13} />
                    </button>
                  </div>
                </div>
                <h4>{p.name}</h4>
                <div className="meta">
                  <span>{t('projects.tasks_count', { count: s.projectTasks.length })}</span>
                  <span>{t('projects.done_of_total', { done: s.done, total: s.projectTasks.length })}</span>
                  <span>{t('projects.plan_log_short', { plan: s.planned.toFixed(0), logged: fmtNum(s.logged) })}</span>
                </div>
                <div className="mini-bar" style={{ marginTop: 10 }}>
                  <span style={{ width: s.pct + '%', background: p.color }} />
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {s.assignees.map((w) => (
                    <Avatar key={w} id={w} size={20} />
                  ))}
                </div>
              </div>
            );
          })}
          <button className="proj-card-new" onClick={() => setShowNew(true)} aria-label={t('projects.new_aria')}>
            <div className="plus-circle">
              <Icon name="plus" size={22} />
            </div>
            <div className="lbl">{t('projects.new_project')}</div>
            <div className="hint">{t('projects.new_hint')}</div>
          </button>
        </div>
      )}

      {view === 'list' && (
        <div className="proj-table-wrap">
          <table className="proj-table">
            <thead>
              <tr>
                <th className="col-code">{t('projects.list_code')}</th>
                <th className="col-name">{t('projects.list_project')}</th>
                <th className="col-owner">{t('projects.list_owner')}</th>
                <th className="col-num">{t('projects.list_tasks')}</th>
                <th className="col-num">{t('projects.list_done')}</th>
                <th className="col-progress">{t('projects.list_progress')}</th>
                <th className="col-hours">{t('projects.list_planned')}</th>
                <th className="col-hours">{t('projects.list_logged')}</th>
                <th className="col-due">{t('projects.list_due')}</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const s = statsFor(p);
                const owner = p.ownerId ? users.find((u) => u.id === p.ownerId) : undefined;
                return (
                  <tr key={p.id} onClick={() => setUI({ projectDetailId: p.id })}>
                    <td className="col-code">
                      <span
                        className="proj-table-code"
                        style={{ color: p.color, borderColor: p.color }}
                      >
                        {p.code}
                      </span>
                    </td>
                    <td className="col-name">
                      <div className="proj-table-name">{p.name}</div>
                      {p.client && <div className="proj-table-client">{p.client}</div>}
                    </td>
                    <td className="col-owner">
                      {owner ? (
                        <div className="proj-table-owner">
                          <Avatar id={owner.id} size={22} />
                          <span className="proj-table-owner-name">{owner.name || owner.email.split('@')[0]}</span>
                        </div>
                      ) : (
                        <span className="dim">{t('projects.list_no_owner')}</span>
                      )}
                    </td>
                    <td className="col-num mono">{s.projectTasks.length}</td>
                    <td className="col-num mono">{s.done}</td>
                    <td className="col-progress">
                      <div className="proj-table-bar">
                        <span style={{ width: s.pct + '%', background: p.color }} />
                      </div>
                      <span className="proj-table-pct mono">{s.pct}%</span>
                    </td>
                    <td className="col-hours mono">{s.planned.toFixed(0)}h</td>
                    <td className="col-hours mono">{fmtNum(s.logged)}h</td>
                    <td className="col-due mono">
                      {p.due
                        ? new Date(p.due).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="proj-table-action"
                        title={t('projects.open_action')}
                        onClick={() => {
                          setFilter({ proj: p.id, who: 'all' });
                          setActive('board');
                        }}
                      >
                        <Icon name="eye" size={13} />
                      </button>
                      <button
                        className="proj-table-action"
                        title={t('projects.edit_action')}
                        onClick={() => setEditProj(p)}
                      >
                        <Icon name="pencil" size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
      {editProj && <NewProjectModal existing={editProj} onClose={() => setEditProj(null)} />}
    </div>
  );
}
