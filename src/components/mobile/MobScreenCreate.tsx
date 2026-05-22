// Screen 2 · Neue Aufgabe — Bottom-Sheet-Inhalt (wird in MobBottomSheet gewrappt).
// Pflicht: Titel. Optional: Beschreibung, Projekt, Faellig, Aufwand, Prio.
// Drei-Zonen-Layout: head (fix), scroll (flex), foot (fix mit Save-Buttons).

import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/store';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';
import type { Priority } from '../../store/types';
import { HoursMinutesInput } from '../shared/HoursMinutesInput';

type DueChip = 'today' | 'tomorrow' | 'week' | 'none';

function dueChipToIso(chip: DueChip): string | null {
  if (chip === 'none') return null;
  const d = new Date();
  if (chip === 'tomorrow') d.setDate(d.getDate() + 1);
  if (chip === 'week') d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  onClose: () => void;
  onCreated: (taskId: string, started: boolean) => void;
}

export function MobScreenCreate({ onClose, onCreated }: Props) {
  const t = useT();
  const projects = useStore((s) => s.projects);
  const addTask = useStore((s) => s.addTask);
  const startTimer = useStore((s) => s.startTimer);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [projId, setProjId] = useState<string | null>(null);
  const [due, setDue] = useState<DueChip>('today');
  const [estH, setEstH] = useState(1);
  const [prio, setPrio] = useState<Priority>('med');
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 400);
  }, []);

  const canSubmit = title.trim().length > 0 && !busy;

  const submit = async (startAfter: boolean) => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const created = await addTask({
        title: title.trim(),
        desc: desc.trim() || undefined,
        col: 'planned',
        prio,
        estH,
        due: dueChipToIso(due) as string | null,
        proj: projId ?? null,
      });
      if (created) {
        if (startAfter) {
          await startTimer(created.id, true);
        }
        showToast(startAfter ? t('mobile.create_started_toast') : t('mobile.create_saved_toast'));
        onCreated(created.id, startAfter);
      } else {
        showToast(t('common.error_generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  const visibleProjects = projects.slice(0, 4);
  const dueChips: Array<{ id: DueChip; label: string; icon: string }> = [
    { id: 'today', label: t('common.today'), icon: 'sun' },
    { id: 'tomorrow', label: t('common.tomorrow'), icon: 'sunrise' },
    { id: 'week', label: t('mobile.due_week'), icon: 'calendar-range' },
    { id: 'none', label: t('mobile.due_none'), icon: 'x' },
  ];

  return (
    <>
      <header className="mob-sheet-head mob-create-head">
        <span className="mob-create-cancel" onClick={onClose}>{t('common.cancel')}</span>
        <span className="mob-create-title">{t('mobile.create_title')}</span>
        <span
          className="mob-create-save"
          style={{ opacity: canSubmit ? 1 : 0.4 }}
          onClick={() => canSubmit && submit(false)}
        >
          {t('common.create')}
        </span>
      </header>

      <div className="mob-sheet-scroll mob-create-body">
        <div className={`mob-input-wrap ${title ? '' : 'is-focus'}`}>
          <div className="mob-input-label">
            <span>{t('mobile.create_field_title')}</span>
            <span className="mob-req">{t('mobile.create_required')}</span>
          </div>
          <input
            ref={titleRef}
            className="mob-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('mobile.create_title_placeholder')}
            maxLength={200}
            style={{ background: 'transparent', border: 0, outline: 'none', width: '100%', fontSize: 16, color: 'inherit' }}
          />
        </div>

        <div className="mob-input-wrap">
          <div className="mob-input-label">
            <span>{t('mobile.create_field_desc')}</span>
            <span className="mob-opt">{t('mobile.create_optional')}</span>
          </div>
          <textarea
            className="mob-input mob-input-multi"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('mobile.create_desc_placeholder')}
            rows={3}
            style={{ background: 'transparent', border: 0, outline: 'none', width: '100%', fontSize: 16, color: 'inherit', fontFamily: 'inherit', resize: 'none' }}
          />
        </div>

        {visibleProjects.length > 0 && (
          <div className="mob-field">
            <div className="mob-input-label">
              <span>{t('mobile.create_field_project')}</span>
              <span className="mob-opt">{t('mobile.create_optional')}</span>
            </div>
            <div className="mob-chip-row">
              {visibleProjects.map((p) => (
                <div
                  key={p.id}
                  className={`mob-chip ${projId === p.id ? 'is-on' : ''}`}
                  onClick={() => setProjId(projId === p.id ? null : p.id)}
                >
                  <span className="mob-chip-dot" style={{ background: p.color }} />
                  <span>{p.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mob-field">
          <div className="mob-input-label">
            <span>{t('mobile.create_field_due')}</span>
            <span className="mob-opt">{t('mobile.create_optional')}</span>
          </div>
          <div className="mob-chip-row">
            {dueChips.map((c) => (
              <div
                key={c.id}
                className={`mob-chip ${due === c.id ? 'is-on' : ''}`}
                onClick={() => setDue(c.id)}
              >
                <Icon name={c.icon} size={12} />
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mob-field-row">
          <div className="mob-mini-field">
            <div className="mob-mini-lbl">{t('mobile.create_field_estimate')}</div>
            <HoursMinutesInput value={estH} onChange={setEstH} max={24} />
          </div>
          <div className="mob-mini-field">
            <div className="mob-mini-lbl">{t('mobile.create_field_priority')}</div>
            <div className="mob-prio-row">
              <span
                className={`mob-prio low ${prio === 'low' ? 'is-on' : ''}`}
                onClick={() => setPrio('low')}
              />
              <span
                className={`mob-prio med ${prio === 'med' ? 'is-on' : ''}`}
                onClick={() => setPrio('med')}
              />
              <span
                className={`mob-prio high ${prio === 'high' ? 'is-on' : ''}`}
                onClick={() => setPrio('high')}
              />
            </div>
          </div>
        </div>
      </div>

      <footer className="mob-sheet-foot">
        <button
          type="button"
          className="mob-sheet-secondary"
          disabled={!canSubmit}
          onClick={() => submit(false)}
        >
          <Icon name="check" size={13} /> {t('mobile.create_save_only')}
        </button>
        <button
          type="button"
          className="mob-sheet-primary"
          disabled={!canSubmit}
          onClick={() => submit(true)}
        >
          <Icon name="play" size={13} /> {t('mobile.create_save_start')}
        </button>
      </footer>
    </>
  );
}
