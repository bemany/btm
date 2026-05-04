import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import type { AppUser, AppInvitation } from '../../store/types';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { showToast } from '../shared/Toast';
import * as api from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { fmtRel, activityLine, WORK_KINDS } from './adminUtils';
import { UserDrawer } from './UserDrawer';
import { TeamsDrawer } from './TeamsDrawer';
import { TVSetupDrawer } from './TVSetupDrawer';

type FilterMode = 'all' | 'active' | 'admin' | 'inactive';

export function AdminScreen() {
  const users = useStore((s) => s.users);
  const teams = useStore((s) => s.teams);
  const invitations = useStore((s) => s.invitations);
  const tasks = useStore((s) => s.tasks);

  const [filter, setFilter] = useState<FilterMode>('all');
  const [q, setQ] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [userDrawerId, setUserDrawerId] = useState<string | null>(null);
  const [teamsDrawerOpen, setTeamsDrawerOpen] = useState(false);
  const [tvDrawerOpen, setTvDrawerOpen] = useState(false);

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
      <div className="admin-grid">
        <div className="admin-main">
          <div className="admin-header">
            <div className="admin-stat">
              <div className="admin-stat-label">Aktive Nutzer</div>
              <div className="admin-stat-val">
                {counts.active}
                <span className="admin-stat-suffix">/ {counts.all}</span>
              </div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">Admins</div>
              <div className="admin-stat-val">{counts.admin}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-label">Offene Einladungen</div>
              <div
                className="admin-stat-val"
                style={{ color: counts.pending > 0 ? 'var(--accent-600)' : 'inherit' }}
              >
                {counts.pending}
              </div>
            </div>
            <div className="admin-stat admin-stat-clickable" onClick={() => setTeamsDrawerOpen(true)}>
              <div className="admin-stat-label">Teams</div>
              <div className="admin-stat-val">
                {teams.length}
                <span className="admin-stat-suffix" style={{ fontSize: 11, color: 'var(--accent-600)' }}>
                  verwalten →
                </span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <button className="tb-btn" onClick={() => setTvDrawerOpen(true)}>
              <Icon name="monitor" size={14} /> Office-Display
            </button>
            <button className="tb-btn" onClick={() => setTeamsDrawerOpen(true)}>
              <Icon name="users" size={14} /> Teams
            </button>
            <button className="tb-btn accent" onClick={() => setUserDrawerId('__new__')}>
              <Icon name="user-plus" size={14} /> Nutzer einladen
            </button>
          </div>

          <div className="admin-filterbar">
            <div className="admin-search">
              <Icon name="search" size={14} />
              <input
                placeholder="Nutzer durchsuchen…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="admin-chips">
              {(
                [
                  { id: 'all', label: 'Alle', n: counts.all },
                  { id: 'active', label: 'Aktiv', n: counts.active },
                  { id: 'admin', label: 'Admins', n: counts.admin },
                  { id: 'inactive', label: 'Deaktiviert', n: counts.inactive },
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
              <option value="all">Alle Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {invitations.length > 0 && (
            <div className="admin-section">
              <div className="admin-section-head">
                <Icon name="mail" size={14} />
                <h3>Ausstehende Einladungen</h3>
                <span className="admin-section-count">{invitations.length}</span>
              </div>
              <div className="admin-invite-grid">
                {invitations.map((inv) => (
                  <InviteCard key={inv.id} inv={inv} teamName={teams.find((t) => t.id === inv.teamId)?.name} />
                ))}
              </div>
            </div>
          )}

          <div className="admin-section">
            <div className="admin-section-head">
              <Icon name="users" size={14} />
              <h3>Nutzer</h3>
              <span className="admin-section-count">{filtered.length}</span>
            </div>
            {filtered.length === 0 && (
              <div className="admin-empty">Keine Nutzer mit diesen Filtern.</div>
            )}
            <div className="admin-user-grid">
              {filtered.map((u) => (
                <UserCard
                  key={u.id}
                  u={u}
                  doingCount={tasks.filter((t) => t.who === u.id && t.col === 'doing').length}
                  teamName={teams.find((t) => t.id === u.teamId)?.name ?? '—'}
                  onClick={() => setUserDrawerId(u.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="admin-side">
          <div className="admin-side-head">
            <Icon name="activity" size={14} />
            <h3>Aktivität</h3>
          </div>
          <ActivitySidebar users={users} />
        </aside>
      </div>

      {userDrawerId && <UserDrawer id={userDrawerId} onClose={() => setUserDrawerId(null)} />}
      {teamsDrawerOpen && <TeamsDrawer onClose={() => setTeamsDrawerOpen(false)} />}
      {tvDrawerOpen && <TVSetupDrawer onClose={() => setTvDrawerOpen(false)} />}
    </div>
  );
}

// ── UserCard ────────────────────────────────────────────────────────────

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
  return (
    <div
      className={`admin-user-card ${u.status === 'inactive' ? 'is-inactive' : ''}`}
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
            <Icon name="shield-check" size={10} /> Admin
          </div>
        )}
        {u.status === 'inactive' && <div className="admin-user-badge inactive">Deaktiviert</div>}
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
          <div className="k">Team</div>
          <div className="v">{teamName}</div>
        </div>
        <div className="admin-user-stat">
          <div className="k">Kapazität</div>
          <div className="v">
            {u.cap}h<span className="dim">/Wo</span>
          </div>
        </div>
        <div className="admin-user-stat">
          <div className="k">Aktiv</div>
          <div className="v">
            {doingCount}
            <span className="dim"> Tasks</span>
          </div>
        </div>
      </div>

      <div className="admin-user-foot">
        <span className="dim">
          Seit{' '}
          {new Date(u.createdAt).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
        </span>
        <span className="admin-user-edit">
          <Icon name="edit-3" size={11} /> Bearbeiten
        </span>
      </div>
    </div>
  );
}

// ── InviteCard ──────────────────────────────────────────────────────────

function InviteCard({ inv, teamName }: { inv: AppInvitation; teamName?: string }) {
  const queryClient = useQueryClient();
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
          {old ? 'Wartet >2 Tage' : 'Eingeladen'}
        </div>
      </div>
      <div className="admin-invite-body">
        <div className="admin-invite-tags">
          {teamName && <span className="admin-invite-tag">Team {teamName}</span>}
          <span className="admin-invite-tag">{inv.role === 'admin' ? 'Admin' : 'Mitglied'}</span>
          <span className="admin-invite-tag">{inv.cap}h/Wo</span>
        </div>
        <div className="admin-invite-aging">{fmtRel(inv.createdAt)} gesendet</div>
      </div>
      <div className="admin-invite-foot">
        <button
          className="admin-btn ghost"
          onClick={async () => {
            await api.cancelInvitation(inv.id);
            await refresh();
            showToast('Einladung zurückgezogen');
          }}
        >
          <Icon name="x" size={11} /> Zurückziehen
        </button>
        <button
          className="admin-btn ghost"
          onClick={async () => {
            await api.resendInvitation(inv.id);
            await refresh();
            showToast('Einladung erneut gesendet');
          }}
        >
          <Icon name="send" size={11} /> Erneut senden
        </button>
      </div>
    </div>
  );
}

// ── ActivitySidebar ─────────────────────────────────────────────────────

function ActivitySidebar({ users }: { users: AppUser[] }) {
  const [tab, setTab] = useState<'all' | 'work' | 'admin'>('all');
  const { data: activity = [] } = useQuery({
    queryKey: ['btm', 'activity'],
    queryFn: () => api.listActivity({ limit: 50 }),
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

  return (
    <>
      <div className="admin-side-tabs">
        {(
          [
            { id: 'all', label: 'Alle' },
            { id: 'work', label: 'Arbeit' },
            { id: 'admin', label: 'Admin' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={`admin-side-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="admin-side-list">
        {filtered.length === 0 && <div className="admin-empty">Noch keine Aktivität.</div>}
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
