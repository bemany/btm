// Mitglieder-Verwaltung für ein Projekt.
//
// Zeigt:
//  • Verantwortlicher (Owner) als Hero-Card oben mit Picker zum Wechseln
//  • Mitgliederliste mit Rolle (member / viewer) und Aktionen (Rolle
//    ändern, Entfernen)
//  • Add-Form (User-Picker + Rollen-Toggle)
//
// Berechtigt sind: Admin, Projekt-Owner. Andere sehen die Section
// schreibgeschützt — Edit-/Delete-Buttons sind disabled.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { ProjectMemberRole } from '../../data/api';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { useT } from '../../i18n';
import { SYNC_KEYS } from '../../data/sync';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';

export interface ProjectMembersSectionProps {
  projectId: string;
  ownerId: string | null | undefined;
  onOwnerChange: (newOwnerId: string | null) => void;
}

const ROLE_OPTIONS: Array<{ id: ProjectMemberRole; labelKey: string }> = [
  { id: 'member', labelKey: 'project_members.role_member' },
  { id: 'viewer', labelKey: 'project_members.role_viewer' },
];

export function ProjectMembersSection({
  projectId,
  ownerId,
  onOwnerChange,
}: ProjectMembersSectionProps) {
  const t = useT();
  const users = useStore((s) => s.users);
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const isOwner = !!me && ownerId === me.id;
  const canManage = isAdmin || isOwner;
  const queryClient = useQueryClient();
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<ProjectMemberRole>('member');
  const [busy, setBusy] = useState(false);

  const membersQ = useQuery({
    queryKey: [...SYNC_KEYS.PROJECT_MEMBERS, projectId],
    queryFn: () => api.listProjectMembers(projectId),
    staleTime: 15_000,
  });
  const members = membersQ.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [...SYNC_KEYS.PROJECT_MEMBERS, projectId] });
  };

  const ownerUser = ownerId ? users.find((u) => u.id === ownerId) : null;

  const memberIds = new Set(members.map((m) => m.userId));
  const availableForAdd = users.filter(
    (u) => !memberIds.has(u.id) && u.status === 'active' && u.id !== ownerId,
  );

  const handleAdd = async () => {
    if (!addUserId || busy) return;
    setBusy(true);
    try {
      await api.addProjectMember(projectId, addUserId, addRole);
      setAddUserId('');
      setAddRole('member');
      refresh();
    } catch (e) {
      console.error('addMember failed', e);
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (userId: string, role: ProjectMemberRole) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateProjectMemberRole(projectId, userId, role);
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (busy) return;
    if (!confirm(t('project_members.remove_confirm'))) return;
    setBusy(true);
    try {
      await api.removeProjectMember(projectId, userId);
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const handleOwnerChange = (newOwnerId: string) => {
    onOwnerChange(newOwnerId || null);
  };

  return (
    <div className="pm-section">
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {t('project_members.heading_owner')}
      </div>
      <div className="pm-owner">
        {ownerUser ? (
          <>
            <Avatar id={ownerUser.id} size={32} />
            <div className="pm-owner-text">
              <div className="pm-owner-name">{ownerUser.name}</div>
              <div className="pm-owner-sub">{t('project_members.owner_sub')}</div>
            </div>
          </>
        ) : (
          <div className="pm-owner-empty">
            <Icon name="user-x" size={14} className="pm-owner-empty-icon" />
            <span>{t('project_members.owner_none')}</span>
          </div>
        )}
        {canManage && (
          <select
            className="pm-owner-select"
            value={ownerId ?? ''}
            onChange={(e) => handleOwnerChange(e.target.value)}
            disabled={busy}
          >
            <option value="">{t('project_members.owner_pick_placeholder')}</option>
            {users
              .filter((u) => u.status === 'active')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        )}
      </div>

      <div className="eyebrow" style={{ marginTop: 14, marginBottom: 8 }}>
        {t('project_members.heading_members', { count: members.length })}
      </div>
      <div className="pm-list">
        {members.length === 0 && !membersQ.isLoading && (
          <div className="pm-empty">{t('project_members.empty')}</div>
        )}
        {members.map((m) => (
          <div key={m.userId} className="pm-row">
            <Avatar id={m.userId} size={26} />
            <div className="pm-row-text">
              <div className="pm-row-name">{m.name ?? m.email ?? m.userId}</div>
              <div className="pm-row-sub">{m.email}</div>
            </div>
            {canManage ? (
              <select
                className="pm-row-role"
                value={m.role}
                onChange={(e) => handleRoleChange(m.userId, e.target.value as ProjectMemberRole)}
                disabled={busy}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {t(opt.labelKey as 'project_members.role_member')}
                  </option>
                ))}
              </select>
            ) : (
              <span className="pm-row-role-pill">
                {t(
                  ('project_members.role_' + m.role) as 'project_members.role_member',
                )}
              </span>
            )}
            {canManage && (
              <button
                type="button"
                className="pm-row-remove"
                onClick={() => handleRemove(m.userId)}
                disabled={busy}
                title={t('common.remove')}
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canManage && availableForAdd.length > 0 && (
        <div className="pm-add">
          <select
            className="pm-add-user"
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            disabled={busy}
          >
            <option value="">{t('project_members.add_placeholder')}</option>
            {availableForAdd.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            className="pm-add-role"
            value={addRole}
            onChange={(e) => setAddRole(e.target.value as ProjectMemberRole)}
            disabled={busy}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {t(opt.labelKey as 'project_members.role_member')}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="tb-btn"
            onClick={handleAdd}
            disabled={busy || !addUserId}
          >
            <Icon name="plus" size={12} /> {t('common.add')}
          </button>
        </div>
      )}
    </div>
  );
}
