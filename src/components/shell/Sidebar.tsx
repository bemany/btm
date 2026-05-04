import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import type { ScreenId, ThemeMode } from '../../store/types';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';

export interface SidebarProps {
  active: ScreenId;
  setActive: (id: ScreenId) => void;
  collapsed: boolean;
  setCollapsed: (updater: boolean | ((v: boolean) => boolean)) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

interface Item {
  id: ScreenId;
  label: string;
  icon: string;
  count?: number | null;
}

export function Sidebar({ active, setActive, collapsed, setCollapsed, theme, setTheme }: SidebarProps) {
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const projects = useStore((s) => s.projects);
  const timer = useStore((s) => s.timer);
  const resetDemo = useStore((s) => s.resetDemo);
  const { user, signOut } = useAuth();

  // Anzeige im Foot priorisiert echten eingeloggten User; Initial = erste 2 Buchstaben des Namens
  const displayName = user?.name ?? '—';
  const displayEmail = user?.email ?? '';
  const initials = (user?.name ?? '?').slice(0, 2).toUpperCase();
  const avatarColor = user?.color ?? '#6B6359';
  const isAdmin = user?.role === 'admin';

  const myTasks = tasks.filter((t) => t.who === currentUser);
  const doingCount = myTasks.filter((t) => t.col === 'doing').length;

  const running = !!timer;

  const [clicking, setClicking] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [profileOpen]);
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

      <div className="sb-foot-wrap" ref={profileRef}>
        <div
          className={`sb-foot ${profileOpen ? 'is-open' : ''}`}
          onClick={() => setProfileOpen((o) => !o)}
          role="button"
          tabIndex={0}
        >
          <span
            className="sb-foot-avatar"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'inline-grid',
              placeItems: 'center',
              background: avatarColor,
              color: '#FAF7F2',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </span>
          <div className="who">
            <div className="n">
              {displayName}
              {isAdmin && (
                <span
                  className="sb-foot-admin-badge"
                  style={{
                    marginLeft: 6,
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    background: 'var(--accent-500)',
                    color: 'var(--cream-50)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    verticalAlign: 'middle',
                  }}
                >
                  Admin
                </span>
              )}
            </div>
            <div className="r">{theme === 'glass' ? 'Glass-Modus' : 'Studio-Modus'}</div>
          </div>
          <Icon
            name={profileOpen ? 'chevron-down' : 'chevron-up'}
            size={14}
            className="chev"
            style={{ color: 'var(--ink-500)' }}
          />
        </div>

        {profileOpen && (
          <div className="sb-profile-menu">
            {user && (
              <>
                <div className="sb-profile-userhead">
                  <div className="sb-profile-userhead-name">{user.name}</div>
                  <div className="sb-profile-userhead-mail">{user.email}</div>
                </div>
                <div className="sb-profile-divider" />
              </>
            )}

            <div className="sb-profile-section-label">Aussehen</div>
            <button
              className={`sb-profile-item ${theme === 'glass' ? 'active' : ''}`}
              onClick={() => {
                setTheme('glass');
                showToast('Glass-Modus aktiv');
              }}
            >
              <span className="sb-profile-swatch glass" />
              <div className="sb-profile-item-text">
                <div className="sb-profile-item-title">Glass</div>
                <div className="sb-profile-item-sub">Frosted, macOS-ähnlich</div>
              </div>
              {theme === 'glass' && <Icon name="check" size={14} style={{ color: 'var(--accent-500)' }} />}
            </button>
            <button
              className={`sb-profile-item ${theme === 'default' ? 'active' : ''}`}
              onClick={() => {
                setTheme('default');
                showToast('Studio-Modus aktiv');
              }}
            >
              <span className="sb-profile-swatch studio" />
              <div className="sb-profile-item-text">
                <div className="sb-profile-item-title">Studio</div>
                <div className="sb-profile-item-sub">Solid Cream, dichter</div>
              </div>
              {theme === 'default' && <Icon name="check" size={14} style={{ color: 'var(--accent-500)' }} />}
            </button>

            <div className="sb-profile-divider" />

            <button
              className="sb-profile-item"
              onClick={() => {
                resetDemo();
                showToast('Demo-Daten zurückgesetzt');
                setProfileOpen(false);
              }}
            >
              <span className="sb-profile-icon">
                <Icon name="rotate-ccw" size={14} style={{ color: 'var(--ink-500)' }} />
              </span>
              <div className="sb-profile-item-text">
                <div className="sb-profile-item-title">Demo zurücksetzen</div>
                <div className="sb-profile-item-sub">Lokalen State leeren</div>
              </div>
            </button>

            {user && (
              <button
                className="sb-profile-item"
                onClick={async () => {
                  setProfileOpen(false);
                  await signOut();
                  showToast('Abgemeldet');
                }}
              >
                <span className="sb-profile-icon">
                  <Icon name="log-out" size={14} style={{ color: 'var(--err-500)' }} />
                </span>
                <div className="sb-profile-item-text">
                  <div className="sb-profile-item-title" style={{ color: 'var(--err-500)' }}>
                    Abmelden
                  </div>
                  <div className="sb-profile-item-sub">{displayEmail}</div>
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
