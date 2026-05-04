import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ScreenId } from '../../store/types';
import { useStore } from '../../store/store';
import { PERSONAS } from '../../store/seed';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';

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
  const setUI = useStore((s) => s.setUI);
  const setFilter = useStore((s) => s.setFilter);
  const resetDemo = useStore((s) => s.resetDemo);

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
        group: 'Aktionen',
        id: 'planungsassistent',
        title: 'Planungsassistent öffnen',
        subtitle: 'KI extrahiert Aufgaben aus PM-Anleitungen',
        icon: 'sparkles',
        accent: true,
        kbd: '⌘P',
        run: () => setUI({ drawer: 'ai' }),
      },
      {
        kind: 'action',
        group: 'Aktionen',
        id: 'new-project',
        title: 'Neues Projekt anlegen',
        subtitle: 'Code, Name, Farbe, Fälligkeit',
        icon: 'folder-plus',
        run: () => {
          setActive('projects');
          setTimeout(() => window.dispatchEvent(new CustomEvent('btm:open-new-project')), 100);
        },
      },
      {
        kind: 'action',
        group: 'Aktionen',
        id: 'reset-demo',
        title: 'Demo-Daten zurücksetzen',
        subtitle: 'Setzt Tasks, Timer und Projekte auf den Stand "KW 19"',
        icon: 'refresh-ccw',
        run: () => {
          resetDemo();
          showToast('Demo-Daten zurückgesetzt');
        },
      },
    ];
    actions.forEach((a) => {
      if (!lc || a.title.toLowerCase().includes(lc) || a.subtitle.toLowerCase().includes(lc)) {
        out.push(a);
      }
    });

    const screens: Array<{ id: ScreenId; label: string; icon: string; desc: string }> = [
      { id: 'week', label: 'Meine Woche', icon: 'calendar-days', desc: 'Hallo-Screen, KPIs, jetzt aktiv' },
      { id: 'board', label: 'Wochenboard', icon: 'kanban-square', desc: 'Kanban / Liste / Timeline' },
      { id: 'capacity', label: 'Kapazität', icon: 'gauge', desc: 'Team-Auslastung pro Person' },
      { id: 'times', label: 'Zeiten', icon: 'clock', desc: 'Live-Timer + Batch-Erfassung' },
      { id: 'projects', label: 'Projekte', icon: 'folder', desc: `${projects.length} aktive Projekte` },
      { id: 'mobile', label: 'Mobile-Vorschau', icon: 'smartphone', desc: 'PWA-Set für unterwegs' },
    ];
    screens.forEach((sc) => {
      if (!lc || sc.label.toLowerCase().includes(lc) || sc.desc.toLowerCase().includes(lc)) {
        out.push({
          kind: 'nav',
          group: 'Navigation',
          id: 'nav-' + sc.id,
          title: sc.label,
          subtitle: sc.desc,
          icon: sc.icon,
          run: () => setActive(sc.id),
        });
      }
    });

    const taskMatches = tasks
      .filter((t) => !lc || t.title.toLowerCase().includes(lc) || t.id.toLowerCase().includes(lc))
      .slice(0, 8);
    taskMatches.forEach((t) => {
      const proj = projects.find((p) => p.id === t.proj);
      const persona = PERSONAS.find((p) => p.id === t.who);
      out.push({
        kind: 'task',
        group: 'Aufgaben',
        id: 'task-' + t.id,
        title: t.title,
        subtitle: `${proj?.code || '—'} · ${persona?.name || ''} · ${t.estH.toFixed(1).replace('.', ',')}h`,
        accent: proj?.color,
        run: () => setUI({ taskDetailId: t.id }),
      });
    });

    const projMatches = projects
      .filter((p) => !lc || p.name.toLowerCase().includes(lc) || p.code.toLowerCase().includes(lc))
      .slice(0, 5);
    projMatches.forEach((p) => {
      const taskCount = tasks.filter((t) => t.proj === p.id).length;
      out.push({
        kind: 'project',
        group: 'Projekte',
        id: 'proj-' + p.id,
        title: p.name,
        subtitle: `${p.code} · ${taskCount} Aufgaben${
          p.due ? ' · fällig ' + new Date(p.due).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) : ''
        }`,
        accent: p.color,
        run: () => {
          setFilter({ proj: p.id, who: 'all' });
          setActive('board');
        },
      });
    });

    return out;
  }, [q, tasks, projects, setUI, setFilter, setActive, resetDemo]);

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
            placeholder="Suchen oder Befehl ausführen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="cmdk-kbd">esc</span>
        </div>

        <div className="cmdk-results">
          {items.length === 0 && (
            <div className="cmdk-empty">
              <Icon name="search-x" size={24} style={{ color: 'var(--ink-400)' }} />
              <div style={{ fontSize: 13, marginTop: 8 }}>Keine Treffer für „{q}"</div>
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
            <span className="cmdk-kbd cmdk-kbd-mono">↑↓</span> Navigieren
          </span>
          <span>
            <span className="cmdk-kbd cmdk-kbd-mono">↵</span> Öffnen
          </span>
          <span>
            <span className="cmdk-kbd cmdk-kbd-mono">esc</span> Schließen
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ color: 'var(--ink-500)' }}>{items.length} Treffer</span>
        </div>
      </div>
    </div>
  );
}
