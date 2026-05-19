// Mobile-Chrome — Bottom-Tab-Bar mit FAB.
// HINWEIS: StatusBar (Uhr/Signal/Akku) und HomeBar (iOS Home-Indicator-Strich)
// sind Mockup-Elemente aus dem Design-Prototype und werden in der echten PWA
// nicht gerendert — iOS/Android haben das eigene System-UI. Stattdessen
// reservieren wir Safe-Area-Padding über env(safe-area-inset-*).

import { Icon } from '../shared/Icon';

export type MobileTab = 'home' | 'board' | 'add' | 'ki' | 'me';

// No-op-Komponenten — bleiben in den Screens importiert, rendern aber nichts.
// So bleibt die Screen-Struktur kompatibel zum Design-Prototype.
export function MobStatusBar(_: { dark?: boolean; time?: string }) {
  return null;
}
export function HomeBar(_: { dark?: boolean }) {
  return null;
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
        <Icon name={icon} size={24} />
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
          <Icon name="plus" size={26} />
        </button>
      </div>
      <TabItem icon="sparkles" label="KI" active={active === 'ki'} onClick={() => onChange('ki')} />
      <TabItem icon="user-round" label="Profil" active={active === 'me'} onClick={() => onChange('me')} />
    </div>
  );
}
