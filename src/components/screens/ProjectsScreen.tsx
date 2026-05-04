import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import type { Project, ScreenId } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { NewProjectModal } from './NewProjectModal';

export interface ProjectsScreenProps {
  setActive: (id: ScreenId) => void;
}

export function ProjectsScreen({ setActive }: ProjectsScreenProps) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const setFilter = useStore((s) => s.setFilter);

  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editProj, setEditProj] = useState<Project | null>(null);

  // Listen for the cmdk "Neues Projekt" action
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
          <div className="eyebrow">05 · Projekte</div>
          <h1>Projekte</h1>
          <div className="subtitle">
            {projects.length === 0
              ? 'Noch keine Projekte angelegt — leg dein erstes an.'
              : `${projects.length} ${projects.length === 1 ? 'aktives Projekt' : 'aktive Projekte'}`}
          </div>
        </div>
        <div className="right">
          <button className="tb-btn primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={14} /> Neues Projekt
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div className="tb-search" style={{ width: 320 }}>
          <Icon name="search" size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Projekt suchen…" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {filtered.map((p) => {
          const projectTasks = tasks.filter((t) => t.proj === p.id);
          const done = projectTasks.filter((t) => t.col === 'done').length;
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
                    · fällig{' '}
                    {new Date(p.due).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <div className="proj-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="proj-card-action"
                    title="Öffnen"
                    onClick={() => {
                      setFilter({ proj: p.id, who: 'all' });
                      setActive('board');
                    }}
                  >
                    <Icon name="eye" size={13} />
                  </button>
                  <button className="proj-card-action" title="Bearbeiten" onClick={() => setEditProj(p)}>
                    <Icon name="pencil" size={13} />
                  </button>
                </div>
              </div>
              <h4>{p.name}</h4>
              <div className="meta">
                <span>{projectTasks.length} Aufgaben</span>
                <span>
                  {done} / {projectTasks.length} erledigt
                </span>
                <span>
                  {planned.toFixed(0)}h gepl. · {logged.toFixed(1).replace('.', ',')}h erf.
                </span>
              </div>
              <div className="mini-bar" style={{ marginTop: 10 }}>
                <span style={{ width: pct + '%', background: p.color }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                {[...new Set(projectTasks.map((t) => t.who))].map((w) => (
                  <Avatar key={w} id={w} size={20} />
                ))}
              </div>
            </div>
          );
        })}
        <button className="proj-card-new" onClick={() => setShowNew(true)} aria-label="Neues Projekt anlegen">
          <div className="plus-circle">
            <Icon name="plus" size={22} />
          </div>
          <div className="lbl">Neues Projekt</div>
          <div className="hint">Code, Name, Farbe, Fälligkeit</div>
        </button>
      </div>

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}
      {editProj && <NewProjectModal existing={editProj} onClose={() => setEditProj(null)} />}
    </div>
  );
}
