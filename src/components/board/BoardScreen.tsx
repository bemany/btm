import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutMode } from '../../store/types';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import * as api from '../../data/api';
import { BoardKanban } from './BoardKanban';
import { BoardList } from './BoardList';
import { BoardTimeline } from './BoardTimeline';
import { FilterRow } from './FilterRow';
import { useT } from '../../i18n';

export function BoardScreen() {
  const t = useT();
  const LAYOUTS: Array<{ id: LayoutMode; icon: string; label: string }> = [
    { id: 'kanban', icon: 'kanban-square', label: t('layout.kanban') },
    { id: 'list', icon: 'list', label: t('layout.list') },
    { id: 'timeline', icon: 'calendar-range', label: t('layout.timeline') },
  ];
  const tasks = useStore((s) => s.tasks);
  const filter = useStore((s) => s.filter);
  const currentUser = useStore((s) => s.currentUser);
  const layout = useStore((s) => s.ui.layout);
  const setLayout = useStore((s) => s.setLayout);
  const { user, refresh: refreshAuth } = useAuth();

  // Beim ersten Mount des Boards die User-Prefs als Default anwenden, sofern
  // der UI-Store noch auf seinem Initialwert steht. Kein erzwungener Sync —
  // wenn der User im Tab schon umgeschaltet hat, respektieren wir das.
  const initialApplied = useRef(false);
  useEffect(() => {
    if (initialApplied.current) return;
    if (user?.boardDefaultView && user.boardDefaultView !== layout) {
      setLayout(user.boardDefaultView);
    }
    initialApplied.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Gear-Popover für „Aktuelle Ansicht als Standard speichern"
  const [gearOpen, setGearOpen] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gearOpen) return;
    const onDown = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [gearOpen]);

  const saveAsDefault = async (view: LayoutMode) => {
    if (!user) return;
    setSavingDefault(true);
    try {
      await api.updateUser(user.id, { boardDefaultView: view });
      await refreshAuth();
      showToast(t('board.gear_saved_toast', { label: LAYOUTS.find((l) => l.id === view)?.label ?? '' }));
      setGearOpen(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('board.gear_save_failed'));
    } finally {
      setSavingDefault(false);
    }
  };

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter.who === 'mine') list = list.filter((t) => t.who === currentUser);
    if (filter.proj !== 'all') list = list.filter((t) => t.proj === filter.proj);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [tasks, filter, currentUser]);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-head">
        <div className="left">
          <div className="eyebrow">{t('board.eyebrow')}</div>
          <h1>{t('board.title', { kw: 19, count: filtered.length })}</h1>
          <div className="subtitle">{t('board.sub')}</div>
        </div>
        <div className="right" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--cream-100)',
              border: '1px solid var(--ink-200)',
              borderRadius: 6,
              padding: 2,
            }}
          >
            {LAYOUTS.map((o) => (
              <button
                key={o.id}
                onClick={() => setLayout(o.id)}
                style={{
                  border: 0,
                  background: layout === o.id ? 'var(--ink-900)' : 'transparent',
                  color: layout === o.id ? 'var(--cream-50)' : 'var(--ink-700)',
                  padding: '5px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                }}
                title={o.label}
              >
                <Icon name={o.icon} size={12} /> {o.label}
              </button>
            ))}
          </div>
          <div ref={gearRef} className="board-gear-wrap">
            <button
              className="board-gear-btn"
              onClick={() => setGearOpen((v) => !v)}
              title={t('board.gear_title')}
              aria-label={t('board.gear_title')}
            >
              <Icon name="settings" size={13} />
            </button>
            {gearOpen && (
              <div className="board-gear-pop">
                <div className="board-gear-head">{t('board.gear_title')}</div>
                <div className="board-gear-sub">{t('board.gear_sub')}</div>
                <div className="board-gear-list">
                  {LAYOUTS.map((o) => {
                    const isCurrent = user?.boardDefaultView === o.id;
                    return (
                      <button
                        key={o.id}
                        className={`board-gear-item ${isCurrent ? 'is-current' : ''}`}
                        onClick={() => void saveAsDefault(o.id)}
                        disabled={savingDefault}
                      >
                        <Icon name={o.icon} size={13} />
                        <span>{o.label}</span>
                        {isCurrent && (
                          <Icon name="check" size={12} className="board-gear-check" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="board-gear-current"
                  onClick={() => void saveAsDefault(layout)}
                  disabled={savingDefault || user?.boardDefaultView === layout}
                >
                  {t('board.gear_set_current', { label: LAYOUTS.find((l) => l.id === layout)?.label ?? '' })}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <FilterRow />

      <div style={{ flex: 1, minHeight: 0 }}>
        {layout === 'kanban' && <BoardKanban tasks={filtered} />}
        {layout === 'list' && <BoardList tasks={filtered} />}
        {layout === 'timeline' && <BoardTimeline tasks={filtered} />}
      </div>
    </div>
  );
}
