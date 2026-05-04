import { useEffect, useState } from 'react';
import type { Project } from '../../store/types';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';

const PALETTE = [
  '#C85A2C', // accent
  '#5573A0', // legal blue
  '#5E7F4E', // store green
  '#B88A2E', // build amber
  '#6B6359', // ops gray
  '#8a5a8a', // purple
  '#9a3838', // crimson
  '#3F6F75', // teal
];

export interface NewProjectModalProps {
  onClose: () => void;
  existing?: Project | null;
}

export function NewProjectModal({ onClose, existing }: NewProjectModalProps) {
  const addProject = useStore((s) => s.addProject);
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);

  const isEdit = !!existing;
  const [code, setCode] = useState(existing?.code || '');
  const [name, setName] = useState(existing?.name || '');
  const [client, setClient] = useState(existing?.client || 'Mein Driver');
  const [due, setDue] = useState(existing?.due || '');
  const [color, setColor] = useState(existing?.color || PALETTE[0]);

  const canSave = code.trim().length > 0 && name.trim().length > 0;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault?.();
    if (!canSave) return;
    if (isEdit && existing) {
      updateProject(existing.id, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        client: client.trim(),
        due: due || null,
        color,
      });
      showToast(`Projekt „${code.trim().toUpperCase()}" gespeichert`);
    } else {
      const p = addProject({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        client: client.trim(),
        due: due || null,
        color,
      });
      showToast(`Projekt „${p.code}" angelegt`);
    }
    onClose();
  };

  const onDelete = () => {
    if (!isEdit || !existing) return;
    if (
      !window.confirm(
        `Projekt „${existing.code}" wirklich löschen? Aufgaben bleiben erhalten, werden aber projektlos.`,
      )
    )
      return;
    deleteProject(existing.id);
    showToast(`Projekt „${existing.code}" gelöscht`);
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
          <h3>{isEdit ? 'Projekt bearbeiten' : 'Neues Projekt'}</h3>
          <button type="button" className="x" onClick={onClose} aria-label="Schließen">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-grid-2">
            <div className="form-row">
              <label>Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="z. B. FAHRERAPP · E5"
                autoFocus
              />
              <div className="hint">Kurz · erscheint als Tag auf Cards.</div>
            </div>
            <div className="form-row">
              <label>Fällig</label>
              <input type="date" value={due ?? ''} onChange={(e) => setDue(e.target.value)} />
              <div className="hint">Optional.</div>
            </div>
          </div>
          <div className="form-row">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. FahrerApp · Etappe 5: Telematik-Integration"
            />
          </div>
          <div className="form-row">
            <label>Kunde / Bereich</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Mein Driver, Bethesna intern, …"
            />
          </div>
          <div className="form-row">
            <label>Farbe</label>
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
              {code || 'CODE'}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, paddingLeft: 8 }}>{name || 'Projektname'}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-500)', paddingLeft: 8, marginTop: 2 }}>
              {client || 'Kunde'}
              {due &&
                ` · fällig ${new Date(due).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`}
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
              <Icon name="trash-2" size={13} /> Löschen
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary" disabled={!canSave}>
            {isEdit ? 'Speichern' : 'Projekt anlegen'}
            <span style={{ opacity: 0.6, marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>⌘↵</span>
          </button>
        </div>
      </form>
    </div>
  );
}
