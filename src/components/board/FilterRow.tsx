import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';

export function FilterRow() {
  const filter = useStore((s) => s.filter);
  const projects = useStore((s) => s.projects);
  const setFilter = useStore((s) => s.setFilter);

  return (
    <div className="filter-row">
      <button
        className={`filter-chip ${filter.who === 'mine' ? 'active' : ''}`}
        onClick={() => setFilter({ who: 'mine' })}
      >
        <Icon name="user" size={11} /> Meine
      </button>
      <button
        className={`filter-chip ${filter.who === 'all' ? 'active' : ''}`}
        onClick={() => setFilter({ who: 'all' })}
      >
        <Icon name="users" size={11} /> Team
      </button>
      <span style={{ width: 1, height: 18, background: 'var(--ink-200)', margin: '0 4px' }} />
      <button
        className={`filter-chip ${filter.proj === 'all' ? 'active' : ''}`}
        onClick={() => setFilter({ proj: 'all' })}
      >
        Alle Projekte
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
            Suche: „{filter.q}" <Icon name="x" size={11} />
          </button>
        </>
      )}
    </div>
  );
}
