// F44rPspkp5z: Multi-Tag-Picker für `plannedFor`. Eine Reihe Pillen für die
// nächsten zwei Werktag-Wochen (Mo-Fr); Klick toggled an/aus. Auswahl als
// ISO-Date-Strings (YYYY-MM-DD). Leer = Fallback auf Frist gilt.

import { useMemo } from 'react';
import { useT, useLocale } from '../../i18n';

export interface PlannedDaysPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOfDate(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() || 7) - 1;
  out.setDate(out.getDate() - dow);
  return out;
}

export function PlannedDaysPicker({ value, onChange }: PlannedDaysPickerProps) {
  const t = useT();
  const [locale] = useLocale();
  const selectedSet = useMemo(() => new Set(value), [value]);

  // Zwei Wochen Mo-Fr ab dem Montag der aktuellen Woche.
  const days = useMemo(() => {
    const monday = mondayOfDate(new Date());
    const out: { iso: string; label: string; subLabel: string; isWeekStart: boolean }[] = [];
    for (let week = 0; week < 2; week++) {
      for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + week * 7 + i);
        out.push({
          iso: isoDate(d),
          label: d.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', { weekday: 'short' }),
          subLabel: d.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
            day: '2-digit',
            month: '2-digit',
          }),
          isWeekStart: i === 0,
        });
      }
    }
    return out;
  }, [locale]);

  const toggle = (iso: string) => {
    const next = new Set(selectedSet);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    onChange(Array.from(next).sort());
  };
  const clearAll = () => onChange([]);

  return (
    <div className="planned-picker">
      <div className="planned-picker-head">
        <span className="planned-picker-label">{t('planned.label')}</span>
        <span className="planned-picker-hint">{t('planned.hint')}</span>
        {value.length > 0 && (
          <button type="button" className="planned-picker-clear" onClick={clearAll}>
            {t('planned.clear')}
          </button>
        )}
      </div>
      <div className="planned-picker-grid">
        {days.map((d) => {
          const active = selectedSet.has(d.iso);
          return (
            <button
              key={d.iso}
              type="button"
              className={`planned-picker-pill ${active ? 'is-active' : ''} ${d.isWeekStart ? 'is-week-start' : ''}`}
              onClick={() => toggle(d.iso)}
              title={d.iso}
            >
              <span className="planned-picker-dow">{d.label}</span>
              <span className="planned-picker-date">{d.subLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
