import { useState } from 'react';
import { useStore } from '../../store/store';
import { PERSONAS } from '../../store/seed';
import type { ScreenId } from '../../store/types';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { showToast } from '../shared/Toast';

export interface SidebarProps {
  active: ScreenId;
  setActive: (id: ScreenId) => void;
  collapsed: boolean;
  setCollapsed: (updater: boolean | ((v: boolean) => boolean)) => void;
}

interface Item {
  id: ScreenId;
  label: string;
  icon: string;
  count?: number | null;
}

export function Sidebar({ active, setActive, collapsed, setCollapsed }: SidebarProps) {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const projects = useStore((s) => s.projects);
  const timer = useStore((s) => s.timer);
  const resetDemo = useStore((s) => s.resetDemo);

  const me = PERSONAS.find((p) => p.id === currentUser) ?? PERSONAS[0];

  const myTasks = tasks.filter((t) => t.who === currentUser);
  const doingCount = myTasks.filter((t) => t.col === 'doing').length;

  const running = !!timer;

  const [clicking, setClicking] = useState(false);
  const onMarkClick = () => {
    setClicking(true);
    setTimeout(() => setClicking(false), 480);
    setCollapsed((v) => !v);
  };

  const items: Item[] = [
    { id: 'week', label: 'Meine Woche', icon: 'calendar-days', count: doingCount },
    { id: 'board', label: 'Wochenboard', icon: 'kanban-square', count: null },
    { id: 'capacity', label: 'Kapazität', icon: 'gauge', count: null },
    { id: 'times', label: 'Zeiten', icon: 'clock', count: null },
    { id: 'projects', label: 'Projekte', icon: 'folder', count: projects.length },
  ];
  const itemsBottom: Item[] = [
    { id: 'mobile', label: 'Mobile-Vorschau', icon: 'smartphone' },
    { id: 'chrome', label: 'Chrome-Plugin', icon: 'puzzle' },
    { id: 'tv', label: 'TV-Dashboard', icon: 'monitor' },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sb-brand">
        <div
          className={`sb-brand-mark ${running ? 'is-running' : ''} ${clicking ? 'is-clicking' : ''}`}
          aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          role="button"
          tabIndex={0}
          onClick={onMarkClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onMarkClick();
            }
          }}
          title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        >
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#bm-bg)" />
            <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="url(#bm-stroke)" strokeOpacity="0.18" />
            <rect x="6" y="9" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="15" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="21" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
            <rect x="6" y="9" width="9" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect x="6" y="15" width="14" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect x="6" y="21" width="6" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
            <rect className="bm-live" x="20" y="14" width="4" height="4" rx="2" fill="var(--accent-600, #C85A2C)" />
            <defs>
              <linearGradient id="bm-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#1C1A17" />
                <stop offset="1" stopColor="#2A2622" />
              </linearGradient>
              <linearGradient id="bm-stroke" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="sb-brand-text">BTM</div>
      </div>

      <div className="sb-section">
        {!collapsed && <div className="sb-section-label">Arbeit</div>}
        {items.map((it) => (
          <button
            key={it.id}
            className={`sb-item ${active === it.id ? 'active' : ''}`}
            onClick={() => setActive(it.id)}
            title={it.label}
          >
            <Icon name={it.icon} size={18} className="sb-icon" />
            <span className="sb-label">{it.label}</span>
            {it.count != null && it.count > 0 && <span className="sb-count">{it.count}</span>}
          </button>
        ))}
      </div>

      <div className="sb-section" style={{ marginTop: 8 }}>
        {!collapsed && <div className="sb-section-label">Ausblick</div>}
        {itemsBottom.map((it) => (
          <button
            key={it.id}
            className={`sb-item ${active === it.id ? 'active' : ''}`}
            onClick={() => setActive(it.id)}
            title={it.label}
          >
            <Icon name={it.icon} size={18} className="sb-icon" />
            <span className="sb-label">{it.label}</span>
          </button>
        ))}
      </div>

      <div
        className="sb-foot"
        onClick={() => {
          resetDemo();
          showToast('Demo-Daten zurückgesetzt');
        }}
      >
        <Avatar id={me.id} size={28} />
        <div className="who">
          <div className="n">{me.name}</div>
          <div className="r">Demo zurücksetzen</div>
        </div>
        <Icon name="rotate-ccw" size={14} className="chev" style={{ color: 'var(--ink-500)' }} />
      </div>
    </aside>
  );
}
