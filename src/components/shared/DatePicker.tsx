// Custom-Datepicker im BTM-Design (statt nativer Browser-Picker, der je
// nach Browser unterschiedlich aussieht und nicht zu unseren CSS-Tokens
// passt).
//
// Modi:
//   • mode="date"     → liefert/akzeptiert "YYYY-MM-DD"
//   • mode="datetime" → liefert/akzeptiert "YYYY-MM-DDTHH:mm" (lokal,
//     wie native datetime-local)
//
// Verhalten:
//   • Klick auf Trigger öffnet ein Popover mit Monatskalender (Mo–So)
//   • Pfeile / Heute / Löschen oben
//   • Bei mode="datetime" zusätzlich Stunden/Minuten-Stepper unten
//   • Locale-aware (de-DE / en-US) für Wochentag- und Monatsnamen
//   • Ohne Wert → Trigger zeigt Placeholder
//   • onChange feuert sofort beim Klick auf einen Tag (date) bzw. nur via
//     Apply-Button (datetime), siehe Inline-Logik
//
// Keine externe Library — die Logik ist überschaubar (~120 LOC) und es
// vermeidet eine Bundle-Inflation um >100 kB.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useT, useLocale } from '../../i18n';

export type DatePickerMode = 'date' | 'datetime';

export interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  mode?: DatePickerMode;
  placeholder?: string;
  className?: string;
  /** Compact: kein Icon im Trigger, kleinerer Padding. Für Inline-Edit (Sessions). */
  compact?: boolean;
  /** Trigger als Mono-Font (für Drawer-Pills) */
  mono?: boolean;
  /** Wenn gesetzt: kein Lösch-Button (z.B. Pflichtfeld). */
  required?: boolean;
}

const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WEEKDAYS_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseValue(value: string | null, mode: DatePickerMode): Date | null {
  if (!value) return null;
  // ISO-Date "YYYY-MM-DD" oder datetime-local "YYYY-MM-DDTHH:mm"
  const [datePart, timePart = '00:00'] = value.split('T');
  const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
  const [hh, mm] = timePart.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  if (mode === 'datetime') return new Date(y, m - 1, d, hh || 0, mm || 0);
  return new Date(y, m - 1, d);
}

function formatValue(date: Date, mode: DatePickerMode): string {
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (mode === 'datetime') return `${base}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return base;
}

function formatDisplay(date: Date, mode: DatePickerMode, locale: 'de' | 'en'): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  if (mode === 'datetime') {
    opts.hour = '2-digit';
    opts.minute = '2-digit';
  }
  return date.toLocaleString(locale === 'en' ? 'en-US' : 'de-DE', opts);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DatePicker({
  value,
  onChange,
  mode = 'date',
  placeholder,
  className = '',
  compact = false,
  mono = false,
  required = false,
}: DatePickerProps) {
  const t = useT();
  const [locale] = useLocale();
  const parsed = useMemo(() => parseValue(value, mode), [value, mode]);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => parsed ?? new Date());
  // Bei datetime-Mode wird die Uhrzeit lokal gehalten und erst per Apply
  // committet, damit man Stunden/Minuten ändern kann ohne Picker zu schließen.
  const [draftHour, setDraftHour] = useState(() => parsed?.getHours() ?? 9);
  const [draftMinute, setDraftMinute] = useState(() => parsed?.getMinutes() ?? 0);
  const [draftDay, setDraftDay] = useState<Date | null>(parsed);
  const popRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Popover wird über React-Portal in <body> gerendert, sonst clipt sie an
  // .modal-body overflow:auto (siehe QuickStart-Modal). Position wird per
  // getBoundingClientRect aus dem Trigger berechnet und bei Scroll/Resize
  // refreshed. Defaults sind off-screen, damit der erste Render nicht
  // kurz oben links flickered.
  const [popPos, setPopPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setViewMonth(parsed ?? new Date());
    setDraftDay(parsed);
    setDraftHour(parsed?.getHours() ?? 9);
    setDraftMinute(parsed?.getMinutes() ?? 0);
  }, [open, parsed]);

  // Pop-Position berechnen + bei Scroll/Resize refreshen. 6px Spacing
  // unter dem Trigger; wenn unten kein Platz mehr ist, klappen wir
  // oberhalb auf.
  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const POP_W = 280;
      const POP_H = 360;
      const margin = 12;
      let top = r.bottom + 6;
      if (top + POP_H > window.innerHeight - margin) {
        top = Math.max(margin, r.top - POP_H - 6);
      }
      let left = r.left;
      if (left + POP_W > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - POP_W - margin);
      }
      setPopPos({ top, left });
    };
    recompute();
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
  }, [open]);

  // Outside-Klick schließt (Trigger ODER Pop sind „inside")
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Escape schließt
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Kalender-Grid für viewMonth: 6 Wochen × 7 Tage, Mo-Start
  const grid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const dow = (first.getDay() || 7) - 1; // Mo=0
    const start = new Date(first);
    start.setDate(start.getDate() - dow);
    const days: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: d, inMonth: d.getMonth() === viewMonth.getMonth() });
    }
    return days;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
    month: 'long',
    year: 'numeric',
  });

  const today = new Date();
  const weekdays = locale === 'en' ? WEEKDAYS_EN : WEEKDAYS_DE;

  const commit = (date: Date) => {
    onChange(formatValue(date, mode));
  };

  const handleDayClick = (date: Date) => {
    if (mode === 'date') {
      commit(date);
      setOpen(false);
    } else {
      // datetime: tag merken, Stunden/Minuten dazu, dann Apply per Button oder Enter
      const withTime = new Date(date);
      withTime.setHours(draftHour, draftMinute, 0, 0);
      setDraftDay(withTime);
    }
  };

  const apply = () => {
    if (!draftDay) return;
    const d = new Date(draftDay);
    d.setHours(draftHour, draftMinute, 0, 0);
    commit(d);
    setOpen(false);
  };

  const triggerLabel = parsed
    ? formatDisplay(parsed, mode, locale)
    : placeholder ?? (mode === 'datetime' ? t('common.pick_datetime') : t('common.pick_date'));

  return (
    <div className={`dp-wrap ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`dp-trigger ${compact ? 'is-compact' : ''} ${mono ? 'is-mono' : ''} ${parsed ? 'has-value' : 'is-empty'}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {!compact && <Icon name="calendar" size={12} className="dp-trigger-icon" />}
        <span className="dp-trigger-label">{triggerLabel}</span>
        {!required && parsed && (
          <span
            className="dp-trigger-clear"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }
            }}
            aria-label={t('common.delete')}
          >
            <Icon name="x" size={10} />
          </span>
        )}
      </button>

      {open && popPos && createPortal(
        <div
          ref={popRef}
          className="dp-pop"
          role="dialog"
          style={{ position: 'fixed', top: popPos.top, left: popPos.left }}
        >
          <div className="dp-head">
            <button
              type="button"
              className="dp-nav"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              aria-label={t('common.back')}
            >
              <Icon name="chevron-left" size={14} />
            </button>
            <div className="dp-head-label">{monthLabel}</div>
            <button
              type="button"
              className="dp-nav"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              aria-label={t('common.next')}
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>

          <div className="dp-weekdays">
            {weekdays.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="dp-grid">
            {grid.map((cell, i) => {
              const isToday = isSameDay(cell.date, today);
              const isSelected =
                (mode === 'date' && parsed && isSameDay(cell.date, parsed)) ||
                (mode === 'datetime' && draftDay && isSameDay(cell.date, draftDay));
              return (
                <button
                  key={i}
                  type="button"
                  className={`dp-day ${cell.inMonth ? '' : 'is-out'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleDayClick(cell.date)}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          {mode === 'datetime' && (
            <div className="dp-time">
              <Icon name="clock" size={12} className="dp-time-icon" />
              <input
                type="number"
                min={0}
                max={23}
                value={pad(draftHour)}
                onChange={(e) => setDraftHour(Math.max(0, Math.min(23, parseInt(e.target.value || '0', 10))))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') apply();
                }}
                className="dp-time-input"
                aria-label="Hour"
              />
              <span className="dp-time-sep">:</span>
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={pad(draftMinute)}
                onChange={(e) => setDraftMinute(Math.max(0, Math.min(59, parseInt(e.target.value || '0', 10))))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') apply();
                }}
                className="dp-time-input"
                aria-label="Minute"
              />
            </div>
          )}

          <div className="dp-foot">
            {!required && (
              <button
                type="button"
                className="dp-foot-btn"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {t('common.delete')}
              </button>
            )}
            <button
              type="button"
              className="dp-foot-btn"
              onClick={() => {
                const d = new Date();
                if (mode === 'datetime') {
                  d.setMinutes(0, 0, 0);
                  setDraftDay(d);
                  setDraftHour(d.getHours());
                  setDraftMinute(d.getMinutes());
                  setViewMonth(d);
                } else {
                  commit(d);
                  setOpen(false);
                }
              }}
            >
              {t('common.today')}
            </button>
            <div style={{ flex: 1 }} />
            {mode === 'datetime' && (
              <button
                type="button"
                className="dp-foot-btn is-primary"
                onClick={apply}
                disabled={!draftDay}
              >
                {t('common.apply')}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
