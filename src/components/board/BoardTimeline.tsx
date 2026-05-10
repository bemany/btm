// Wochenboard → Timeline-Ansicht.
//
// Pro Person eine Zeile, pro Wochentag (Mo-Fr) eine Spalte + „Ohne Frist".
// Tasks lassen sich zwischen Tagen (= Frist verschieben) und zwischen
// Personen (= Bearbeiter wechseln) draggen. Die Timeline kann zwischen
// Wochen navigieren — der Wochenanker bestimmt nur das Mapping „Frist
// → Tag-Index", die Task-Liste selbst bleibt dieselbe.
//
// Status-Chip pro Karte zeigt die aktuelle Spalte (Backlog/In Arbeit/…).

import { useState, type CSSProperties, type DragEvent } from 'react';
import type { Task } from '../../store/types';
import { useStore } from '../../store/store';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { useT, useLocale } from '../../i18n';

export interface BoardTimelineProps {
  tasks: Task[];
}

// Liefert den Tag-Index 0-4 (Mo-Fr) für eine Task relativ zu einem
// Wochenanker, oder -1 wenn keine Frist gesetzt / Frist außerhalb der
// Woche / ungültiges Format.
function dueDayIndex(due: string | null | undefined, weekStart: Date): number {
  if (!due) return -1;
  // 'today'/'tomorrow' nur sinnvoll bei „aktueller" Woche — wir mappen sie
  // immer auf den ersten/zweiten Tag des aktuell sichtbaren Anker-Wochenstarts.
  if (due === 'today') return 0;
  if (due === 'tomorrow') return 1;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return -1;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = Math.round((target.getTime() - weekStart.getTime()) / 86400000);
  if (days < 0 || days > 4) return -1;
  return days;
}

function mondayOfDate(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() || 7) - 1;
  out.setDate(out.getDate() - dow);
  return out;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoWeek(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

const COLUMN_TONE: Record<string, string> = {
  todo: 'var(--ink-500)',
  planned: '#7A9CC8',
  doing: 'var(--accent-500)',
  review: '#C8A04C',
  done: '#5E7F4E',
};

export function BoardTimeline({ tasks }: BoardTimelineProps) {
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const setUI = useStore((s) => s.setUI);
  const updateTask = useStore((s) => s.updateTask);
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  // Wochenanker — Default: aktuelle Woche (Lokal)
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOfDate(new Date()));
  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(mondayOfDate(new Date()));
  const fmtDay = (d: Date) =>
    d.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', { day: '2-digit', month: '2-digit' });
  const friday = new Date(weekStart);
  friday.setDate(friday.getDate() + 4);
  const kw = isoWeek(weekStart);

  const dayDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const dayLabels = [
    t('board.timeline_day_mo'),
    t('board.timeline_day_di'),
    t('board.timeline_day_mi'),
    t('board.timeline_day_do'),
    t('board.timeline_day_fr'),
  ];

  // Drag-State
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const onDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    setDragId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };
  const onDragEnd = () => {
    setDragId(null);
    setDragOverCell(null);
  };
  const onCellDragOver = (e: DragEvent<HTMLDivElement>, cellKey: string) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (cellKey !== dragOverCell) setDragOverCell(cellKey);
  };
  const onCellDrop = (
    e: DragEvent<HTMLDivElement>,
    targetPersonId: string,
    targetDayIdx: number, // -1 = "Ohne Frist"
  ) => {
    e.preventDefault();
    if (!dragId) return;
    const tk = tasks.find((x) => x.id === dragId);
    if (!tk) return;
    const patch: Partial<Task> = {};
    if (tk.who !== targetPersonId) patch.who = targetPersonId;
    let newDue: string | null;
    if (targetDayIdx === -1) {
      newDue = null;
    } else {
      newDue = isoDate(dayDates[targetDayIdx]);
    }
    if (tk.due !== newDue && (tk.due ?? null) !== newDue) {
      patch.due = newDue;
    }
    if (Object.keys(patch).length > 0) {
      void updateTask(tk.id, patch);
    }
    setDragId(null);
    setDragOverCell(null);
  };

  const byPerson: Record<string, Task[]> = {};
  tasks.forEach((tk) => {
    if (!byPerson[tk.who]) byPerson[tk.who] = [];
    byPerson[tk.who].push(tk);
  });

  const renderCard = (tk: Task) => {
    const projColor = projects.find((p) => p.id === tk.proj)?.color ?? 'var(--ink-300)';
    const tone = COLUMN_TONE[tk.col] ?? 'var(--ink-500)';
    return (
      <div
        key={tk.id}
        className={`tl-card ${dragId === tk.id ? 'is-dragging' : ''}`}
        draggable
        onDragStart={(e) => onDragStart(e, tk.id)}
        onDragEnd={onDragEnd}
        onClick={() => setUI({ taskDetailId: tk.id })}
        style={{
          ['--proj-color' as keyof CSSProperties]: projColor,
          ['--col-tone' as keyof CSSProperties]: tone,
        } as CSSProperties}
      >
        <div className="tl-card-head">
          <span className="tl-card-status" style={{ background: tone }}>
            {t(`column.${tk.col}` as 'column.todo')}
          </span>
          <span className="tl-card-hours">{fmtNum(tk.estH)}h</span>
        </div>
        <div className="tl-card-title">
          {tk.title.slice(0, 50)}
          {tk.title.length > 50 ? '…' : ''}
        </div>
      </div>
    );
  };

  return (
    <div className="tl-wrap">
      <div className="tl-toolbar">
        <div className="tl-nav">
          <button
            type="button"
            className="tl-nav-btn"
            onClick={() => shiftWeek(-7)}
            title={t('times.prev_week')}
            aria-label={t('times.prev_week')}
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <div className="tl-nav-label">
            <span className="tl-nav-kw">KW {kw}</span>
            <span className="tl-nav-range">
              {fmtDay(weekStart)} – {fmtDay(friday)}
            </span>
          </div>
          <button
            type="button"
            className="tl-nav-btn"
            onClick={() => shiftWeek(7)}
            title={t('times.next_week')}
            aria-label={t('times.next_week')}
          >
            <Icon name="chevron-right" size={14} />
          </button>
          <button type="button" className="tl-nav-today" onClick={goToday}>
            {t('common.today')}
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <div className="tl-hint">{t('board.timeline_drag_hint')}</div>
      </div>

      <div className="tl-grid">
        <div className="tl-grid-head">
          <div className="tl-grid-head-cell">{t('board.timeline_person')}</div>
          {dayLabels.map((d, i) => (
            <div key={d} className="tl-grid-head-cell">
              <div className="tl-grid-head-day">{d}</div>
              <div className="tl-grid-head-date">{fmtDay(dayDates[i])}</div>
            </div>
          ))}
          <div className="tl-grid-head-cell tl-no-due">{t('board.timeline_no_due')}</div>
        </div>

        {Object.keys(byPerson).map((personId) => {
          const person = users.find((u) => u.id === personId);
          const list = byPerson[personId];
          const buckets: Task[][] = [[], [], [], [], [], []];
          for (const tk of list) {
            const di = dueDayIndex(tk.due, weekStart);
            buckets[di < 0 ? 5 : di].push(tk);
          }
          return (
            <div key={personId} className="tl-row">
              <div className="tl-row-person">
                <Avatar id={personId} size={24} />
                <div>
                  <div className="tl-row-name">{person?.name ?? '—'}</div>
                  <div className="tl-row-cap">
                    {t('board.timeline_cap_per_week', { cap: person?.cap ?? 0 })}
                  </div>
                </div>
              </div>
              {dayLabels.map((d, i) => {
                const cellKey = `${personId}-${i}`;
                return (
                  <div
                    key={d}
                    className={`tl-cell ${dragOverCell === cellKey ? 'is-drop-target' : ''}`}
                    onDragOver={(e) => onCellDragOver(e, cellKey)}
                    onDragLeave={() => {
                      if (dragOverCell === cellKey) setDragOverCell(null);
                    }}
                    onDrop={(e) => onCellDrop(e, personId, i)}
                  >
                    {buckets[i].map(renderCard)}
                  </div>
                );
              })}
              {(() => {
                const cellKey = `${personId}-nodue`;
                return (
                  <div
                    className={`tl-cell tl-cell-nodue ${dragOverCell === cellKey ? 'is-drop-target' : ''}`}
                    onDragOver={(e) => onCellDragOver(e, cellKey)}
                    onDragLeave={() => {
                      if (dragOverCell === cellKey) setDragOverCell(null);
                    }}
                    onDrop={(e) => onCellDrop(e, personId, -1)}
                  >
                    {buckets[5].map(renderCard)}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
