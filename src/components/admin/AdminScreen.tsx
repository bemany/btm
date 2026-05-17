import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import type { AppUser, AppInvitation } from '../../store/types';
import { Icon } from '../shared/Icon';
import { FeedbackList } from './FeedbackList';
import { Avatar } from '../shared/Avatar';
import { showToast } from '../shared/Toast';
import * as api from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { fmtRel, activityLine, WORK_KINDS } from './adminUtils';
import { UserDrawer } from './UserDrawer';
import { TeamsDrawer } from './TeamsDrawer';
import { TVSetupDrawer } from './TVSetupDrawer';
import { useT, useLocale } from '../../i18n';

type FilterMode = 'all' | 'active' | 'admin' | 'invited' | 'inactive';
type UsersView = 'cards' | 'list';
const USERS_VIEW_STORAGE_KEY = 'btm.adminUsersView';
const ACTIVITY_OPEN_STORAGE_KEY = 'btm.adminActivityOpen';

function loadUsersView(): UsersView {
  try {
    const v = localStorage.getItem(USERS_VIEW_STORAGE_KEY);
    return v === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

function loadActivityOpen(): boolean {
  try {
    return localStorage.getItem(ACTIVITY_OPEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AdminScreen() {
  const users = useStore((s) => s.users);
  const teams = useStore((s) => s.teams);
  const invitations = useStore((s) => s.invitations);
  const tasks = useStore((s) => s.tasks);
  const t = useT();

  const [filter, setFilter] = useState<FilterMode>('all');
  const [q, setQ] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [userDrawerId, setUserDrawerId] = useState<string | null>(null);
  const [teamsDrawerOpen, setTeamsDrawerOpen] = useState(false);
  const [tvDrawerOpen, setTvDrawerOpen] = useState(false);
  const [devMode, setDevMode] = useState(false);
  // FEtt86HtKR3: View-Toggle für User-Sektion (Karten/Liste)
  const [usersView, setUsersView] = useState<UsersView>(() => loadUsersView());
  // Aktivitätsleiste rechts standardmäßig aus, per Toggle einblendbar
  const [activityOpen, setActivityOpen] = useState<boolean>(() => loadActivityOpen());

  useEffect(() => {
    try { localStorage.setItem(USERS_VIEW_STORAGE_KEY, usersView); } catch { /* ignore */ }
  }, [usersView]);

  useEffect(() => {
    try { localStorage.setItem(ACTIVITY_OPEN_STORAGE_KEY, activityOpen ? '1' : '0'); } catch { /* ignore */ }
  }, [activityOpen]);

  useEffect(() => {
    fetch('/api/config', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { devMode?: boolean }) => { if (j.devMode) setDevMode(true); })
      .catch(() => {});
  }, []);

  const counts = {
    all: users.length,
    active: users.filter((u) => u.status === 'active').length,
    admin: users.filter((u) => u.role === 'admin').length,
    inactive: users.filter((u) => u.status === 'inactive').length,
    pending: invitations.length,
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filter === 'active' && u.status !== 'active') return false;
      if (filter === 'invited' && u.status !== 'invited') return false;
      if (filter === 'inactive' && u.status !== 'inactive') return false;
      if (filter === 'admin' && u.role !== 'admin') return false;
      if (teamFilter !== 'all' && u.teamId !== teamFilter) return false;
      if (q) {
        const haystack = `${u.name} ${u.email} ${u.jobTitle ?? ''}`.toLowerCase();
        if (!haystack.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [users, filter, q, teamFilter]);

  return (
    <div className="admin-screen">
      <div className={`admin-grid ${activityOpen ? 'has-side' : 'no-side'}`}>
        <div className="admin-main">
          <div className="admin-header">
            <div className="admin-stat">
              <div className="admin-stat-label">{t('admin.stat_active')}</div>
              <div className="admin-stat-val">
                {counts.active}
                <span className="admin-stat-suffix">/ {counts.all}</span>
              </div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">{t('admin.stat_admins')}</div>
              <div className="admin-stat-val">{counts.admin}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">{t('admin.stat_pending')}</div>
              <div
                className="admin-stat-val"
                style={{ color: counts.pending > 0 ? 'var(--accent-600)' : 'inherit' }}
              >
                {counts.pending}
              </div>
            </div>
            <div className="admin-stat admin-stat-clickable" onClick={() => setTeamsDrawerOpen(true)}>
              <div className="admin-stat-label">{t('admin.teams')}</div>
              <div className="admin-stat-val">
                {teams.length}
                <span className="admin-stat-suffix" style={{ fontSize: 11, color: 'var(--accent-600)' }}>
                  {t('admin.teams_manage')}
                </span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <button className="tb-btn" onClick={() => setTvDrawerOpen(true)}>
              <Icon name="monitor" size={14} /> {t('admin.tv_setup')}
            </button>
            <button className="tb-btn" onClick={() => setTeamsDrawerOpen(true)}>
              <Icon name="users" size={14} /> {t('admin.teams')}
            </button>
            <button className="tb-btn accent" onClick={() => setUserDrawerId('__new__')}>
              <Icon name="user-plus" size={14} /> {t('admin.invite_user')}
            </button>
            <button
              className={`tb-btn admin-activity-toggle ${activityOpen ? 'is-on' : ''}`}
              onClick={() => setActivityOpen((v) => !v)}
              title={activityOpen ? t('admin.activity_hide') : t('admin.activity_show')}
              aria-label={activityOpen ? t('admin.activity_hide') : t('admin.activity_show')}
            >
              <Icon name={activityOpen ? 'panel-right-close' : 'panel-right-open'} size={14} />
            </button>
          </div>

          <div className="admin-filterbar">
            <div className="admin-search">
              <Icon name="search" size={14} />
              <input
                placeholder={t('admin.search_placeholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="admin-chips">
              {(
                [
                  { id: 'all', label: t('admin.filter_all'), n: counts.all },
                  { id: 'active', label: t('admin.filter_active'), n: counts.active },
                  { id: 'admin', label: t('admin.stat_admins'), n: counts.admin },
                  { id: 'inactive', label: t('admin.filter_inactive'), n: counts.inactive },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  className={`admin-chip ${filter === f.id ? 'active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label} <span className="n">{f.n}</span>
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <select
              className="admin-select"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              <option value="all">{t('admin.teams_filter_all')}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </div>

          {invitations.length > 0 && (
            <div className="admin-section">
              <div className="admin-section-head">
                <Icon name="mail" size={14} />
                <h3>{t('admin.invitations_section')}</h3>
                <span className="admin-section-count">{invitations.length}</span>
              </div>
              <div className="admin-invite-grid">
                {invitations.map((inv) => (
                  <InviteCard key={inv.id} inv={inv} teamName={teams.find((tm) => tm.id === inv.teamId)?.name} />
                ))}
              </div>
            </div>
          )}

          {/* FEtt86HtKR3: User und Feedbacks nebeneinander */}
          <div className="admin-split">
            <div className="admin-section">
              <div className="admin-section-head">
                <Icon name="users" size={14} />
                <h3>{t('admin.users_section')}</h3>
                <span className="admin-section-count">{filtered.length}</span>
                <div style={{ flex: 1 }} />
                <div className="admin-view-toggle">
                  {([
                    { id: 'cards' as const, icon: 'layout-grid', label: t('layout.cards') },
                    { id: 'list' as const, icon: 'list', label: t('layout.list') },
                  ]).map((o) => (
                    <button
                      key={o.id}
                      className={`admin-view-btn ${usersView === o.id ? 'active' : ''}`}
                      onClick={() => setUsersView(o.id)}
                      title={o.label}
                      aria-label={o.label}
                    >
                      <Icon name={o.icon} size={12} />
                    </button>
                  ))}
                </div>
              </div>
              {filtered.length === 0 && (
                <div className="admin-empty">{t('admin.empty_filtered')}</div>
              )}
              {filtered.length > 0 && usersView === 'cards' && (
                <div className="admin-user-grid">
                  {filtered.map((u) => (
                    <UserCard
                      key={u.id}
                      u={u}
                      doingCount={tasks.filter((tk) => tk.who === u.id && tk.col === 'doing').length}
                      teamName={teams.find((tm) => tm.id === u.teamId)?.name ?? '—'}
                      onClick={() => setUserDrawerId(u.id)}
                    />
                  ))}
                </div>
              )}
              {filtered.length > 0 && usersView === 'list' && (
                <UserListTable
                  users={filtered}
                  teamsById={(id) => teams.find((tm) => tm.id === id)?.name ?? '—'}
                  doingCountByUser={(uid) => tasks.filter((tk) => tk.who === uid && tk.col === 'doing').length}
                  onPick={(id) => setUserDrawerId(id)}
                />
              )}
            </div>

            <section className="admin-section admin-feedback-section">
              <div className="admin-section-head">
                <Icon name="message-square" size={14} />
                <h3>{t('feedback.admin_heading')}</h3>
              </div>
              <FeedbackList />
            </section>
          </div>

          {devMode && <DevCloneWidget />}
        </div>

        {activityOpen && (
          <aside className="admin-side">
            <div className="admin-side-head">
              <Icon name="activity" size={14} />
              <h3>{t('admin.activity')}</h3>
              <div style={{ flex: 1 }} />
              <button
                className="admin-side-close"
                onClick={() => setActivityOpen(false)}
                title={t('admin.activity_hide')}
                aria-label={t('admin.activity_hide')}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <ActivitySidebar users={users} />
          </aside>
        )}
      </div>

      {userDrawerId && <UserDrawer id={userDrawerId} onClose={() => setUserDrawerId(null)} />}
      {teamsDrawerOpen && <TeamsDrawer onClose={() => setTeamsDrawerOpen(false)} />}
      {tvDrawerOpen && <TVSetupDrawer onClose={() => setTvDrawerOpen(false)} />}
    </div>
  );
}

// FEtt86HtKR3: kompakte Listen-Ansicht der User-Sektion
function UserListTable({
  users,
  teamsById,
  doingCountByUser,
  onPick,
}: {
  users: AppUser[];
  teamsById: (id: string | null | undefined) => string;
  doingCountByUser: (uid: string) => number;
  onPick: (id: string) => void;
}) {
  const t = useT();
  return (
    <table className="admin-user-table">
      <thead>
        <tr>
          <th aria-label="avatar" />
          <th>{t('admin.users_section')}</th>
          <th>{t('admin.user_card_team')}</th>
          <th>{t('admin.user_card_capacity')}</th>
          <th>{t('admin.user_card_active')}</th>
          <th>{t('admin.user_table_status')}</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr
            key={u.id}
            className={`admin-user-row ${u.status === 'inactive' ? 'is-inactive' : ''} ${u.status === 'invited' ? 'is-invited' : ''}`}
            onClick={() => onPick(u.id)}
          >
            <td className="admin-user-row-avatar">
              <Avatar id={u.id} size={28} />
            </td>
            <td className="admin-user-row-name">
              <div className="admin-user-row-name-main">{u.name || u.email.split('@')[0]}</div>
              <div className="admin-user-row-name-sub">{u.email}</div>
            </td>
            <td>{teamsById(u.teamId)}</td>
            <td className="mono">
              {u.cap}h<span className="dim"> {t('admin.user_card_cap_per_week')}</span>
            </td>
            <td className="mono">{doingCountByUser(u.id)}</td>
            <td>
              <span className="admin-user-row-badges">
                {u.role === 'admin' && (
                  <span className="admin-user-badge admin">
                    <Icon name="shield-check" size={10} /> {t('admin.badge_admin')}
                  </span>
                )}
                {u.status === 'invited' && (
                  <span className="admin-user-badge invited">{t('admin.badge_invited')}</span>
                )}
                {u.status === 'inactive' && (
                  <span className="admin-user-badge inactive">{t('admin.badge_inactive')}</span>
                )}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UserCard({
  u,
  doingCount,
  teamName,
  onClick,
}: {
  u: AppUser;
  doingCount: number;
  teamName: string;
  onClick: () => void;
}) {
  const t = useT();
  const [locale] = useLocale();
  return (
    <div
      className={`admin-user-card ${u.status === 'inactive' ? 'is-inactive' : ''} ${u.status === 'invited' ? 'is-invited' : ''}`}
      onClick={onClick}
    >
      <div className="admin-user-card-head">
        <Avatar id={u.id} size={42} />
        <div className="admin-user-meta">
          <div className="admin-user-name">{u.name || u.email.split('@')[0]}</div>
          <div className="admin-user-role">{u.jobTitle || '—'}</div>
        </div>
        {u.role === 'admin' && (
          <div className="admin-user-badge admin">
            <Icon name="shield-check" size={10} /> {t('admin.badge_admin')}
          </div>
        )}
        {u.status === 'invited' && <div className="admin-user-badge invited">{t('admin.badge_invited')}</div>}
        {u.status === 'inactive' && <div className="admin-user-badge inactive">{t('admin.badge_inactive')}</div>}
      </div>

      <div className="admin-user-contacts">
        <div className="admin-user-contact" title={u.email}>
          <Icon name="mail" size={12} />
          <span>{u.email}</span>
        </div>
        {u.phone && (
          <div className="admin-user-contact">
            <Icon name="phone" size={12} />
            <span>{u.phone}</span>
          </div>
        )}
      </div>

      <div className="admin-user-stats">
        <div className="admin-user-stat">
          <div className="k">{t('admin.user_card_team')}</div>
          <div className="v">{teamName}</div>
        </div>
        <div className="admin-user-stat">
          <div className="k">{t('admin.user_card_capacity')}</div>
          <div className="v">
            {u.cap}h<span className="dim">{t('admin.user_card_cap_per_week')}</span>
          </div>
        </div>
        <div className="admin-user-stat">
          <div className="k">{t('admin.user_card_active')}</div>
          <div className="v">
            {doingCount}
            <span className="dim">{t('admin.user_card_active_unit')}</span>
          </div>
        </div>
      </div>

      <div className="admin-user-foot">
        <span className="dim">
          {t('admin.user_card_since', {
            date: new Date(u.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
              month: 'short',
              year: 'numeric',
            }),
          })}
        </span>
        <span className="admin-user-edit">
          <Icon name="edit-3" size={11} /> {t('admin.user_card_edit')}
        </span>
      </div>
    </div>
  );
}

function InviteCard({ inv, teamName }: { inv: AppInvitation; teamName?: string }) {
  const queryClient = useQueryClient();
  const t = useT();
  const display = inv.name || inv.email.split('@')[0];
  const initials = display
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const ageHours = Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60));
  const old = ageHours > 48;

  const refresh = () => queryClient.invalidateQueries({ queryKey: SYNC_KEYS.INVITATIONS });

  return (
    <div className="admin-invite-card">
      <div className="admin-invite-head">
        <div className="admin-invite-avatar">{initials}</div>
        <div className="admin-invite-meta">
          <div className="admin-invite-name">{display}</div>
          <div className="admin-invite-email">{inv.email}</div>
        </div>
        <div className={`admin-invite-status ${old ? 'old' : ''}`}>
          <span className="dot" />
          {old ? t('admin.invite_status_old') : t('admin.invite_status_new')}
        </div>
      </div>
      <div className="admin-invite-body">
        <div className="admin-invite-tags">
          {teamName && <span className="admin-invite-tag">{t('admin.invite_team_label', { name: teamName })}</span>}
          <span className="admin-invite-tag">
            {inv.role === 'admin' ? t('admin.invite_role_admin') : t('admin.invite_role_member')}
          </span>
          <span className="admin-invite-tag">{t('admin.invite_cap', { cap: inv.cap })}</span>
        </div>
        <div className="admin-invite-aging">{t('admin.invite_sent_ago', { when: fmtRel(inv.createdAt) })}</div>
      </div>
      <div className="admin-invite-foot">
        <button
          className="admin-btn ghost"
          onClick={async () => {
            await api.cancelInvitation(inv.id);
            await refresh();
            showToast(t('admin.invite_revoke_toast'));
          }}
        >
          <Icon name="x" size={11} /> {t('admin.invite_revoke')}
        </button>
        <button
          className="admin-btn ghost"
          onClick={async () => {
            await api.resendInvitation(inv.id);
            await refresh();
            showToast(t('admin.invite_resend_toast'));
          }}
        >
          <Icon name="send" size={11} /> {t('admin.invite_resend')}
        </button>
      </div>
    </div>
  );
}

function ActivitySidebar({ users }: { users: AppUser[] }) {
  const t = useT();
  const [tab, setTab] = useState<'all' | 'work' | 'admin'>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const { data: activity = [] } = useQuery({
    queryKey: ['btm', 'activity', actorFilter],
    queryFn: () =>
      api.listActivity({ limit: 50, actorId: actorFilter !== 'all' ? actorFilter : undefined }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const nameById = (id?: string | null) => {
    if (!id) return '—';
    const u = users.find((x) => x.id === id);
    return u ? u.name.split(' ')[0] || u.name : id;
  };

  const filtered = activity.filter((a) => {
    if (tab === 'work') return WORK_KINDS.has(a.kind);
    if (tab === 'admin') return !WORK_KINDS.has(a.kind);
    return true;
  });

  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="admin-side-tabs">
        {(
          [
            { id: 'all', label: t('admin.activity_tab_all') },
            { id: 'work', label: t('admin.activity_tab_work') },
            { id: 'admin', label: t('admin.activity_tab_admin') },
          ] as const
        ).map((tb) => (
          <button
            key={tb.id}
            className={`admin-side-tab ${tab === tb.id ? 'active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <select
        className="admin-side-actor-filter"
        value={actorFilter}
        onChange={(e) => setActorFilter(e.target.value)}
        aria-label={t('admin.activity_filter_user_label')}
      >
        <option value="all">{t('admin.activity_filter_all_users')}</option>
        {sortedUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <div className="admin-side-list">
        {filtered.length === 0 && <div className="admin-empty">{t('admin.activity_empty')}</div>}
        {filtered.map((a) => {
          const v = activityLine(a, nameById);
          return (
            <div key={a.id} className="admin-activity">
              <div
                className="admin-activity-icon"
                style={{
                  background: `${v.color}22`,
                  color: v.color,
                  borderColor: `${v.color}44`,
                }}
              >
                <Icon name={v.icon} size={11} />
              </div>
              <div className="admin-activity-body">
                <div className="admin-activity-text">{v.text}</div>
                <div className="admin-activity-time">{fmtRel(a.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DevCloneWidget() {
  const [status, setStatus] = useState<'idle' | 'running' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const clone = async () => {
    if (!confirm('Prod-DB komplett in Beta-DB klonen? Alle bestehenden Beta-Daten werden überschrieben.')) return;
    setStatus('running');
    setMsg('');
    try {
      const r = await fetch('/api/admin/clone-prod-db', {
        method: 'POST',
        credentials: 'include',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Fehler');
      setStatus('ok');
      setMsg(j.note ?? 'Fertig');
    } catch (e) {
      setStatus('error');
      setMsg(e instanceof Error ? e.message : 'Unbekannter Fehler');
    }
  };

  return (
    <section className="admin-section" style={{ borderTop: '2px solid var(--c-accent)', marginTop: '1.5rem' }}>
      <div className="admin-section-head">
        <Icon name="database" size={14} />
        <h3>⚡ Beta-Dev: Prod-DB klonen</h3>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--c-text-2)', marginBottom: '0.75rem' }}>
        Kopiert die komplette Produktions-Datenbank in diese Beta-Instanz. Bestehende Beta-Daten gehen verloren.
      </p>
      <button
        className="admin-invite-btn"
        onClick={clone}
        disabled={status === 'running'}
        style={{ background: status === 'error' ? 'var(--c-danger, #c0392b)' : undefined }}
      >
        {status === 'running' ? (
          <><Icon name="loader-2" size={13} className="login-spin" /> Klone …</>
        ) : (
          <><Icon name="download" size={13} /> Prod-DB jetzt klonen</>
        )}
      </button>
      {msg && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: status === 'ok' ? 'var(--c-accent)' : 'var(--c-danger, #c0392b)' }}>
          {msg}
        </p>
      )}
    </section>
  );
}
