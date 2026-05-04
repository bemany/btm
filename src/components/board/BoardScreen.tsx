import { useMemo } from 'react';
import type { LayoutMode } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { BoardKanban } from './BoardKanban';
import { BoardList } from './BoardList';
import { BoardTimeline } from './BoardTimeline';
import { FilterRow } from './FilterRow';

const LAYOUTS: Array<{ id: LayoutMode; icon: string; label: string }> = [
  { id: 'kanban', icon: 'kanban-square', label: 'Kanban' },
  { id: 'list', icon: 'list', label: 'Liste' },
  { id: 'timeline', icon: 'calendar-range', label: 'Timeline' },
];

export function BoardScreen() {
  const tasks = useStore((s) => s.tasks);
  const filter = useStore((s) => s.filter);
  const currentUser = useStore((s) => s.currentUser);
  const layout = useStore((s) => s.ui.layout);
  const setLayout = useStore((s) => s.setLayout);

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter.who === 'mine') list = list.filter((t) => t.who === currentUser);
    if (filter.proj !== 'all') list = list.filter((t) => t.proj === filter.proj);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [tasks, filter, currentUser]);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">02 · Wochenboard</div>
          <h1>KW 19 · {filtered.length} Aufgaben</h1>
          <div className="subtitle">
            Drag-and-Drop zwischen Spalten · Klick auf Karte öffnet Details · Inline-Add über „+" pro Spalte.
          </div>
        </div>
        <div className="right">
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--cream-100)',
              border: '1px solid var(--ink-200)',
              borderRadius: 6,
              padding: 2,
            }}
          >
            {LAYOUTS.map((o) => (
              <button
                key={o.id}
                onClick={() => setLayout(o.id)}
                style={{
                  border: 0,
                  background: layout === o.id ? 'var(--ink-900)' : 'transparent',
                  color: layout === o.id ? 'var(--cream-50)' : 'var(--ink-700)',
                  padding: '5px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Icon name={o.icon} size={12} /> {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <FilterRow />

      <div style={{ flex: 1, minHeight: 0 }}>
        {layout === 'kanban' && <BoardKanban tasks={filtered} />}
        {layout === 'list' && <BoardList tasks={filtered} />}
        {layout === 'timeline' && <BoardTimeline tasks={filtered} />}
      </div>
    </div>
  );
}
