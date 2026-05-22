// F0VxDj1glFV: Zwei separate Inputs fuer Stunden und Minuten.
// Nach aussen wird ein Dezimalwert (Stunden) propagiert.
//
// Verhalten:
//   - h-Input: 0..max-hours, integer
//   - m-Input: 0..59
//   - Beim Verlassen Auto-Normalisierung (60min -> 1h)
//   - Up/Down auf m-Input bei 59 -> nach 0 + h++
//   - Compact Layout in 2 Mini-Boxes

import { useEffect, useRef, useState } from 'react';

export interface HoursMinutesInputProps {
  value: number;                  // Dezimal-Stunden (z.B. 1.5)
  onChange: (val: number) => void;
  min?: number;                   // Dezimal-Stunden, default 0
  max?: number;                   // Dezimal-Stunden, default 24
  size?: 'sm' | 'md';             // Visuelle Variante
  autoFocus?: boolean;
  onEnter?: () => void;           // Enter in Minuten-Feld
}

function splitHM(decimal: number): { h: number; m: number } {
  const totalMin = Math.max(0, Math.round(decimal * 60));
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

export function HoursMinutesInput({
  value,
  onChange,
  min = 0,
  max = 24,
  size = 'md',
  autoFocus = false,
  onEnter,
}: HoursMinutesInputProps) {
  // Lokaler String-State damit der User Zwischenstaende eingeben kann (z.B.
  // leeres Feld, "0", "01"). Erst beim Blur oder bei valider Eingabe wird
  // onChange aufgerufen.
  const initial = splitHM(value);
  const [hStr, setHStr] = useState(String(initial.h));
  const [mStr, setMStr] = useState(String(initial.m).padStart(2, '0'));
  const hRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);

  // Sync von aussen — wenn das value-Prop wechselt (z.B. via Server-Roundtrip)
  // den lokalen Display-State aktualisieren.
  useEffect(() => {
    const { h, m } = splitHM(value);
    setHStr(String(h));
    setMStr(String(m).padStart(2, '0'));
  }, [value]);

  useEffect(() => {
    if (autoFocus) hRef.current?.focus();
  }, [autoFocus]);

  const commit = (rawH: string, rawM: string) => {
    let h = parseInt(rawH || '0', 10);
    let m = parseInt(rawM || '0', 10);
    if (!isFinite(h) || h < 0) h = 0;
    if (!isFinite(m) || m < 0) m = 0;
    // 60+ Minuten -> Stunde uebernehmen
    if (m >= 60) {
      h += Math.floor(m / 60);
      m = m % 60;
    }
    const totalH = h + m / 60;
    const clamped = Math.max(min, Math.min(max, Number(totalH.toFixed(4))));
    onChange(clamped);
  };

  const onBlur = () => {
    commit(hStr, mStr);
    // Anschliessend Felder normalisieren
    const total = parseInt(hStr || '0', 10) + parseInt(mStr || '0', 10) / 60;
    const { h, m } = splitHM(total);
    setHStr(String(h));
    setMStr(String(m).padStart(2, '0'));
  };

  const cls = `hm-input ${size === 'sm' ? 'hm-input-sm' : ''}`;

  return (
    <div className={cls}>
      <input
        ref={hRef}
        type="number"
        min={0}
        max={max}
        inputMode="numeric"
        value={hStr}
        onChange={(e) => {
          setHStr(e.target.value);
          commit(e.target.value, mStr);
        }}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            mRef.current?.focus();
            mRef.current?.select();
          }
        }}
        aria-label="Stunden"
      />
      <span className="hm-input-sep">h</span>
      <input
        ref={mRef}
        type="number"
        min={0}
        max={59}
        step={5}
        inputMode="numeric"
        value={mStr}
        onChange={(e) => {
          setMStr(e.target.value);
          commit(hStr, e.target.value);
        }}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter?.();
          }
        }}
        onFocus={(e) => e.target.select()}
        aria-label="Minuten"
      />
      <span className="hm-input-sep">m</span>
    </div>
  );
}
