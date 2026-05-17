// iOS-Chrome + Bottom-Tab-Bar — gemeinsame UI über alle Mobile-Screens.
// StatusBar (Uhr, Signal, WLAN, Akku) zeigt nur statisches Demo-UI;
// in einer echten PWA übernimmt das System diese Pixel.

import { Icon } from '../shared/Icon';

export type MobileTab = 'home' | 'board' | 'add' | 'ki' | 'me';

export function MobStatusBar({ dark = false, time }: { dark?: boolean; time?: string }) {
  const c = dark ? '#FAF7F2' : 'var(--ink-900)';
  const now = new Date();
  const t = time ?? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <div className="mob-status" style={{ color: c }}>
      <span className="mob-status-time">{t}</span>
      <div style={{ flex: 1 }} />
      <div className="mob-status-right">
        <div style={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
          {[3, 5, 7, 9].map((h, i) => (
            <span key={i} style={{ width: 2.5, height: h, background: c, borderRadius: 0.5 }} />
          ))}
        </div>
        <svg width="13" height="9" viewBox="0 0 13 9" fill="none">
          <path d="M1.2 3.2C2.7 1.8 4.5 1 6.5 1s3.8.8 5.3 2.2" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M3.2 5.4C4.1 4.6 5.2 4.1 6.5 4.1s2.4.5 3.3 1.3" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="6.5" cy="7.4" r="0.95" fill={c} />
        </svg>
        <div style={{ position: 'relative', width: 23, height: 11 }}>
          <div style={{ width: 23, height: 11, border: `1px solid ${c}`, borderRadius: 2.5, padding: 1.2, boxSizing: 'border-box' }}>
            <span style={{ display: 'block', width: '78%', height: '100%', background: c, borderRadius: 1 }} />
          </div>
          <span style={{ position: 'absolute', right: -2.5, top: 3.5, width: 1.5, height: 4, background: c, borderRadius: 0.5 }} />
        </div>
      </div>
    </div>
  );
}

export function HomeBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className="mob-home-bar">
      <span style={{ width: 110, height: 4, borderRadius: 3, background: dark ? 'rgba(250,247,242,0.55)' : 'var(--ink-700)' }} />
    </div>
  );
}

interface TabItemProps {
  icon: string;
  label: string;
  active?: boolean;
  badge?: number | null;
  onClick: () => void;
}

function TabItem({ icon, label, active = false, badge = null, onClick }: TabItemProps) {
  return (
    <button type="button" className={`mob-tab ${active ? 'is-active' : ''}`} onClick={onClick}>
      <div style={{ position: 'relative' }}>
        <Icon name={icon} size={18} />
        {badge != null && badge > 0 && <span className="mob-tab-badge">{badge}</span>}
      </div>
      <span>{label}</span>
    </button>
  );
}

export interface BottomTabBarProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  onFab: () => void;
}

export function BottomTabBar({ active, onChange, onFab }: BottomTabBarProps) {
  return (
    <div className="mob-tabbar">
      <TabItem icon="list-checks" label="Heute" active={active === 'home'} onClick={() => onChange('home')} />
      <TabItem icon="layout-dashboard" label="Board" active={active === 'board'} onClick={() => onChange('board')} />
      <div className="mob-tab-fab">
        <button type="button" onClick={onFab} aria-label="Neue Aufgabe">
          <Icon name="plus" size={18} />
        </button>
      </div>
      <TabItem icon="sparkles" label="KI" active={active === 'ki'} onClick={() => onChange('ki')} />
      <TabItem icon="user-round" label="Profil" active={active === 'me'} onClick={() => onChange('me')} />
    </div>
  );
}
