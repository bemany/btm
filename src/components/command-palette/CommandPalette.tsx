import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ScreenId } from '../../store/types';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';

type ItemKind = 'action' | 'nav' | 'task' | 'project';

interface CmdItem {
  kind: ItemKind;
  group: string;
  id: string;
  title: string;
  subtitle: string;
  icon?: string;
  accent?: true | string;
  kbd?: string;
  run: () => void;
}

export interface CommandPaletteProps {
  onClose: () => void;
  setActive: (id: ScreenId) => void;
}

export function CommandPalette({ onClose, setActive }: CommandPaletteProps) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const users = useStore((s) => s.users);
  const setUI = useStore((s) => s.setUI);
  const setFilter = useStore((s) => s.setFilter);
  const resetDemo = useStore((s) => s.resetDemo);
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const t = useT();
  const [locale] = useLocale();
  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const [q, setQ] = useState('');
  const [active, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const items = useMemo<CmdItem[]>(() => {
    const lc = q.trim().toLowerCase();
    const out: CmdItem[] = [];

    const actions: CmdItem[] = [
      {
        kind: 'action',
        group: t('cmdk.group_actions'),
        id: 'planungsassistent',
        title: t('cmdk.action_open_ai'),
        subtitle: t('cmdk.action_open_ai_sub'),
        icon: 'sparkles',
        accent: true,
        kbd: '⌘P',
        run: () => setUI({ drawer: 'ai' }),
      },
      ...(isAdmin
        ? [{
            kind: 'action' as const,
            group: t('cmdk.group_actions'),
            id: 'new-project',
            title: t('cmdk.action_new_project_long'),
            subtitle: t('cmdk.action_new_project_sub'),
            icon: 'folder-plus',
            run: () => {
              setActive('projects');
              setTimeout(() => window.dispatchEvent(new CustomEvent('btm:open-new-project')), 100);
            },
          }]
        : []),
      {
        kind: 'action',
        group: t('cmdk.group_actions'),
        id: 'reset-demo',
        title: t('cmdk.action_reset_demo_long'),
        subtitle: t('cmdk.action_reset_demo_sub'),
        icon: 'refresh-ccw',
        run: () => {
          resetDemo();
          showToast(t('cmdk.action_reset_demo_done'));
        },
      },
    ];
    actions.forEach((a) => {
      if (!lc || a.title.toLowerCase().includes(lc) || a.subtitle.toLowerCase().includes(lc)) {
        out.push(a);
      }
    });

    const screens: Array<{ id: ScreenId; label: string; icon: string; desc: string }> = [
      { id: 'week', label: t('sidebar.week'), icon: 'calendar-days', desc: t('cmdk.nav_week_desc') },
      { id: 'board', label: t('sidebar.board'), icon: 'kanban-square', desc: t('cmdk.nav_board_desc') },
      { id: 'capacity', label: t('sidebar.capacity'), icon: 'gauge', desc: t('cmdk.nav_capacity_desc') },
      { id: 'times', label: t('sidebar.times'), icon: 'clock', desc: t('cmdk.nav_times_desc') },
      { id: 'projects', label: t('sidebar.projects'), icon: 'folder', desc: t('cmdk.nav_projects_desc', { count: projects.length }) },
      { id: 'mobile', label: t('sidebar.mobile_preview'), icon: 'smartphone', desc: t('cmdk.nav_mobile_desc') },
    ];
    screens.forEach((sc) => {
      if (!lc || sc.label.toLowerCase().includes(lc) || sc.desc.toLowerCase().includes(lc)) {
        out.push({
          kind: 'nav',
          group: t('cmdk.group_navigation'),
          id: 'nav-' + sc.id,
          title: sc.label,
          subtitle: sc.desc,
          icon: sc.icon,
          run: () => setActive(sc.id),
        });
      }
    });

    const taskMatches = tasks
      .filter((tk) => !lc || tk.title.toLowerCase().includes(lc) || tk.id.toLowerCase().includes(lc))
      .slice(0, 8);
    taskMatches.forEach((tk) => {
      const proj = projects.find((p) => p.id === tk.proj);
      const u = users.find((uu) => uu.id === tk.who);
      out.push({
        kind: 'task',
        group: t('cmdk.group_tasks'),
        id: 'task-' + tk.id,
        title: tk.title,
        subtitle: t('cmdk.task_meta', {
          code: proj?.code || '—',
          name: u?.name || '—',
          h: fmtNum(tk.estH),
        }),
        accent: proj?.color,
        run: () => setUI({ taskDetailId: tk.id }),
      });
    });

    const projMatches = projects
      .filter((p) => !lc || p.name.toLowerCase().includes(lc) || p.code.toLowerCase().includes(lc))
      .slice(0, 5);
    projMatches.forEach((p) => {
      const taskCount = tasks.filter((tk) => tk.proj === p.id).length;
      let subtitle = t('cmdk.project_meta', { code: p.code, count: taskCount });
      if (p.due) {
        subtitle += t('cmdk.project_meta_due', {
          date: new Date(p.due).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
            day: '2-digit',
            month: 'short',
          }),
        });
      }
      out.push({
        kind: 'project',
        group: t('cmdk.group_projects'),
        id: 'proj-' + p.id,
        title: p.name,
        subtitle,
        accent: p.color,
        run: () => {
          setFilter({ proj: p.id, who: 'all' });
          setActive('board');
        },
      });
    });

    return out;
  }, [q, tasks, projects, users, setUI, setFilter, setActive, resetDemo, isAdmin, t]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q]);

  const grouped = useMemo(() => {
    const g: Record<string, Array<CmdItem & { _idx: number }>> = {};
    items.forEach((it, idx) => {
      if (!g[it.group]) g[it.group] = [];
      g[it.group].push({ ...it, _idx: idx });
    });
    return g;
  }, [items]);

  const runActive = () => {
    const it = items[active];
    if (!it) return;
    onClose();
    setTimeout(() => it.run(), 50);
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((a) => Math.min(items.length - 1, a + 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((a) => Math.max(0, a - 1));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      runActive();
    }
  };

  useEffect(() => {
    const el = document.querySelector(`.cmdk-item[data-idx="${active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div
      className="cmdk-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmdk-panel" onKeyDown={onKey}>
        <div className="cmdk-search">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('cmdk.cmdk_search_placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="cmdk-kbd">esc</span>
        </div>

        <div className="cmdk-results">
          {items.length === 0 && (
            <div className="cmdk-empty">
              <Icon name="search-x" size={24} style={{ color: 'var(--ink-400)' }} />
              <div style={{ fontSize: 13, marginTop: 8 }}>{t('cmdk.cmdk_empty_for', { q })}</div>
            </div>
          )}
          {Object.entries(grouped).map(([groupName, groupItems]) => (
            <div key={groupName} className="cmdk-group">
              <div className="cmdk-group-label">{groupName}</div>
              {groupItems.map((it) => (
                <button
                  key={it.id}
                  className={`cmdk-item ${active === it._idx ? 'active' : ''} ${it.accent === true ? 'accent' : ''}`}
                  data-idx={it._idx}
                  onMouseEnter={() => setActiveIdx(it._idx)}
                  onClick={runActive}
                >
                  <span
                    className="cmdk-icon"
                    style={
                      typeof it.accent === 'string'
                        ? ({ background: it.accent, color: '#fff' } as CSSProperties)
                        : undefined
                    }
                  >
                    <Icon
                      name={
                        it.icon ||
                        (it.kind === 'task' ? 'check-square' : it.kind === 'project' ? 'folder' : 'arrow-right')
                      }
                      size={14}
                    />
                  </span>
                  <div className="cmdk-text">
                    <div className="cmdk-title">{it.title}</div>
                    <div className="cmdk-subtitle">{it.subtitle}</div>
                  </div>
                  {it.kbd && <span className="cmdk-kbd cmdk-kbd-mono">{it.kbd}</span>}
                  <Icon name="corner-down-left" size={11} className="cmdk-enter" />
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="cmdk-foot">
          <span>
            <span className="cmdk-kbd cmdk-kbd-mono">↑↓</span> {t('cmdk.cmdk_navigate')}
          </span>
          <span>
            <span className="cmdk-kbd cmdk-kbd-mono">↵</span> {t('cmdk.cmdk_open')}
          </span>
          <span>
            <span className="cmdk-kbd cmdk-kbd-mono">esc</span> {t('cmdk.cmdk_close')}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ color: 'var(--ink-500)' }}>
            {t('cmdk.cmdk_results_count', { count: items.length })}
          </span>
        </div>
      </div>
    </div>
  );
}
