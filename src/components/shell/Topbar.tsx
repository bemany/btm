import { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import type { ScreenId } from '../../store/types';
import { Icon } from '../shared/Icon';
import { TimerChip } from './TimerChip';
import { PersonaSwitcher } from './PersonaSwitcher';

export interface TopbarProps {
  active: ScreenId;
  setActive: (id: ScreenId) => void;
  collapsed: boolean;
  setCollapsed: (updater: boolean | ((v: boolean) => boolean)) => void;
}

const TITLES: Record<ScreenId, { crumb: string; meta: string }> = {
  week: { crumb: 'Meine Woche', meta: 'KW 19 · 04.–08. Mai 2026' },
  board: { crumb: 'Wochenboard', meta: 'KW 19 · alle Aufgaben' },
  capacity: { crumb: 'Kapazität', meta: 'KW 19 · Team Bethesna' },
  times: { crumb: 'Zeiten', meta: 'KW 19 · Live + Batch' },
  projects: { crumb: 'Projekte', meta: '' /* gefüllt aus Store */ },
  mobile: { crumb: 'Mobile-Vorschau', meta: 'PWA · Phase 2' },
  chrome: { crumb: 'Chrome-Plugin', meta: 'Browser-Erweiterung · Phase 3' },
  tv: { crumb: 'TV-Dashboard', meta: 'Großbildschirm · Live-Status' },
};

export function Topbar({ active, setActive, collapsed, setCollapsed }: TopbarProps) {
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const setUI = useStore((s) => s.setUI);
  const projectsCount = useStore((s) => s.projects.length);

  const base = TITLES[active] ?? TITLES.week;
  const t =
    active === 'projects'
      ? { ...base, meta: `${projectsCount} aktiv` }
      : base;
  const [searchVal, setSearchVal] = useState(filter.q || '');
  useEffect(() => setSearchVal(filter.q || ''), [filter.q]);

  return (
    <header className="app-topbar">
      <button className="tb-toggle" onClick={() => setCollapsed((v) => !v)} title="Sidebar einklappen">
        <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
      </button>
      <div>
        <div className="tb-crumb">{t.crumb}</div>
      </div>
      <div className="tb-meta">{t.meta}</div>
      <div className="tb-spacer" />

      <div className="tb-search" onClick={() => document.getElementById('tb-search-input')?.focus()}>
        <Icon name="search" size={14} />
        <input
          id="tb-search-input"
          placeholder="Aufgaben durchsuchen…"
          value={searchVal}
          onChange={(e) => {
            setSearchVal(e.target.value);
            setFilter({ q: e.target.value });
            if (e.target.value && active !== 'board') setActive('board');
          }}
        />
        <span className="kbd">/</span>
      </div>

      <TimerChip />

      <button className="tb-btn accent" onClick={() => setUI({ drawer: 'ai' })} title="KI-Drawer öffnen (⌘K)">
        <Icon name="sparkles" size={14} />
        Planungs-KI
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.8, marginLeft: 4 }}>⌘K</span>
      </button>

      <PersonaSwitcher />
    </header>
  );
}
