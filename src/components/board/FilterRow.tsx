import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { useT } from '../../i18n';

export function FilterRow() {
  const filter = useStore((s) => s.filter);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const currentUser = useStore((s) => s.currentUser);
  const setFilter = useStore((s) => s.setFilter);
  const t = useT();

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
      {projects.map((p) => (
        <button
          key={p.id}
          className={`filter-chip ${filter.proj === p.id ? 'active' : ''}`}
          onClick={() => setFilter({ proj: p.id })}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.code}
        </button>
      ))}
      {filter.q && (
        <>
          <span style={{ width: 1, height: 18, background: 'var(--ink-200)', margin: '0 4px' }} />
          <button className="filter-chip active" onClick={() => setFilter({ q: '' })}>
            {t('board.filter_search_label', { q: filter.q })} <Icon name="x" size={11} />
          </button>
        </>
      )}
    </div>
  );
}
