// Vanilla <textarea> mit Mention-Picker als Overlay. Trigger ist der
// `@`-Sentinel: sobald das Substring zwischen letztem `@` und Caret nur
// aus Word-Zeichen besteht (oder leer ist), öffnet sich das Picker-Popover.
//
// Token-Format: `@[Display Name](userId)` — sichtbarer Marker, robust
// gegen Rename, von der Render-Helper als <span class="mention-pill">
// dargestellt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AppUser } from '../../store/types';
import { Avatar } from '../shared/Avatar';
import { useT } from '../../i18n';
import { getCaretCoordinates } from '../../lib/caretCoords';

const MAX_QUERY_LEN = 30;

export interface MentionTextareaProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  users: AppUser[];
  currentUserId?: string | null;
  rows?: number;
  autoFocus?: boolean;
}

interface PickerState {
  open: boolean;
  query: string;
  triggerStart: number; // Index des `@`-Sentinels
  selectedIdx: number;
  top: number;
  left: number;
}

const CLOSED: PickerState = { open: false, query: '', triggerStart: -1, selectedIdx: 0, top: 0, left: 0 };

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  users,
  currentUserId,
  rows = 3,
  autoFocus,
}: MentionTextareaProps) {
  const t = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState<PickerState>(CLOSED);

  const filtered = useMemo(() => {
    if (!picker.open) return [] as AppUser[];
    const q = picker.query.toLowerCase();
    return users
      .filter((u) => u.id !== currentUserId)
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
      .slice(0, 7);
  }, [picker.open, picker.query, users, currentUserId]);

  const detectMention = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    const upToCaret = el.value.slice(0, caret);
    // Letztes '@' suchen, das nicht in einem schon-fertigen Token ist.
    // Heuristik: vor dem '@' muss Whitespace, Anfang oder kein Buchstabe stehen,
    // und der Substring danach darf keinen Whitespace enthalten und nicht zu lang sein.
    const at = upToCaret.lastIndexOf('@');
    if (at < 0) {
      setPicker(CLOSED);
      return;
    }
    const before = at === 0 ? '' : upToCaret.charAt(at - 1);
    const isWordBoundary = !before || /\s/.test(before);
    if (!isWordBoundary) {
      setPicker(CLOSED);
      return;
    }
    const query = upToCaret.slice(at + 1);
    if (!/^[A-Za-zÄÖÜäöüß0-9_-]{0,30}$/.test(query)) {
      setPicker(CLOSED);
      return;
    }
    if (query.length > MAX_QUERY_LEN) {
      setPicker(CLOSED);
      return;
    }
    // Kein doppeltes Token: wenn die Zeichen direkt nach dem '@' wie ein
    // bestehendes `[Name](id)` aussehen, kein Picker (User editiert grad innerhalb).
    if (el.value.slice(at, at + 2) === '@[') {
      setPicker(CLOSED);
      return;
    }
    const coords = getCaretCoordinates(el, at);
    setPicker((p) => ({
      open: true,
      query,
      triggerStart: at,
      selectedIdx: p.open && p.triggerStart === at ? p.selectedIdx : 0,
      top: coords.top + coords.height - el.scrollTop + 4,
      left: coords.left - el.scrollLeft,
    }));
  }, []);

  // Reset selectedIdx wenn query sich ändert und außerhalb der Liste fällt.
  useEffect(() => {
    if (picker.open && picker.selectedIdx >= filtered.length) {
      setPicker((p) => ({ ...p, selectedIdx: Math.max(0, filtered.length - 1) }));
    }
  }, [filtered.length, picker.open, picker.selectedIdx]);

  const insertMention = useCallback(
    (user: AppUser) => {
      const el = ref.current;
      if (!el) return;
      const caret = el.selectionStart ?? 0;
      const before = value.slice(0, picker.triggerStart);
      const after = value.slice(caret);
      const token = `@[${user.name}](${user.id}) `;
      const next = before + token + after;
      onChange(next);
      setPicker(CLOSED);
      // Caret ans Token-Ende setzen (nach dem trailing space)
      const newCaret = before.length + token.length;
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      });
    },
    [value, picker.triggerStart, onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (picker.open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPicker((p) => ({ ...p, selectedIdx: Math.min(filtered.length - 1, p.selectedIdx + 1) }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPicker((p) => ({ ...p, selectedIdx: Math.max(0, p.selectedIdx - 1) }));
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filtered[picker.selectedIdx]) {
        e.preventDefault();
        insertMention(filtered[picker.selectedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPicker(CLOSED);
        return;
      }
    }
    // Cmd/Ctrl+Enter → Submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="mt-wrap">
      <textarea
        ref={ref}
        className="mt-textarea"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detectMention();
        }}
        onKeyUp={detectMention}
        onClick={detectMention}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Mit kurzer Verzögerung schließen damit Klick auf Picker greift
          setTimeout(() => setPicker(CLOSED), 120);
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        autoFocus={autoFocus}
      />
      {picker.open && filtered.length > 0 && (
        <div
          className="mt-picker"
          style={{ top: picker.top, left: picker.left } as CSSProperties}
        >
          {filtered.map((u, i) => (
            <button
              key={u.id}
              type="button"
              className={`mt-picker-item ${i === picker.selectedIdx ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                // mousedown statt click, damit blur den Picker nicht
                // schließt bevor der Klick durchgeht
                e.preventDefault();
                insertMention(u);
              }}
              onMouseEnter={() => setPicker((p) => ({ ...p, selectedIdx: i }))}
            >
              <Avatar id={u.id} size={20} />
              <span className="mt-picker-name">{u.name}</span>
              <span className="mt-picker-email">{u.email}</span>
            </button>
          ))}
        </div>
      )}
      {picker.open && filtered.length === 0 && picker.query.length > 0 && (
        <div className="mt-picker mt-picker-empty" style={{ top: picker.top, left: picker.left }}>
          {t('comments.picker_no_results')}
        </div>
      )}
    </div>
  );
}
