import { useState, type CSSProperties } from 'react';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { ProjTag } from '../shared/ProjTag';
import { useT, useLocale } from '../../i18n';
import { CommentsSection } from '../comments/CommentsSection';
import { NewProjectModal } from '../screens/NewProjectModal';

export interface ProjectDetailDrawerProps {
  id: string;
}

export function ProjectDetailDrawer({ id }: ProjectDetailDrawerProps) {
  const t = useT();
  const [locale] = useLocale();
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const setUI = useStore((s) => s.setUI);
  const setFilter = useStore((s) => s.setFilter);
  const [editing, setEditing] = useState(false);

  const project = projects.find((p) => p.id === id);
  if (!project) return null;

  const close = () => setUI({ projectDetailId: null });

  const projectTasks = tasks.filter((tk) => tk.proj === id);
  const done = projectTasks.filter((tk) => tk.col === 'done').length;
  const open = projectTasks.length - done;
  const planned = projectTasks.reduce((a, b) => a + b.estH, 0);
  const logged = projectTasks.reduce((a, b) => a + b.loggedH, 0);
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');
  const isPrivate = project.code.startsWith('PR-');

  const openInBoard = () => {
    setFilter({ proj: project.id, who: 'all' });
    close();
    // Caller-Page wechselt zu Board (App.tsx Active-Routing)
    window.location.assign('/board');
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={close} />
      <div className="drawer wide" style={{ ['--proj-color' as keyof CSSProperties]: project.color } as CSSProperties}>
        <div className="drawer-head">
          <ProjTag id={project.id} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
            {project.id}
          </span>
          <div style={{ flex: 1 }} />
          <button className="x" onClick={() => setEditing(true)} title={t('projects.edit_action')}>
            <Icon name="pencil" size={14} />
          </button>
          <button className="x" onClick={close}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            {project.name}
          </h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              {project.client || '—'}
            </span>
            {project.due && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-500)' }}>
                {t('projects.due_short', {
                  date: new Date(project.due).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }),
                })}
              </span>
            )}
            {isPrivate && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: 'var(--accent-500)',
                  color: 'var(--cream-50)',
                  padding: '2px 6px',
                  borderRadius: 3,
                }}
              >
                {t('projects.private_label')}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
              marginBottom: 18,
              padding: 12,
              background: 'var(--cream-100)',
              border: '1px solid var(--ink-100)',
              borderRadius: 8,
            }}
          >
            <Stat k={t('projects.tasks_count', { count: projectTasks.length })} v={projectTasks.length} />
            <Stat k={t('admin.load_open')} v={open} />
            <Stat k={t('admin.load_done')} v={done} />
            <Stat k={t('admin.load_logged')} v={`${fmtNum(logged)} / ${fmtNum(planned)}h`} />
          </div>

          <button className="tb-btn" onClick={openInBoard} style={{ marginBottom: 16 }}>
            <Icon name="kanban-square" size={13} /> {t('projects.open_board')}
          </button>

          <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>
            {t('projects.tasks_count', { count: projectTasks.length })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
            {projectTasks.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-500)', fontStyle: 'italic' }}>
                {t('board.list_no_tasks')}
              </div>
            ) : (
              projectTasks.slice(0, 12).map((tk) => (
                <div
                  key={tk.id}
                  onClick={() => setUI({ taskDetailId: tk.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    background: 'var(--cream-50)',
                    border: '1px solid var(--ink-100)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <span
                    className={`pill ${tk.col}`}
                    style={{ fontSize: 9, padding: '2px 6px' }}
                  >
                    {t(`column.${tk.col}` as 'column.todo')}
                  </span>
                  <span style={{ flex: 1, color: 'var(--ink-900)' }}>{tk.title}</span>
                  <Avatar id={tk.who} size={20} />
                  <span className="mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                    {fmtNum(tk.estH)}h
                  </span>
                </div>
              ))
            )}
          </div>

          <CommentsSection subjectType="project" subjectId={project.id} />
        </div>
      </div>

      {editing && <NewProjectModal existing={project} onClose={() => setEditing(false)} />}
    </>
  );
}

function Stat({ k, v }: { k: string; v: number | string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--ink-500)',
          marginBottom: 4,
        }}
      >
        {k}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
        {v}
      </div>
    </div>
  );
}
