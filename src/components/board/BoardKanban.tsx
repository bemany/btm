import { useState } from 'react';
import type { DragEvent } from 'react';
import type { Task, Column, ColumnId } from '../../store/types';
import { useStore } from '../../store/store';
import { COLUMNS } from '../../store/seed';
import { Icon } from '../shared/Icon';
import { TaskCard } from './TaskCard';
import { QuickAdd } from './QuickAdd';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';

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
}: KanbanColumnProps) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const colLabel = t(`column.${col.id}` as 'column.todo');
  return (
    <div className="k-col">
      <div className="k-col-head">
        <div className="title-row">
          <span className="dot" style={{ background: col.dot }} />
          <span className="ttl">{colLabel}</span>
          <span className="ct">{tasks.length}</span>
        </div>
        <button className="add" onClick={() => setAdding(true)} title={t('board.add_task')}>
          <Icon name="plus" size={12} />
        </button>
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
        {adding && <QuickAdd col={col.id} onClose={() => setAdding(false)} />}
        {!adding && tasks.length === 0 && !dragOver && (
          <button className="k-add-btn" onClick={() => setAdding(true)}>
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
  const setUI = useStore((s) => s.setUI);
  const t = useT();
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);

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
      moveTask(dragTask.id, col);
      showToast(t('toast.moved_to', { col: t(`column.${col}` as 'column.todo') }));
    }
    setDragTask(null);
    setDragOverCol(null);
  };
  const onTaskClick = (tk: Task) => setUI({ taskDetailId: tk.id });

  return (
    <div className="kanban">
      {COLUMNS.map((col) => (
        <KanbanColumn
          key={col.id}
          col={col}
          tasks={tasks.filter((tk) => tk.col === col.id)}
          dragOver={dragOverCol === col.id}
          dragTask={dragTask}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}
