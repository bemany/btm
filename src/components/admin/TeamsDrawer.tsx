import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import * as api from '../../data/api';
import { SYNC_KEYS } from '../../data/sync';
import { PALETTE } from './adminUtils';

export function TeamsDrawer({ onClose }: { onClose: () => void }) {
  const teams = useStore((s) => s.teams);
  const users = useStore((s) => s.users);
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#5E7F4E');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const memberCount = (teamId: string) => users.filter((u) => u.teamId === teamId).length;

  const submit = async () => {
    if (!name.trim()) {
      showToast('Team-Name nötig');
      return;
    }
    await api.createTeam(name.trim(), color);
    await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.TEAMS });
    showToast(`Team „${name.trim()}" angelegt`);
    setName('');
    setColor('#5E7F4E');
  };

  const startEdit = (id: string, n: string, c: string) => {
    setEditingId(id);
    setEditName(n);
    setEditColor(c);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await api.updateTeam(id, { name: editName.trim(), color: editColor });
    await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.TEAMS });
    showToast('Team aktualisiert');
    setEditingId(null);
  };

  const removeTeam = async (id: string) => {
    const n = memberCount(id);
    if (n > 0) {
      showToast(`Team hat noch ${n} Mitglied${n === 1 ? '' : 'er'}`);
      return;
    }
    await api.deleteTeam(id);
    await queryClient.invalidateQueries({ queryKey: SYNC_KEYS.TEAMS });
    showToast('Team gelöscht');
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer admin-drawer">
        <div className="drawer-head">
          <div className="admin-drawer-eyebrow">Teams verwalten</div>
          <div style={{ flex: 1 }} />
          <span className="admin-section-count">{teams.length}</span>
          <button className="x" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="admin-drawer-section">
            <div className="admin-drawer-section-label">Neues Team anlegen</div>
            <div className="admin-team-create">
              <div className="admin-team-create-row">
                <span className="admin-team-swatch" style={{ background: color }} />
                <input
                  className="admin-input"
                  placeholder="Team-Name (z.B. Design, QA, Operations)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                  }}
                />
                <button className="admin-btn accent" onClick={() => void submit()}>
                  <Icon name="plus" size={12} /> Anlegen
                </button>
              </div>
              <div className="admin-team-palette">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    className={`admin-team-color ${color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="admin-drawer-section">
            <div className="admin-drawer-section-label">Bestehende Teams</div>
            <div className="admin-team-list">
              {teams.length === 0 && (
                <div className="admin-empty" style={{ padding: 16 }}>
                  Noch keine Teams. Leg eins an.
                </div>
              )}
              {teams.map((t) => {
                const n = memberCount(t.id);
                const isEdit = editingId === t.id;
                return (
                  <div key={t.id} className="admin-team-row">
                    {!isEdit ? (
                      <>
                        <span className="admin-team-swatch" style={{ background: t.color }} />
                        <div className="admin-team-info">
                          <div className="admin-team-name">{t.name}</div>
                          <div className="admin-team-meta">
                            {n} {n === 1 ? 'Mitglied' : 'Mitglieder'}
                          </div>
                        </div>
                        <div className="admin-team-actions">
                          <button className="admin-btn ghost" onClick={() => startEdit(t.id, t.name, t.color)}>
                            <Icon name="edit-3" size={11} /> Bearbeiten
                          </button>
                          <button
                            className="admin-btn ghost danger"
                            onClick={() => void removeTeam(t.id)}
                            disabled={n > 0}
                            title={n > 0 ? 'Team hat noch Mitglieder' : 'Team löschen'}
                          >
                            <Icon name="trash-2" size={11} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="admin-team-swatch" style={{ background: editColor }} />
                        <div className="admin-team-info" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input
                            className="admin-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveEdit(t.id);
                            }}
                            autoFocus
                          />
                          <div className="admin-team-palette">
                            {PALETTE.map((c) => (
                              <button
                                key={c}
                                className={`admin-team-color ${editColor === c ? 'active' : ''}`}
                                style={{ background: c }}
                                onClick={() => setEditColor(c)}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="admin-team-actions">
                          <button className="admin-btn accent" onClick={() => void saveEdit(t.id)}>
                            <Icon name="check" size={11} /> Speichern
                          </button>
                          <button className="admin-btn ghost" onClick={() => setEditingId(null)}>
                            Abbrechen
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="admin-drawer-foot">
          <div style={{ flex: 1, fontSize: 11.5, color: 'var(--ink-500)' }}>
            Nutzer können Teams im Profil zugewiesen werden.
          </div>
          <button className="admin-btn ghost" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </>
  );
}
