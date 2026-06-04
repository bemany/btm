import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import type { ScreenId } from '../../store/types';
import { Icon } from '../shared/Icon';
import { TimerChip } from './TimerChip';
import { useT } from '../../i18n';
import * as api from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { useAuth } from '../../auth/AuthContext';

export interface TopbarProps {
  active: ScreenId;
  setActive: (id: ScreenId) => void;
  collapsed: boolean;
  setCollapsed: (updater: boolean | ((v: boolean) => boolean)) => void;
}

export function Topbar({ active, setActive, collapsed, setCollapsed }: TopbarProps) {
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const setUI = useStore((s) => s.setUI);
  const projectsCount = useStore((s) => s.projects.length);
  const t = useT();
  const { user } = useAuth();
  const { data: notifCount } = useQuery({
    queryKey: SYNC_KEYS.NOTIFICATION_COUNT,
    queryFn: api.notificationCount,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!user,
  });
  const unreadCount = notifCount?.unread ?? 0;

  const titles: Record<ScreenId, { crumb: string; meta: string }> = {
    week: { crumb: t('topbar.title_week'), meta: t('topbar.meta_week_dates') },
    board: { crumb: t('topbar.title_board'), meta: t('topbar.meta_week_all_tasks', { kw: 19 }) },
    capacity: { crumb: t('topbar.title_capacity'), meta: t('topbar.meta_week_team', { kw: 19 }) },
    times: { crumb: t('topbar.title_times'), meta: t('topbar.meta_week_live_batch', { kw: 19 }) },
    projects: { crumb: t('topbar.title_projects'), meta: t('topbar.meta_projects', { count: projectsCount }) },
    inbox: { crumb: t('topbar.title_inbox'), meta: t('topbar.meta_inbox') },
    mobile: { crumb: t('topbar.title_mobile'), meta: t('topbar.meta_mobile') },
    chrome: { crumb: t('topbar.title_chrome'), meta: t('topbar.meta_chrome') },
    tv: { crumb: t('topbar.title_tv'), meta: t('topbar.meta_tv') },
    admin: { crumb: t('topbar.title_admin'), meta: t('topbar.meta_admin') },
    admin_feedback: { crumb: t('topbar.title_admin'), meta: t('topbar.meta_admin') },
    releases: { crumb: t('topbar.title_releases'), meta: t('topbar.meta_releases') },
  };

  const cur = titles[active] ?? titles.week;
  const [searchVal, setSearchVal] = useState(filter.q || '');
  useEffect(() => setSearchVal(filter.q || ''), [filter.q]);

  return (
    <header className="app-topbar">
      <button
        className="tb-toggle"
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
      >
        <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
      </button>
      <button
        className="tb-mobile-menu"
        onClick={() => document.querySelector('.app')?.classList.toggle('sidebar-open')}
        title={t('topbar.menu')}
        aria-label={t('topbar.menu')}
      >
        <Icon name="menu" size={18} />
      </button>
      <div>
        <div className="tb-crumb">{cur.crumb}</div>
      </div>
      <div className="tb-meta">{cur.meta}</div>
      <div className="tb-spacer" />

      <div className="tb-search" onClick={() => document.getElementById('tb-search-input')?.focus()}>
        <Icon name="search" size={14} />
        <input
          id="tb-search-input"
          placeholder={t('topbar.search_placeholder')}
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

      <button
        type="button"
        className="tb-bell"
        onClick={() => setActive('inbox')}
        title={t('sidebar.inbox')}
        aria-label={t('sidebar.inbox')}
      >
        <Icon name="bell" size={16} />
        {unreadCount > 0 && (
          <span className="tb-bell-dot">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      <button
        className="tb-btn accent"
        onClick={() => setUI({ drawer: 'ai' })}
        title={`${t('topbar.planning_ai')} (⌘K)`}
      >
        <Icon name="sparkles" size={14} />
        {t('topbar.planning_ai')}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.8, marginLeft: 4 }}>⌘K</span>
      </button>
    </header>
  );
}
