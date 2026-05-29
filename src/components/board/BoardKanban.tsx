import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import type { Task, Column, ColumnId } from '../../store/types';
import { useStore } from '../../store/store';
import { COLUMNS } from '../../store/seed';
import { Icon } from '../shared/Icon';
import { TaskCard } from './TaskCard';
import { NewTaskModal } from './NewTaskModal';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';
import { checkMarkDone } from '../../lib/taskPermissions';

// Priority-Score für Kanban-Sortierung (niedriger = weiter oben).
// 0 = überfällig, 1 = heute fällig, 2 = in nächsten 3 Tagen, 3 = später,
// 4 = ohne Frist. Erledigte (col='done') werden nicht sortiert (skip).
function duePriorityScore(task: Task): number {
  if (task.col === 'done') return 4;
  if (!task.due) return 4;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let target: Date | null = null;
  if (task.due === 'today') target = today;
  else if (task.due === 'tomorrow') {
    target = new Date(today);
    target.setDate(target.getDate() + 1);
  } else {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(task.due);
    if (m) target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if (!target) return 4;
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 0; // überfällig
  if (diffDays === 0) return 1; // heute
  if (diffDays <= 3) return 2; // bald
  return 3; // später
}

interface KanbanColumnProps {
  col: Column;
  tasks: Task[];
  dragOver: boolean;
  dragTask: Task | null;
  onDrop: (col: ColumnId) => void;
  onDragOver: (col: ColumnId) => void;
  onDragLeave: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, task: Task) => void;
  onDragEnd: () => void;
  onTaskClick: (t: Task) => void;
  onAddTask: (col: ColumnId) => void;
  onArchiveAllDone?: () => void;
}

function KanbanColumn({
  col,
  tasks,
  dragOver,
  dragTask,
  onDrop,
  onDragOver,
  onDragLeave,
  onDragStart,
  onDragEnd,
  onTaskClick,
  onAddTask,
  onArchiveAllDone,
}: KanbanColumnProps) {
  const t = useT();
  const colLabel = t(`column.${col.id}` as 'column.todo');
  return (
    <div className="k-col">
      <div className="k-col-head">
        <div className="title-row">
          <span className="dot" style={{ background: col.dot }} />
          <span className="ttl">{colLabel}</span>
          <span className="ct">{tasks.length}</span>
        </div>
        {col.id === 'done' && onArchiveAllDone && tasks.length > 0 ? (
          <button
            className="add"
            onClick={onArchiveAllDone}
            title={t('board.archive_all_done')}
            aria-label={t('board.archive_all_done')}
          >
            <Icon name="archive" size={12} />
          </button>
        ) : (
          <button className="add" onClick={() => onAddTask(col.id)} title={t('board.add_task')}>
            <Icon name="plus" size={12} />
          </button>
        )}
      </div>
      <div
        className={`k-col-body ${dragOver ? 'drop-target' : ''} ${tasks.length === 0 && dragOver ? 'empty' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver(col.id);
        }}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(col.id);
        }}
      >
        {tasks.map((tk) => (
          <TaskCard
            key={tk.id}
            task={tk}
            dragging={dragTask?.id === tk.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onTaskClick(tk)}
          />
        ))}
        {tasks.length === 0 && !dragOver && (
          <button className="k-add-btn" onClick={() => onAddTask(col.id)}>
            <Icon name="plus" size={12} /> {t('board.add_task')}
          </button>
        )}
      </div>
    </div>
  );
}

export interface BoardKanbanProps {
  tasks: Task[];
}

export function BoardKanban({ tasks }: BoardKanbanProps) {
  const moveTask = useStore((s) => s.moveTask);
  const projects = useStore((s) => s.projects);
  const currentUser = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const setUI = useStore((s) => s.setUI);
  const t = useT();
  // Berechtigung: nur der Projekt-Owner oder ein Admin darf Aufgaben auf
  // 'done' setzen. Admin bekommt einen Confirm-Dialog wenn er nicht selbst
  // Owner ist (F0vR8mfjrwv) — vorher konnten Admins Reviews stumm durch-
  // schwitzen ohne dass der Owner es bemerkt hat.
  const meIsAdmin = users.find((u) => u.id === currentUser)?.role === 'admin';
  const resolveOwnerName = (ownerId: string) => users.find((u) => u.id === ownerId)?.name ?? null;
  const guardMarkDone = (task: Task): boolean => {
    const perm = checkMarkDone(
      { task, projects, currentUserId: currentUser, meIsAdmin },
      resolveOwnerName,
    );
    if (perm.kind === 'allow') return true;
    if (perm.kind === 'blocked') {
      showToast(t('toast.only_owner_can_mark_done'));
      return false;
    }
    // admin_override → Confirm
    const msg = perm.ownerName
      ? t('toast.admin_confirm_done', { owner: perm.ownerName })
      : t('toast.admin_confirm_done_no_owner');
    return window.confirm(msg);
  };
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);
  // FuO6j_tbUS5: Modal statt Inline-Tile. null = geschlossen.
  const [newTaskCol, setNewTaskCol] = useState<ColumnId | null>(null);

  const onDragStart = (e: DragEvent<HTMLDivElement>, task: Task) => {
    setDragTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };
  const onDragEnd = () => {
    setDragTask(null);
    setDragOverCol(null);
  };
  const onDragOver = (col: ColumnId) => {
    if (col !== dragOverCol) setDragOverCol(col);
  };
  const onDragLeave = () => {
    /* keep highlight */
  };
  const onDrop = (col: ColumnId) => {
    if (!dragTask) return;
    if (dragTask.col !== col) {
      // Permission-Check für 'done' — Toast/Confirm wird in guardMarkDone gehandhabt.
      if (col === 'done' && !guardMarkDone(dragTask)) {
        setDragTask(null);
        setDragOverCol(null);
        return;
      }
      moveTask(dragTask.id, col);
      showToast(t('toast.moved_to', { col: t(`column.${col}` as 'column.todo') }));
    }
    setDragTask(null);
    setDragOverCol(null);
  };
  const onTaskClick = (tk: Task) => setUI({ taskDetailId: tk.id });

  // FUxfszEfNN5: Sortier-Modus pro Kanban-Spalte. Default ist due+prio (siehe
   // duePriorityScore), aber der User kann nach Erstellungsdatum sortieren
   // damit alte unerledigte Aufgaben sichtbar werden.
  type SortMode = 'default' | 'created_asc' | 'created_desc';
  const [sortMode, setSortModeState] = useState<SortMode>(() => {
    try {
      const v = localStorage.getItem('btm.kanban.sort');
      if (v === 'created_asc' || v === 'created_desc' || v === 'default') return v;
    } catch {
      /* ignore */
    }
    return 'default';
  });
  const setSortMode = (m: SortMode) => {
    setSortModeState(m);
    try {
      localStorage.setItem('btm.kanban.sort', m);
    } catch {
      /* ignore */
    }
  };

  // Pro Spalte vorsortieren: Default = due-Priority + Task-Priority;
  // sonst nach createdAt asc/desc.
  const tasksByCol = useMemo(() => {
    const prioWeight = { high: 0, med: 1, low: 2 } as const;
    const byCol = new Map<ColumnId, Task[]>();
    for (const col of COLUMNS) byCol.set(col.id, []);
    for (const tk of tasks) {
      const list = byCol.get(tk.col);
      if (list) list.push(tk);
    }
    for (const [, list] of byCol) {
      list.sort((a, b) => {
        if (sortMode === 'created_asc' || sortMode === 'created_desc') {
          const ca = a.createdAt ?? 0;
          const cb = b.createdAt ?? 0;
          return sortMode === 'created_asc' ? ca - cb : cb - ca;
        }
        const ds = duePriorityScore(a) - duePriorityScore(b);
        if (ds !== 0) return ds;
        const pp = (prioWeight[a.prio] ?? 1) - (prioWeight[b.prio] ?? 1);
        if (pp !== 0) return pp;
        return 0;
      });
    }
    return byCol;
  }, [tasks, sortMode]);

  const archiveTask = useStore((s) => s.archiveTask);
  const onArchiveAllDone = async () => {
    const done = tasksByCol.get('done') ?? [];
    if (done.length === 0) return;
    if (!window.confirm(t('board.archive_all_done_confirm', { count: done.length }))) return;
    // Sequenziell um Race-Conditions im Store zu vermeiden.
    for (const tk of done) {
      try {
        await archiveTask(tk.id);
      } catch (e) {
        console.warn('archive failed', tk.id, e);
      }
    }
    showToast(t('board.archive_all_done_toast', { count: done.length }));
  };

  return (
    <div className="kanban-wrap">
      <div className="kanban-sort-bar">
        <label htmlFor="kanban-sort-select" className="kanban-sort-label">
          {t('board.kanban_sort_label')}
        </label>
        <select
          id="kanban-sort-select"
          className="kanban-sort-select"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
        >
          <option value="default">{t('board.kanban_sort_default')}</option>
          <option value="created_desc">{t('board.kanban_sort_created_desc')}</option>
          <option value="created_asc">{t('board.kanban_sort_created_asc')}</option>
        </select>
      </div>
      <div className="kanban">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.id}
          col={col}
          tasks={tasksByCol.get(col.id) ?? []}
          dragOver={dragOverCol === col.id}
          dragTask={dragTask}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onTaskClick={onTaskClick}
          onAddTask={(c) => setNewTaskCol(c)}
          onArchiveAllDone={col.id === 'done' ? onArchiveAllDone : undefined}
        />
      ))}
      {newTaskCol && (
        <NewTaskModal col={newTaskCol} onClose={() => setNewTaskCol(null)} />
      )}
      </div>
    </div>
  );
}
