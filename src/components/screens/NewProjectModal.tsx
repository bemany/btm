import { useEffect, useState } from 'react';
import type { Project } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT, useLocale } from '../../i18n';
import { DatePicker } from '../shared/DatePicker';

const PALETTE = [
  '#C85A2C',
  '#5573A0',
  '#5E7F4E',
  '#B88A2E',
  '#6B6359',
  '#8a5a8a',
  '#9a3838',
  '#3F6F75',
];

export interface NewProjectModalProps {
  onClose: () => void;
  existing?: Project | null;
}

export function NewProjectModal({ onClose, existing }: NewProjectModalProps) {
  const addProject = useStore((s) => s.addProject);
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const users = useStore((s) => s.users);
  const t = useT();
  const [locale] = useLocale();

  const isEdit = !!existing;
  const [code, setCode] = useState(existing?.code || '');
  const [name, setName] = useState(existing?.name || '');
  const [client, setClient] = useState(existing?.client || 'Mein Driver');
  const [due, setDue] = useState(existing?.due || '');
  const [color, setColor] = useState(existing?.color || PALETTE[0]);
  const [ownerId, setOwnerId] = useState<string | null>(existing?.ownerId ?? null);

  const canSave = code.trim().length > 0 && name.trim().length > 0;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    if (!canSave) return;
    const codeUp = code.trim().toUpperCase();
    if (isEdit && existing) {
      await updateProject(existing.id, {
        code: codeUp,
        name: name.trim(),
        client: client.trim(),
        due: due || null,
        color,
        ownerId,
      });
      showToast(t('projects.saved_toast', { code: codeUp }));
    } else {
      const p = await addProject({
        code: codeUp,
        name: name.trim(),
        client: client.trim(),
        due: due || null,
        color,
        ownerId,
      });
      showToast(p ? t('projects.created_toast', { code: p.code }) : t('projects.create_failed'));
    }
    onClose();
  };

  const onDelete = () => {
    if (!isEdit || !existing) return;
    if (!window.confirm(t('projects.delete_confirm', { code: existing.code }))) return;
    deleteProject(existing.id);
    showToast(t('projects.delete_toast', { code: existing.code }));
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h3>{isEdit ? t('projects.edit_title') : t('projects.new_project')}</h3>
          <button type="button" className="x" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid-2">
            <div className="form-row">
              <label>{t('projects.project_code')}</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('projects.code_placeholder')}
                autoFocus
              />
              <div className="hint">{t('projects.code_hint')}</div>
            </div>
            <div className="form-row">
              <label>{t('projects.due_label')}</label>
              <DatePicker
                mode="date"
                value={due || null}
                onChange={(v) => setDue(v ?? '')}
                placeholder={t('projects.due_label')}
              />
              <div className="hint">{t('projects.due_hint')}</div>
            </div>
          </div>
          <div className="form-row">
            <label>{t('projects.project_name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projects.name_placeholder')}
            />
          </div>
          <div className="form-row">
            <label>{t('projects.client_label')}</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder={t('projects.client_placeholder')}
            />
          </div>
          <div className="form-row">
            <label>{t('projects.owner_label')}</label>
            <select
              value={ownerId ?? ''}
              onChange={(e) => setOwnerId(e.target.value || null)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--ink-200)',
                background: 'var(--cream-50)',
                fontSize: 13,
                color: 'var(--ink-900)',
              }}
            >
              <option value="">{t('projects.owner_placeholder')}</option>
              {users
                .filter((u) => u.status === 'active')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <div className="hint">{t('projects.owner_hint')}</div>
          </div>
          <div className="form-row">
            <label>{t('projects.color')}</label>
            <div className="color-picker">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: '12px 14px',
              border: `1px solid var(--ink-100)`,
              borderRadius: 8,
              background: 'var(--cream-100)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: color,
              }}
            />
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--ink-500)',
                fontWeight: 600,
                marginBottom: 4,
                paddingLeft: 8,
              }}
            >
              {code || t('projects.preview_code_default')}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, paddingLeft: 8 }}>
              {name || t('projects.preview_name_default')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', paddingLeft: 8, marginTop: 2 }}>
              {client || t('projects.preview_client_default')}
              {due &&
                ` ${t('projects.due_short', {
                  date: new Date(due).toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
                    day: '2-digit',
                    month: 'short',
                  }),
                })}`}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          {isEdit && (
            <button
              type="button"
              className="btn-ghost"
              onClick={onDelete}
              style={{ color: 'var(--err-500)' }}
            >
              <Icon name="trash-2" size={13} /> {t('projects.delete_label')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!canSave}>
            {isEdit ? t('projects.submit_save') : t('projects.submit_create')}
            <span style={{ opacity: 0.6, marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>⌘↵</span>
          </button>
        </div>
      </form>
    </div>
  );
}
