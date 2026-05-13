import { useEffect, useRef, useState } from 'react';
import type { ColumnId } from '../../store/types';
import { useStore } from '../../store/store';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';
import { ProjectSelect } from '../shared/ProjectSelect';
import { filterAssignableProjects } from '../../lib/projectFilters';

export interface QuickAddProps {
  col: ColumnId;
  onClose: () => void;
}

export function QuickAdd({ col, onClose }: QuickAddProps) {
  const projects = useStore((s) => s.projects);
  const currentUser = useStore((s) => s.currentUser);
  const addTask = useStore((s) => s.addTask);
  const filterProj = useStore((s) => s.filter.proj);
  const t = useT();

  const [title, setTitle] = useState('');
  // Wenn das Board auf ein bestimmtes Projekt gefiltert ist, soll der
  // Quick-Add neue Aufgaben standardmäßig in diesem Projekt anlegen — sonst
  // landet die Aufgabe im ersten Favoriten (nicht im ersten alphabetischen).
  const initialProj = (() => {
    if (filterProj && filterProj !== 'all' && projects.some((p) => p.id === filterProj)) {
      return filterProj;
    }
    const { all } = filterAssignableProjects(projects, {
      currentUserId: currentUser,
      showOnlyFavorites: true,
    });
    return all[0]?.id ?? '';
  })();
  const [proj, setProj] = useState(initialProj);
  const [estH, setEstH] = useState(1.0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!title.trim()) return onClose();
    addTask({ title: title.trim(), proj, col, estH: estH || 1, who: currentUser });
    setTitle('');
    showToast(t('toast.task_created'));
    inputRef.current?.focus();
  };

  return (
    <div className="k-quick-add" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        placeholder={t('board.quickadd_title_placeholder')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className="row">
        <ProjectSelect
          value={proj || null}
          projects={projects}
          currentUserId={currentUser}
          onChange={(v) => setProj(v ?? '')}
        />
        <input
          type="number"
          step="0.5"
          min="0.25"
          value={estH}
          onChange={(e) => setEstH(parseFloat(e.target.value))}
          style={{
            width: 50,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            border: '1px solid var(--ink-100)',
            borderRadius: 4,
            padding: '2px 4px',
            textAlign: 'center',
          }}
          title={t('board.quickadd_estimate_title')}
        />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-500)' }}>h</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 0, color: 'var(--ink-500)', fontSize: 11 }}
        >
          {t('board.quickadd_cancel_short')}
        </button>
        <button
          onClick={submit}
          style={{
            background: 'var(--accent-500)',
            color: 'var(--cream-50)',
            border: 0,
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {t('board.quickadd_create')}
        </button>
      </div>
    </div>
  );
}
