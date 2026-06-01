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
import { NewTaskModal } from './NewTaskModal';

export interface BoardTimelineProps {
  tasks: Task[];
}

// Liefert für eine Task einen der drei Zustände:
//   - 0-4   Tag-Index Mo-Fr in der Woche von weekStart
//   - 'no-due'     keine Frist gesetzt (gehört in den 'Ohne Frist'-Bucket)
//   - 'out-of-week' Frist liegt außerhalb [Mo-Fr] dieser Woche
//                   → Task wird in dieser Wochen-View gar nicht angezeigt.
// Bug FqpkOtaAV67: vorher returnte das Funktion -1 für BEIDE Fälle und
// 'out-of-week'-Tasks landeten fälschlich im 'Ohne Frist'-Bucket der
// nächsten Woche. Jetzt sauber getrennt.
type DuePlacement = number | 'no-due' | 'out-of-week';
function dueDayIndex(due: string | null | undefined, weekStart: Date): DuePlacement {
  if (!due) return 'no-due';
  // 'today'/'tomorrow' nur sinnvoll bei „aktueller" Woche — wir mappen sie
  // immer auf den ersten/zweiten Tag des aktuell sichtbaren Anker-Wochenstarts.
  if (due === 'today') return 0;
  if (due === 'tomorrow') return 1;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return 'no-due'; // ungültiges Format wie keine Frist behandeln
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = Math.round((target.getTime() - weekStart.getTime()) / 86400000);
  if (days < 0 || days > 4) return 'out-of-week';
  return days;
}

// F44rPspkp5z: In welchen Tag-Buckets der Wochenansicht soll die Task
// auftauchen? plannedFor (falls gesetzt) hat Vorrang ueber due. Sind alle
// Plantage ausserhalb dieser Woche → leer, Task waere gar nicht sichtbar
// (wir fallen NICHT auf die Frist zurueck, weil der User aktiv geplant hat).
type BucketKey = number | 'no-due';
function bucketKeysForTask(tk: Task, weekStart: Date): BucketKey[] {
  if (tk.plannedFor && tk.plannedFor.length > 0) {
    const out: BucketKey[] = [];
    for (const d of tk.plannedFor) {
      const di = dueDayIndex(d, weekStart);
      if (typeof di === 'number') out.push(di);
    }
    return out;
  }
  const di = dueDayIndex(tk.due, weekStart);
  if (di === 'out-of-week') return [];
  return [di];
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
  // F9hw8vcx3ci: erledigte Aufgaben standardmaessig ausblenden, weil sie
  // sonst die „Ohne Frist"-Spalte zumuellen. Toggle persistiert in
  // localStorage damit der User die Praeferenz behaelt.
  const [showCompleted, setShowCompletedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('btm.timeline.showCompleted') === '1';
    } catch {
      return false;
    }
  });
  const setShowCompleted = (next: boolean) => {
    setShowCompletedState(next);
    try {
      localStorage.setItem('btm.timeline.showCompleted', next ? '1' : '0');
    } catch {
      // localStorage kann in Privat-Tabs werfen — egal, State haelt
    }
  };
  const visibleTasks = showCompleted ? tasks : tasks.filter((tk) => tk.col !== 'done');
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

  // Drag-State. F44rPspkp5z: wir tracken zusaetzlich den Source-Bucket-Index
  // damit Multi-Tag-Plan-Verschiebungen sauber funktionieren (alter Tag raus,
  // neuer Tag rein, restliche Plan-Tage bleiben).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragSourceDayIdx, setDragSourceDayIdx] = useState<number | -1 | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // FXjEEm5q-_l: Neue-Aufgabe-Modal direkt aus einer Tageszelle. Speichert
  // wer + welcher Tag schon vorausgefuellt sind. null = geschlossen.
  const [newTaskFor, setNewTaskFor] = useState<{ assignee: string; due: string | null } | null>(null);

  const onDragStart = (e: DragEvent<HTMLDivElement>, taskId: string, sourceDayIdx: number | -1) => {
    setDragId(taskId);
    setDragSourceDayIdx(sourceDayIdx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };
  const onDragEnd = () => {
    setDragId(null);
    setDragSourceDayIdx(null);
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

    const hasPlanned = !!tk.plannedFor && tk.plannedFor.length > 0;
    const targetIso = targetDayIdx === -1 ? null : isoDate(dayDates[targetDayIdx]);
    const sourceIso =
      dragSourceDayIdx !== null && dragSourceDayIdx !== -1
        ? isoDate(dayDates[dragSourceDayIdx])
        : null;

    if (hasPlanned) {
      // F44rPspkp5z: Multi-Tag-Modus. Drag entfernt den Source-Tag und fuegt
      // den Target-Tag hinzu (oder collapsed auf "ohne Frist"-Spalte).
      const current = new Set(tk.plannedFor ?? []);
      if (sourceIso) current.delete(sourceIso);
      if (targetIso) current.add(targetIso);
      const nextPlanned = Array.from(current).sort();
      const prev = (tk.plannedFor ?? []).slice().sort();
      const changed =
        nextPlanned.length !== prev.length ||
        nextPlanned.some((d, i) => d !== prev[i]);
      if (changed) patch.plannedFor = nextPlanned;
    } else {
      // Klassischer Modus: due wechselt. Backwards-compatible mit allem was
      // vor 0.13.3 erstellt wurde.
      if ((tk.due ?? null) !== targetIso) patch.due = targetIso;
    }

    if (Object.keys(patch).length > 0) {
      void updateTask(tk.id, patch);
    }
    setDragId(null);
    setDragSourceDayIdx(null);
    setDragOverCell(null);
  };

  const byPerson: Record<string, Task[]> = {};
  visibleTasks.forEach((tk) => {
    if (!byPerson[tk.who]) byPerson[tk.who] = [];
    byPerson[tk.who].push(tk);
  });

  // F44rPspkp5z: Tagessumme. plannedFor mit mehreren Tagen → estH wird
  // pro Plan-Tag voll gezaehlt (der User plant explizit „diesen Tag dafuer").
  // F9hw8vcx3ci: erledigte sind via visibleTasks raus wenn Toggle aus ist.
  const dayTotalsH = [0, 0, 0, 0, 0];
  let noDueTotalH = 0;
  for (const tk of visibleTasks) {
    const keys = bucketKeysForTask(tk, weekStart);
    for (const k of keys) {
      if (k === 'no-due') noDueTotalH += tk.estH;
      else dayTotalsH[k] += tk.estH;
    }
  }
  // Counter neben dem Toggle: wie viele done-Tasks sind gerade ausgeblendet?
  // Hier zaehlen wir Tasks (nicht Bucket-Einsätze) — eine Multi-Tag-Done-Task
  // ist immer noch eine einzige verborgene Aufgabe.
  const hiddenCompletedCount = showCompleted
    ? 0
    : tasks.filter((tk) => tk.col === 'done' && bucketKeysForTask(tk, weekStart).length > 0).length;

  const renderCard = (tk: Task, sourceDayIdx: number | -1) => {
    const projColor = projects.find((p) => p.id === tk.proj)?.color ?? 'var(--ink-300)';
    const tone = COLUMN_TONE[tk.col] ?? 'var(--ink-500)';
    // F44rPspkp5z: Frist-Label nur zeigen wenn due gesetzt UND der aktuelle
    // Plan-Tag != der Frist-Tag (sonst doppelt-info). Bei "Ohne Frist"-Bucket
    // (sourceDayIdx -1) und vorhandenem due zeigen wir das Datum auch.
    const dueIdx = dueDayIndex(tk.due, weekStart);
    const showDueLabel =
      !!tk.due &&
      ((sourceDayIdx !== -1 && dueIdx !== sourceDayIdx) || sourceDayIdx === -1);
    // Multi-Tag-Hinweis: wenn mehrere Plan-Tage gesetzt sind, kleine Anzeige
    // "Tag X/Y" damit der User sieht: dieser Card erscheint auch woanders.
    const planned = tk.plannedFor ?? [];
    const showMultiTag = planned.length > 1;
    let multiTagPos = 0;
    if (showMultiTag && sourceDayIdx !== -1) {
      const todayIso = isoDate(dayDates[sourceDayIdx]);
      const sorted = [...planned].sort();
      multiTagPos = sorted.indexOf(todayIso) + 1;
    }
    const fmtDueLabel = (): string => {
      if (!tk.due) return '';
      if (tk.due === 'today') return t('common.today');
      if (tk.due === 'tomorrow') return t('common.tomorrow');
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tk.due);
      if (!m) return '';
      return `${m[3]}.${m[2]}.`;
    };
    return (
      <div
        key={`${tk.id}-${sourceDayIdx}`}
        className={`tl-card ${dragId === tk.id ? 'is-dragging' : ''}`}
        draggable
        onDragStart={(e) => onDragStart(e, tk.id, sourceDayIdx)}
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
        {(showDueLabel || showMultiTag) && (
          <div className="tl-card-meta">
            {showDueLabel && (
              <span
                className="tl-card-due"
                title={t('board.timeline_due_title', { date: fmtDueLabel() })}
              >
                <Icon name="flag" size={9} /> {fmtDueLabel()}
              </span>
            )}
            {showMultiTag && multiTagPos > 0 && (
              <span
                className="tl-card-multi"
                title={t('board.timeline_multi_title', {
                  pos: multiTagPos,
                  total: planned.length,
                })}
              >
                {multiTagPos}/{planned.length}
              </span>
            )}
          </div>
        )}
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
        <button
          type="button"
          className={`tl-toggle ${showCompleted ? 'is-active' : ''}`}
          onClick={() => setShowCompleted(!showCompleted)}
          title={
            showCompleted
              ? t('board.timeline_hide_completed_title')
              : t('board.timeline_show_completed_title', { count: hiddenCompletedCount })
          }
        >
          <Icon name={showCompleted ? 'eye' : 'eye-off'} size={12} />
          <span>
            {showCompleted
              ? t('board.timeline_completed_shown')
              : t('board.timeline_completed_hidden', { count: hiddenCompletedCount })}
          </span>
        </button>
        <div className="tl-hint">{t('board.timeline_drag_hint')}</div>
      </div>

      <div className="tl-grid">
        <div className="tl-grid-head">
          <div className="tl-grid-head-cell">{t('board.timeline_person')}</div>
          {dayLabels.map((d, i) => (
            <div key={d} className="tl-grid-head-cell">
              <div className="tl-grid-head-day">{d}</div>
              <div className="tl-grid-head-date-row">
                <span className="tl-grid-head-date">{fmtDay(dayDates[i])}</span>
                <button
                  type="button"
                  className="tl-grid-head-add"
                  title={t('board.timeline_add_for_day', { day: fmtDay(dayDates[i]) })}
                  aria-label={t('board.timeline_add_for_day', { day: fmtDay(dayDates[i]) })}
                  onClick={() => setNewTaskFor({ assignee: '', due: isoDate(dayDates[i]) })}
                >
                  <Icon name="plus" size={11} />
                </button>
              </div>
              {dayTotalsH[i] > 0 && (
                <div
                  className="tl-grid-head-sum"
                  title={t('board.timeline_day_total_title', { hours: fmtNum(dayTotalsH[i]) })}
                >
                  {fmtNum(dayTotalsH[i])}h
                </div>
              )}
            </div>
          ))}
          <div className="tl-grid-head-cell tl-no-due">
            <div className="tl-grid-head-date-row">
              <span>{t('board.timeline_no_due')}</span>
              <button
                type="button"
                className="tl-grid-head-add"
                title={t('board.timeline_add_no_due')}
                aria-label={t('board.timeline_add_no_due')}
                onClick={() => setNewTaskFor({ assignee: '', due: null })}
              >
                <Icon name="plus" size={11} />
              </button>
            </div>
            {noDueTotalH > 0 && (
              <div
                className="tl-grid-head-sum"
                title={t('board.timeline_day_total_title', { hours: fmtNum(noDueTotalH) })}
              >
                {fmtNum(noDueTotalH)}h
              </div>
            )}
          </div>
        </div>

        {Object.keys(byPerson).map((personId) => {
          const person = users.find((u) => u.id === personId);
          const list = byPerson[personId];
          const buckets: Task[][] = [[], [], [], [], [], []];
          for (const tk of list) {
            const keys = bucketKeysForTask(tk, weekStart);
            for (const k of keys) {
              buckets[k === 'no-due' ? 5 : k].push(tk);
            }
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
                    {buckets[i].map((tk) => renderCard(tk, i))}
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
                    {buckets[5].map((tk) => renderCard(tk, -1))}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {newTaskFor && (
        <NewTaskModal
          col="todo"
          initialDue={newTaskFor.due}
          initialAssignee={newTaskFor.assignee}
          onClose={() => setNewTaskFor(null)}
        />
      )}
    </div>
  );
}
