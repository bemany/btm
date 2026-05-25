import { useState } from 'react';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { useT } from '../../i18n';
import { filterAssignableProjects } from '../../lib/projectFilters';

const SHOW_ALL_PROJECTS_KEY = 'btm.boardFilter.showAllProjects';

export function FilterRow() {
  const filter = useStore((s) => s.filter);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const currentUser = useStore((s) => s.currentUser);
  const setFilter = useStore((s) => s.setFilter);
  const t = useT();

  // Default: nur Favoriten als Chips zeigen (Feature FDpT3hc49EI).
  // Toggle „Alle Projekte" merken wir in localStorage damit ein User der
  // wirklich alle Chips will, das nicht jedes Mal neu klicken muss.
  const [showAll, setShowAll] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SHOW_ALL_PROJECTS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleShowAll = (next: boolean) => {
    setShowAll(next);
    try {
      localStorage.setItem(SHOW_ALL_PROJECTS_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  // Wert für das User-Dropdown — 'mine' und 'all' werden über die Chips
  // gehandhabt, das Dropdown zeigt nur konkrete User-IDs.
  const dropdownValue = filter.who === 'mine' || filter.who === 'all' ? '' : filter.who;
  // Aktive User sortiert (selbst zuerst, sonst alphabetisch)
  const sortedUsers = [...users]
    .filter((u) => u.status === 'active')
    .sort((a, b) => {
      if (a.id === currentUser) return -1;
      if (b.id === currentUser) return 1;
      return a.name.localeCompare(b.name);
    });

  // Projekt-Chips: default Favoriten, mit Toggle „auch andere zeigen".
  // Aktiv-gefiltertes Projekt wird IMMER gezeigt damit der User nicht
  // plötzlich in einem unsichtbaren Filter-State landet.
  const includeIds = filter.proj && filter.proj !== 'all' ? [filter.proj] : [];
  const { favorites, others, all } = filterAssignableProjects(projects, {
    currentUserId: currentUser,
    showOnlyFavorites: !showAll,
    includeIds,
  });
  const userHasFavorites = projects.some(
    (p) => p.isFavorite && (!p.privateOwnerId || p.privateOwnerId === currentUser),
  );
  const hiddenCount = userHasFavorites && !showAll
    ? projects.filter(
        (p) =>
          !p.isFavorite &&
          (!p.privateOwnerId || p.privateOwnerId === currentUser) &&
          !includeIds.includes(p.id),
      ).length
    : 0;
  const visibleChips = userHasFavorites && !showAll ? all : all;

  return (
    <div className="filter-row">
      <button
        className={`filter-chip ${filter.who === 'mine' ? 'active' : ''}`}
        onClick={() => setFilter({ who: 'mine' })}
      >
        <Icon name="user" size={11} /> {t('board.filter_mine')}
      </button>
      <button
        className={`filter-chip ${filter.who === 'all' ? 'active' : ''}`}
        onClick={() => setFilter({ who: 'all' })}
      >
        <Icon name="users" size={11} /> {t('board.filter_team')}
      </button>
      <select
        className={`filter-user-select ${dropdownValue ? 'active' : ''}`}
        value={dropdownValue}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) setFilter({ who: 'all' });
          else setFilter({ who: v });
        }}
        title={t('board.filter_user_picker')}
      >
        <option value="">{t('board.filter_user_picker')}</option>
        {sortedUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === currentUser ? `${u.name} (${t('board.filter_user_me')})` : u.name}
          </option>
        ))}
      </select>
      <span style={{ width: 1, height: 18, background: 'var(--ink-200)', margin: '0 4px' }} />
      <button
        className={`filter-chip ${filter.proj === 'all' ? 'active' : ''}`}
        onClick={() => setFilter({ proj: 'all' })}
      >
        {t('board.filter_projects_all')}
      </button>
      {visibleChips.map((p) => (
        <button
          key={p.id}
          className={`filter-chip ${filter.proj === p.id ? 'active' : ''}`}
          onClick={() => setFilter({ proj: p.id })}
        >
          {p.isFavorite && <Icon name="star" size={10} />}
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.code}
        </button>
      ))}
      {hiddenCount > 0 && (
        <button
          className="filter-chip filter-chip-ghost"
          onClick={() => toggleShowAll(true)}
          title={t('board.filter_show_all_projects')}
        >
          <Icon name="plus" size={10} /> {t('board.filter_more_projects', { count: hiddenCount })}
        </button>
      )}
      {showAll && userHasFavorites && (
        <button
          className="filter-chip filter-chip-ghost"
          onClick={() => toggleShowAll(false)}
          title={t('board.filter_only_favorites')}
        >
          <Icon name="star" size={10} /> {t('board.filter_only_favorites')}
        </button>
      )}
      {filter.q && (
        <>
          <span style={{ width: 1, height: 18, background: 'var(--ink-200)', margin: '0 4px' }} />
          <button className="filter-chip active" onClick={() => setFilter({ q: '' })}>
            {t('board.filter_search_label', { q: filter.q })} <Icon name="x" size={11} />
          </button>
        </>
      )}
      <span style={{ flex: 1 }} />
      <button
        className={`filter-chip ${filter.showArchived ? 'active' : ''}`}
        onClick={() => setFilter({ showArchived: !filter.showArchived })}
        title={t('board.filter_show_archived_title')}
      >
        <Icon name="archive" size={11} />
        {filter.showArchived ? t('board.filter_archived_on') : t('board.filter_archived_off')}
      </button>
    </div>
  );
}
