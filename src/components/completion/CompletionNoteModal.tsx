// FMcAHI4aMlL: Aufforderung zur Abschluss-Notiz beim Move einer Task auf
// 'done'. Wird global an einer Stelle gerendert und lauscht auf
// store.completionPrompt — egal aus welchem Pfad der Move kommt (Kanban-DnD,
// Detail-Drawer, TaskCard-Mover, Mobile-Sheet), das Modal poppt auf.

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useT } from '../../i18n';
import { Icon } from '../shared/Icon';

export function CompletionNoteModal() {
  const t = useT();
  const prompt = useStore((s) => s.completionPrompt);
  const tasks = useStore((s) => s.tasks);
  const resolve = useStore((s) => s.resolveCompletionPrompt);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Notiz beim Wechsel der Task / Schliessen leeren.
  useEffect(() => {
    if (!prompt) {
      setNote('');
      setBusy(false);
    } else {
      setTimeout(() => taRef.current?.focus(), 30);
    }
  }, [prompt?.taskId]);

  // Esc → abbrechen, Cmd/Ctrl+Enter → mit Notiz abschliessen.
  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void resolve('cancel');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (note.trim()) {
          setBusy(true);
          void resolve('with-note', note).finally(() => setBusy(false));
        } else {
          setBusy(true);
          void resolve('skip').finally(() => setBusy(false));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, note, resolve]);

  if (!prompt) return null;
  const task = tasks.find((x) => x.id === prompt.taskId);
  // FFZUYjxdE5I: Texte je nach Ziel-Status. Review = „zur Pruefung
  // einreichen" Wording, Done = „abschliessen" wie gehabt.
  const isReview = prompt.targetCol === 'review';

  const submitWith = () => {
    if (busy) return;
    setBusy(true);
    void resolve('with-note', note).finally(() => setBusy(false));
  };
  const submitSkip = () => {
    if (busy) return;
    setBusy(true);
    void resolve('skip').finally(() => setBusy(false));
  };
  const cancel = () => {
    if (busy) return;
    void resolve('cancel');
  };

  return (
    <div className="cnm-backdrop" onClick={cancel} role="presentation">
      <div className="cnm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cnm-title">
        <header className="cnm-head">
          <div className={`cnm-head-icon ${isReview ? 'is-review' : ''}`}>
            <Icon name={isReview ? 'eye' : 'check-circle'} size={16} />
          </div>
          <div className="cnm-head-text">
            <h2 id="cnm-title" className="cnm-title">
              {isReview ? t('completion.title_review') : t('completion.title')}
            </h2>
            <p className="cnm-sub">
              {task ? task.title : ''}
            </p>
          </div>
        </header>
        <p className="cnm-hint">{isReview ? t('completion.hint_review') : t('completion.hint')}</p>
        <textarea
          ref={taRef}
          className="cnm-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isReview ? t('completion.placeholder_review') : t('completion.placeholder')}
          rows={5}
          maxLength={4000}
          disabled={busy}
        />
        <div className="cnm-foot">
          <button type="button" className="cnm-btn cnm-btn-ghost" onClick={cancel} disabled={busy}>
            {t('completion.cancel')}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="cnm-btn cnm-btn-secondary" onClick={submitSkip} disabled={busy}>
            {t('completion.skip')}
          </button>
          <button type="button" className="cnm-btn cnm-btn-primary" onClick={submitWith} disabled={busy || !note.trim()}>
            <Icon name="check" size={12} /> {isReview ? t('completion.save_review') : t('completion.save')}
          </button>
        </div>
        <div className="cnm-shortcut">{t('completion.shortcut')}</div>
      </div>
    </div>
  );
}
