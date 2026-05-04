import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { PERSONAS } from '../../store/seed';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { showToast } from '../shared/Toast';

export function PersonaSwitcher() {
  const currentUser = useStore((s) => s.currentUser);
  const setUser = useStore((s) => s.setUser);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const me = PERSONAS.find((p) => p.id === currentUser) ?? PERSONAS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="persona-dropdown" ref={ref}>
      <button className="persona-trigger" onClick={() => setOpen((o) => !o)}>
        <Avatar id={me.id} size={24} />
        <div style={{ textAlign: 'left' }}>
          <div className="nm">{me.name}</div>
          <div className="rl">{me.role}</div>
        </div>
        <Icon name="chevron-down" size={14} style={{ color: 'var(--ink-500)' }} />
      </button>
      {open && (
        <div className="persona-menu">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ink-500)',
              padding: '6px 8px',
            }}
          >
            Sicht wechseln
          </div>
          {PERSONAS.map((p) => (
            <div
              key={p.id}
              className={`item ${p.id === currentUser ? 'active' : ''}`}
              onClick={() => {
                setUser(p.id);
                setOpen(false);
                showToast(`Sicht: ${p.full}`);
              }}
            >
              <Avatar id={p.id} size={28} />
              <div style={{ flex: 1 }}>
                <div className="nm">{p.full}</div>
                <div className="rl">
                  {p.role} · {p.cap}h/Woche
                </div>
              </div>
              {p.id === currentUser && <Icon name="check" size={14} style={{ color: 'var(--accent-500)' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
