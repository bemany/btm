// Feedback-Modal — User können Bugs melden und Features wünschen.
//
// Felder:
//   • type (bug | feature) — Toggle oben
//   • title (Pflicht, kurze Zusammenfassung)
//   • body  (Pflicht, ausführliche Beschreibung)
//
// Beim Submit werden zusätzlich der aktuelle Pfad, das aktive Theme und
// der User-Agent als Context-Snapshot mitgeschickt — Admin sieht im
// Detail wo der User war als das Problem auftrat.

import { useEffect, useState } from 'react';
import * as api from '../../data/api';
import type { FeedbackType } from '../../data/api';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';

export interface FeedbackModalProps {
  initialType?: FeedbackType;
  onClose: () => void;
}

// Image-Größenlimit (8 MB Data-URI). Etwas mehr als das übliche „Bild von
// Chrome-Screenshot" (1-3 MB) — die Größe geht 1:1 in die DB.
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export function FeedbackModal({ initialType = 'bug', onClose }: FeedbackModalProps) {
  const t = useT();
  const [type, setType] = useState<FeedbackType>(initialType);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Versehentlicher Backdrop-/Escape-Close mit unsubmittedem Inhalt → confirm
  // (FHwNHtIY5Xe). Sonst tippt man 200 Wörter und ein Misklick frisst alles.
  const hasUnsavedContent = () => title.trim().length > 0 || body.trim().length > 0 || !!screenshot;
  const requestClose = () => {
    if (hasUnsavedContent() && !window.confirm(t('feedback.discard_confirm'))) return;
    onClose();
  };

  // Escape schließt (mit Discard-Guard)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, screenshot]);

  // Clipboard-Paste-Listener (Cmd/Ctrl+V): wenn ein Bild im Clipboard ist,
  // hängen wir es an. Auf Image-Items reagieren, Text-Pastes ins Textfeld
  // wie gewohnt durchlassen.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            void ingestFile(f);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ingestFile = async (f: File) => {
    if (!f.type.startsWith('image/')) {
      showToast(t('feedback.screenshot_not_image'));
      return;
    }
    if (f.size > MAX_SCREENSHOT_BYTES) {
      showToast(t('feedback.screenshot_too_large'));
      return;
    }
    try {
      const uri = await fileToDataUri(f);
      setScreenshot(uri);
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void ingestFile(f);
  };

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await api.createFeedback({
        type,
        title: title.trim(),
        body: body.trim(),
        contextPath: window.location.pathname + window.location.search,
        contextTheme: document.body.dataset.theme ?? null,
        contextUserAgent: navigator.userAgent.slice(0, 500),
        screenshotBase64: screenshot ?? null,
      });
      showToast(t('feedback.sent_toast'));
      onClose();
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="feedback-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="feedback-shell">
        <div className="feedback-head">
          <div>
            <div className="feedback-eyebrow">{t('feedback.eyebrow')}</div>
            <h2 className="feedback-title">{t('feedback.modal_title')}</h2>
          </div>
          <button className="feedback-close" onClick={requestClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="feedback-type-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            className={`feedback-type-btn ${type === 'bug' ? 'is-active' : ''}`}
            onClick={() => setType('bug')}
          >
            <Icon name="bug" size={14} />
            <span>{t('feedback.type_bug')}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={`feedback-type-btn ${type === 'feature' ? 'is-active' : ''}`}
            onClick={() => setType('feature')}
          >
            <Icon name="sparkles" size={14} />
            <span>{t('feedback.type_feature')}</span>
          </button>
        </div>

        <div className="feedback-form">
          <label className="feedback-field">
            <span className="feedback-label">{t('feedback.title_label')}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === 'bug'
                  ? t('feedback.title_placeholder_bug')
                  : t('feedback.title_placeholder_feature')
              }
              autoFocus
              maxLength={200}
            />
          </label>
          <label className="feedback-field">
            <span className="feedback-label">{t('feedback.body_label')}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                type === 'bug'
                  ? t('feedback.body_placeholder_bug')
                  : t('feedback.body_placeholder_feature')
              }
              rows={7}
              maxLength={20_000}
            />
          </label>
          <div
            className={`feedback-screenshot-zone ${dragOver ? 'is-drag' : ''} ${screenshot ? 'has-image' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {screenshot ? (
              <>
                <img src={screenshot} alt="" className="feedback-screenshot-preview" />
                <button
                  type="button"
                  className="feedback-screenshot-remove"
                  onClick={() => setScreenshot(null)}
                  aria-label={t('feedback.screenshot_remove')}
                  title={t('feedback.screenshot_remove')}
                >
                  <Icon name="x" size={12} />
                </button>
              </>
            ) : (
              <label className="feedback-screenshot-empty">
                <Icon name="image-plus" size={18} />
                <span className="feedback-screenshot-empty-title">{t('feedback.screenshot_drop_hint')}</span>
                <span className="feedback-screenshot-empty-sub">{t('feedback.screenshot_paste_hint')}</span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void ingestFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>

          <div className="feedback-context-hint">
            <Icon name="info" size={11} />
            <span>{t('feedback.context_hint')}</span>
          </div>
        </div>

        <div className="feedback-foot">
          <button className="feedback-btn" onClick={requestClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="feedback-btn is-primary" onClick={submit} disabled={!canSubmit}>
            <Icon name="send" size={12} /> {busy ? t('common.sending') : t('feedback.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
