import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import type { Project, ScreenId } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { NewProjectModal } from './NewProjectModal';
import { useT, useLocale } from '../../i18n';

export interface ProjectsScreenProps {
  setActive: (id: ScreenId) => void;
}

export function ProjectsScreen({ setActive }: ProjectsScreenProps) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const setFilter = useStore((s) => s.setFilter);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editProj, setEditProj] = useState<Project | null>(null);

  useEffect(() => {
    const onOpen = () => setShowNew(true);
    window.addEventListener('btm:open-new-project', onOpen);
    return () => window.removeEventListener('btm:open-new-project', onOpen);
  }, []);

  const filtered = projects.filter(
    (p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()),
  );

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
        <div className="right">
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {filtered.map((p) => {
          const projectTasks = tasks.filter((tk) => tk.proj === p.id);
          const done = projectTasks.filter((tk) => tk.col === 'done').length;
          const planned = projectTasks.reduce((a, b) => a + b.estH, 0);
          const logged = projectTasks.reduce((a, b) => a + b.loggedH, 0);
          const pct = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;
          return (
            <div
              key={p.id}
              className="proj-card"
              style={{ ['--proj-color' as keyof CSSProperties]: p.color } as CSSProperties}
              onClick={() => {
                setFilter({ proj: p.id, who: 'all' });
                setActive('board');
              }}
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
                  <button className="proj-card-action" title={t('projects.edit_action')} onClick={() => setEditProj(p)}>
                    <Icon name="pencil" size={13} />
                  </button>
                </div>
              </div>
              <h4>{p.name}</h4>
              <div className="meta">
                <span>{t('projects.tasks_count', { count: projectTasks.length })}</span>
                <span>
                  {t('projects.done_of_total', { done, total: projectTasks.length })}
                </span>
                <span>
                  {t('projects.plan_log_short', { plan: planned.toFixed(0), logged: fmtNum(logged) })}
                </span>
              </div>
              <div className="mini-bar" style={{ marginTop: 10 }}>
                <span style={{ width: pct + '%', background: p.color }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                {[...new Set(projectTasks.map((tk) => tk.who))].map((w) => (
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

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
      {editProj && <NewProjectModal existing={editProj} onClose={() => setEditProj(null)} />}
    </div>
  );
}
