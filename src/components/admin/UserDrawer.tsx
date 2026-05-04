import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AppUser, AppTeam } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import * as api from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { PALETTE } from './adminUtils';

interface Props {
  id: string; // existing user id OR '__new__'
  onClose: () => void;
}

interface Draft {
  email: string;
  name: string;
  jobTitle: string;
  phone: string;
  teamId: string | null;
  cap: number;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
  color: string;
}

function emptyDraft(teams: AppTeam[]): Draft {
  return {
    email: '',
    name: '',
    jobTitle: '',
    phone: '',
    teamId: teams[0]?.id ?? null,
    cap: 40,
    role: 'member',
    status: 'active',
    color: PALETTE[0],
  };
}

function fromUser(u: AppUser): Draft {
  return {
    email: u.email,
    name: u.name,
    jobTitle: u.jobTitle ?? '',
    phone: u.phone ?? '',
    teamId: u.teamId ?? null,
    cap: u.cap,
    role: u.role,
    status: u.status,
    color: u.color,
  };
}

function initialsOf(name: string, email: string): string {
  const src = name.trim() || email.split('@')[0];
  const parts = src.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserDrawer({ id, onClose }: Props) {
  const isNew = id === '__new__';
  const users = useStore((s) => s.users);
  const teams = useStore((s) => s.teams);
  const tasks = useStore((s) => s.tasks);
  const queryClient = useQueryClient();

  const existing = !isNew ? users.find((u) => u.id === id) : null;

  const [draft, setDraft] = useState<Draft>(() => (existing ? fromUser(existing) : emptyDraft(teams)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) setDraft(fromUser(existing));
  }, [existing?.id]);

  const userTasks = !isNew && existing ? tasks.filter((t) => t.who === existing.id) : [];

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isNew) {
        if (!draft.email || !draft.name) {
          showToast('Name & E-Mail nötig');
          setSaving(false);
          return;
        }
        await api.sendInvitation({
          email: draft.email,
          name: draft.name,
          role: draft.role,
          teamId: draft.teamId,
          cap: draft.cap,
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: SYNC_KEYS.USERS }),
          queryClient.invalidateQueries({ queryKey: SYNC_KEYS.INVITATIONS }),
        ]);
        showToast(`Einladung an ${draft.email} gesendet`);
      } else {
        await api.updateUser(id, {
          name: draft.name,
          jobTitle: draft.jobTitle || null,
          phone: draft.phone || null,
          cap: draft.cap,
          color: draft.color,
          role: draft.role,
          teamId: draft.teamId,
        });
        await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.USERS });
        showToast('Profil aktualisiert');
      }
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (isNew || !existing) return;
    const next = existing.status === 'inactive' ? 'active' : 'inactive';
    await api.updateUser(existing.id, { status: next });
    await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.USERS });
    showToast(next === 'inactive' ? 'Deaktiviert' : 'Reaktiviert');
    onClose();
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer admin-drawer">
        <div className="drawer-head">
          <div className="admin-drawer-eyebrow">{isNew ? 'Neuen Nutzer einladen' : 'Nutzer bearbeiten'}</div>
          <div style={{ flex: 1 }} />
          {!isNew && existing && (
            <span className={`admin-status-pill ${existing.status}`}>
              <span className="dot" />
              {existing.status === 'active' ? 'Aktiv' : 'Deaktiviert'}
            </span>
          )}
          <button className="x" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Avatar / Identity */}
          <div className="admin-drawer-identity">
            <div className="admin-drawer-avatar" style={{ background: draft.color }}>
              {initialsOf(draft.name, draft.email)}
            </div>
            <div style={{ flex: 1 }}>
              <input
                className="admin-input title"
                placeholder="Vor- und Nachname"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <input
                className="admin-input subtle"
                placeholder="Funktion (z.B. Backend-Engineer)"
                value={draft.jobTitle}
                onChange={(e) => update({ jobTitle: e.target.value })}
              />
            </div>
          </div>

          {/* Kontakt */}
          <div className="admin-drawer-section">
            <div className="admin-drawer-section-label">Kontakt</div>
            <div className="admin-field">
              <label>E-Mail</label>
              <input
                className="admin-input"
                type="email"
                disabled={!isNew}
                placeholder="vorname.nachname@bethesna.org"
                value={draft.email}
                onChange={(e) => update({ email: e.target.value })}
              />
              {!isNew && <div className="hint">E-Mail kann nach Anlegen nicht mehr geändert werden.</div>}
            </div>
            <div className="admin-field">
              <label>Telefon</label>
              <input
                className="admin-input"
                placeholder="+49 …"
                value={draft.phone}
                onChange={(e) => update({ phone: e.target.value })}
              />
            </div>
          </div>

          {/* Organisation */}
          <div className="admin-drawer-section">
            <div className="admin-drawer-section-label">Organisation</div>
            <div className="admin-field">
              <label>Team</label>
              <select
                className="admin-input"
                value={draft.teamId ?? ''}
                onChange={(e) => update({ teamId: e.target.value || null })}
              >
                <option value="">— kein Team —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label>Kapazität · Sollstunden pro Woche</label>
              <div className="admin-cap-row">
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="4"
                  value={draft.cap}
                  onChange={(e) => update({ cap: parseInt(e.target.value, 10) })}
                />
                <div className="admin-cap-val">
                  {draft.cap}
                  <span className="dim">h/Wo</span>
                </div>
              </div>
              <div className="admin-cap-marks">
                {[0, 8, 16, 20, 24, 32, 40].map((m) => (
                  <button
                    key={m}
                    className={`admin-cap-mark ${draft.cap === m ? 'active' : ''}`}
                    onClick={() => update({ cap: m })}
                  >
                    {m}h
                  </button>
                ))}
              </div>
            </div>
            {!isNew && (
              <div className="admin-field">
                <label>Avatar-Farbe</label>
                <div className="admin-team-palette">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      className={`admin-team-color ${draft.color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => update({ color: c })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Berechtigung */}
          <div className="admin-drawer-section">
            <div className="admin-drawer-section-label">Berechtigung</div>
            <div className="admin-access-toggle">
              <button
                className={`admin-access-opt ${draft.role === 'member' ? 'active' : ''}`}
                onClick={() => update({ role: 'member' })}
              >
                <Icon name="user" size={14} />
                <div>
                  <div className="lbl">Mitglied</div>
                  <div className="sub">Aufgaben, Zeiten, Board</div>
                </div>
              </button>
              <button
                className={`admin-access-opt ${draft.role === 'admin' ? 'active' : ''}`}
                onClick={() => update({ role: 'admin' })}
              >
                <Icon name="shield-check" size={14} />
                <div>
                  <div className="lbl">Admin</div>
                  <div className="sub">User &amp; Teams verwalten</div>
                </div>
              </button>
            </div>
          </div>

          {/* Stats */}
          {!isNew && existing && (
            <div className="admin-drawer-section">
              <div className="admin-drawer-section-label">Aktuelle Auslastung</div>
              <div className="admin-drawer-stats">
                <div className="admin-drawer-stat">
                  <div className="k">Offen</div>
                  <div className="v">{userTasks.filter((t) => t.col !== 'done').length}</div>
                </div>
                <div className="admin-drawer-stat">
                  <div className="k">In Arbeit</div>
                  <div className="v" style={{ color: 'var(--accent-600)' }}>
                    {userTasks.filter((t) => t.col === 'doing').length}
                  </div>
                </div>
                <div className="admin-drawer-stat">
                  <div className="k">Erledigt</div>
                  <div className="v">{userTasks.filter((t) => t.col === 'done').length}</div>
                </div>
                <div className="admin-drawer-stat">
                  <div className="k">Geloggt</div>
                  <div className="v">{userTasks.reduce((s, t) => s + (t.loggedH || 0), 0).toFixed(1)}h</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="admin-drawer-foot">
          {!isNew && existing && (
            <button className="admin-btn ghost danger" onClick={toggleStatus}>
              <Icon name={existing.status === 'inactive' ? 'user-check' : 'user-minus'} size={12} />
              {existing.status === 'inactive' ? 'Reaktivieren' : 'Deaktivieren'}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="admin-btn ghost" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button className="admin-btn accent" onClick={save} disabled={saving}>
            <Icon name={isNew ? 'send' : 'check'} size={12} />
            {isNew ? 'Einladung senden' : 'Speichern'}
          </button>
        </div>
      </div>
    </>
  );
}
