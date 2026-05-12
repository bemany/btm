import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AppUser, AppTeam } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import * as api from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { PALETTE } from './adminUtils';
import { useT } from '../../i18n';

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
  status: 'active' | 'invited' | 'inactive';
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
  const t = useT();

  const existing = !isNew ? users.find((u) => u.id === id) : null;

  const [draft, setDraft] = useState<Draft>(() => (existing ? fromUser(existing) : emptyDraft(teams)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) setDraft(fromUser(existing));
  }, [existing?.id]);

  const userTasks = !isNew && existing ? tasks.filter((tk) => tk.who === existing.id) : [];

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isNew) {
        if (!draft.email || !draft.name) {
          showToast(t('admin.err_name_email'));
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
        showToast(t('admin.invite_sent', { email: draft.email }));
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
        showToast(t('admin.profile_updated'));
      }
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('toast.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (isNew || !existing) return;
    const next = existing.status === 'inactive' ? 'active' : 'inactive';
    await api.updateUser(existing.id, { status: next });
    await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.USERS });
    showToast(next === 'inactive' ? t('admin.deactivated_toast') : t('admin.reactivated_toast'));
    onClose();
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer admin-drawer">
        <div className="drawer-head">
          <div className="admin-drawer-eyebrow">
            {isNew ? t('admin.drawer_eyebrow_new') : t('admin.drawer_eyebrow_edit')}
          </div>
          <div style={{ flex: 1 }} />
          {!isNew && existing && (
            <span className={`admin-status-pill ${existing.status}`}>
              <span className="dot" />
              {existing.status === 'active' ? t('admin.status_active') : t('admin.status_inactive')}
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
                placeholder={t('admin.name_placeholder')}
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <input
                className="admin-input subtle"
                placeholder={t('admin.job_placeholder')}
                value={draft.jobTitle}
                onChange={(e) => update({ jobTitle: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-drawer-section">
            <div className="admin-drawer-section-label">{t('admin.section_contact')}</div>
            <div className="admin-field">
              <label>{t('admin.field_email')}</label>
              <input
                className="admin-input"
                type="email"
                disabled={!isNew}
                placeholder={t('admin.email_placeholder')}
                value={draft.email}
                onChange={(e) => update({ email: e.target.value })}
              />
              {!isNew && <div className="hint">{t('admin.email_locked_hint')}</div>}
            </div>
            <div className="admin-field">
              <label>{t('admin.field_phone')}</label>
              <input
                className="admin-input"
                placeholder="+49 …"
                value={draft.phone}
                onChange={(e) => update({ phone: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-drawer-section">
            <div className="admin-drawer-section-label">{t('admin.section_org')}</div>
            <div className="admin-field">
              <label>{t('admin.field_team')}</label>
              <select
                className="admin-input"
                value={draft.teamId ?? ''}
                onChange={(e) => update({ teamId: e.target.value || null })}
              >
                <option value="">{t('admin.team_none')}</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label>{t('admin.field_capacity')}</label>
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
                  <span className="dim">{t('admin.cap_unit')}</span>
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
                <label>{t('admin.field_color')}</label>
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

          <div className="admin-drawer-section">
            <div className="admin-drawer-section-label">{t('admin.section_perm')}</div>
            <div className="admin-access-toggle">
              <button
                className={`admin-access-opt ${draft.role === 'member' ? 'active' : ''}`}
                onClick={() => update({ role: 'member' })}
              >
                <Icon name="user" size={14} />
                <div>
                  <div className="lbl">{t('admin.perm_member')}</div>
                  <div className="sub">{t('admin.perm_member_sub')}</div>
                </div>
              </button>
              <button
                className={`admin-access-opt ${draft.role === 'admin' ? 'active' : ''}`}
                onClick={() => update({ role: 'admin' })}
              >
                <Icon name="shield-check" size={14} />
                <div>
                  <div className="lbl">{t('admin.perm_admin')}</div>
                  <div className="sub">{t('admin.perm_admin_sub')}</div>
                </div>
              </button>
            </div>
          </div>

          {!isNew && existing && (
            <div className="admin-drawer-section">
              <div className="admin-drawer-section-label">{t('admin.section_load')}</div>
              <div className="admin-drawer-stats">
                <div className="admin-drawer-stat">
                  <div className="k">{t('admin.load_open')}</div>
                  <div className="v">{userTasks.filter((tk) => tk.col !== 'done').length}</div>
                </div>
                <div className="admin-drawer-stat">
                  <div className="k">{t('admin.load_doing')}</div>
                  <div className="v" style={{ color: 'var(--accent-600)' }}>
                    {userTasks.filter((tk) => tk.col === 'doing').length}
                  </div>
                </div>
                <div className="admin-drawer-stat">
                  <div className="k">{t('admin.load_done')}</div>
                  <div className="v">{userTasks.filter((tk) => tk.col === 'done').length}</div>
                </div>
                <div className="admin-drawer-stat">
                  <div className="k">{t('admin.load_logged')}</div>
                  <div className="v">{userTasks.reduce((s, tk) => s + (tk.loggedH || 0), 0).toFixed(1)}h</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="admin-drawer-foot">
          {!isNew && existing && (
            <button className="admin-btn ghost danger" onClick={toggleStatus}>
              <Icon name={existing.status === 'inactive' ? 'user-check' : 'user-minus'} size={12} />
              {existing.status === 'inactive' ? t('admin.btn_reactivate') : t('admin.btn_deactivate')}
            </button>
          )}
          {!isNew && existing && (
            <button
              className="admin-btn ghost"
              onClick={async () => {
                try {
                  const res = await api.adminMagicLink(existing.id);
                  // Pre-signed Link: ?as=email&code=… → LoginScreen verifiziert
                  // automatisch beim Öffnen. Nur die URL kopieren — Email + Code
                  // sind in den Query-Params schon enthalten.
                  await navigator.clipboard.writeText(res.url);
                  showToast(t('admin.magic_link_copied', { email: res.email }));
                } catch {
                  showToast(t('common.error_generic'));
                }
              }}
              title={t('admin.magic_link_title')}
            >
              <Icon name="key-round" size={12} />
              {t('admin.magic_link_btn')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="admin-btn ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button className="admin-btn accent" onClick={save} disabled={saving}>
            <Icon name={isNew ? 'send' : 'check'} size={12} />
            {isNew ? t('admin.btn_send_invite') : t('common.save')}
          </button>
        </div>
      </div>
    </>
  );
}
