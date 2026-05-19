// Screen 5 · Quick-Capture (Foto/Text → KI)
// Drei Phasen:
//   1. Eingabe: Foto (Camera-Stream) ODER Text-Briefing
//   2. KI analysiert (Loader)
//   3. Vorschau: erkannte Aufgaben mit Häkchen, "X anlegen"-Footer

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { ProjTag } from '../shared/ProjTag';
import { showToast } from '../shared/Toast';
import { apiFetch } from '../../lib/api';
import { SYNC_KEYS } from '../../data/sync';
import { useT, useLocale } from '../../i18n';
import { MobStatusBar, HomeBar } from './MobileChrome';
import type { Priority } from '../../store/types';

interface ExtractedTask {
  title: string;
  proj: string | null;
  who: string | null;
  estH: number;
  prio: Priority;
  notes: string;
}

type Phase = 'input' | 'thinking' | 'result';

export function MobScreenCapture() {
  const t = useT();
  const [locale] = useLocale();
  const { user } = useAuth();
  const qc = useQueryClient();
  const projects = useStore((s) => s.projects);

  const fmtNum = (h: number) => h.toFixed(1).replace('.', locale === 'en' ? '.' : ',');

  const [phase, setPhase] = useState<Phase>('input');
  const [text, setText] = useState('');
  const [extracted, setExtracted] = useState<ExtractedTask[]>([]);
  const [picks, setPicks] = useState<boolean[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'input') {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [phase]);

  const extractFromText = async () => {
    if (!text.trim()) return;
    setPhase('thinking');
    try {
      const res = await apiFetch<{
        result: {
          tasks: Array<{
            title: string;
            description?: string;
            project_id?: string | null;
            assignee_id?: string | null;
            est_h?: number;
            prio?: Priority;
            notes?: string;
          }>;
        };
      }>('/ai/extract', { method: 'POST', body: { text } });
      const tasks: ExtractedTask[] = (res.result?.tasks ?? []).map((tk) => ({
        title: tk.title,
        proj: tk.project_id ?? null,
        who: tk.assignee_id ?? user?.id ?? null,
        estH: typeof tk.est_h === 'number' ? tk.est_h : 1,
        prio: (tk.prio ?? 'med') as Priority,
        notes: tk.notes ?? tk.description ?? '',
      }));
      setExtracted(tasks);
      setPicks(tasks.map(() => true));
      setPhase('result');
      if (tasks.length === 0) showToast(t('mobile.ki_no_tasks_toast'));
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('common.error_generic'));
      setPhase('input');
    }
  };

  const apply = async () => {
    const selected = extracted.filter((_, i) => picks[i]);
    if (selected.length === 0) return;
    let ok = 0;
    for (const tk of selected) {
      try {
        await apiFetch('/tasks', {
          method: 'POST',
          body: {
            title: tk.title,
            description: tk.notes || null,
            estH: tk.estH,
            priority: tk.prio,
            projectId: tk.proj || null,
            assigneeId: tk.who || user?.id,
            column: 'todo',
          },
        });
        ok++;
      } catch {
        /* ignore single failures */
      }
    }
    showToast(t('mobile.ki_created_toast', { count: ok }));
    qc.invalidateQueries({ queryKey: SYNC_KEYS.TASKS });
    setText('');
    setExtracted([]);
    setPicks([]);
    setPhase('input');
  };

  if (phase === 'thinking') {
    return (
      <div className="mob-screen">
        <MobStatusBar />
        <div className="mob-capture-head">
          <Icon name="x" size={18} style={{ color: 'var(--ink-700)' }} />
          <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
            {t('mobile.ki_eyebrow')}
          </div>
        </div>
        <div className="mob-photo">
          <div className="mob-photo-stripes" />
          <div className="mob-photo-overlay">
            <div className="mono" style={{ fontSize: 9, color: 'rgba(250,247,242,0.85)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('mobile.capture_analyzing')}
            </div>
            <Icon name="loader-2" size={24} className="ma-spin" style={{ color: 'rgba(250,247,242,0.65)', marginTop: 6 }} />
          </div>
        </div>
        <div className="mob-capture-body">
          <div style={{ fontSize: 12, color: 'var(--ink-500)', padding: 12, textAlign: 'center' }}>
            {t('mobile.ki_thinking_sub')}
          </div>
        </div>
        <HomeBar />
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="mob-screen">
        <MobStatusBar />
        <div className="mob-capture-head">
          <button
            type="button"
            onClick={() => setPhase('input')}
            style={{ border: 0, background: 'transparent', color: 'var(--ink-700)', cursor: 'pointer', padding: 4 }}
          >
            <Icon name="arrow-left" size={18} />
          </button>
          <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
            {t('mobile.ki_eyebrow_result')}
          </div>
        </div>

        <div className="mob-capture-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="sparkles" size={11} style={{ color: 'var(--accent-500)' }} />
            <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-700)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              {t('mobile.capture_detected', { count: extracted.length })}
            </span>
            <div style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>Claude</span>
          </div>

          {extracted.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-500)', fontSize: 12 }}>
              {t('mobile.ki_no_tasks_toast')}
            </div>
          )}

          {extracted.map((row, i) => {
            const proj = row.proj ? projects.find((p) => p.id === row.proj) : null;
            return (
              <div
                key={i}
                className={`mob-cap-row ${picks[i] ? 'on' : ''}`}
                onClick={() => {
                  const next = [...picks];
                  next[i] = !picks[i];
                  setPicks(next);
                }}
              >
                <span className={`mob-check ${picks[i] ? 'on' : ''}`}>
                  {picks[i] && <Icon name="check" size={9} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {proj && <ProjTag id={proj.id} />}
                    <span className="mono" style={{ fontSize: 9, color: 'var(--ink-500)' }}>{fmtNum(row.estH)}h</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-800)', marginTop: 3, lineHeight: 1.3 }}>
                    {row.title}
                  </div>
                </div>
                <Icon name="pencil" size={11} style={{ color: 'var(--ink-400)' }} />
              </div>
            );
          })}
        </div>

        <div className="mob-capture-foot">
          <button type="button" className="mob-cap-secondary" onClick={() => setPhase('input')}>
            <Icon name="arrow-left" size={11} /> {t('mobile.ki_back')}
          </button>
          <button
            type="button"
            className="mob-cap-primary"
            onClick={apply}
            disabled={picks.every((p) => !p)}
          >
            {t('mobile.ki_apply', { count: picks.filter(Boolean).length })}
          </button>
        </div>

        <HomeBar />
      </div>
    );
  }

  return (
    <div className="mob-screen">
      <MobStatusBar />
      <div className="mob-capture-head">
        <Icon name="x" size={18} style={{ color: 'var(--ink-700)' }} />
        <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
          {t('mobile.ki_eyebrow')}
        </div>
      </div>

      <div style={{ padding: '14px 16px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {t('mobile.ki_sub')}
        </div>

        <textarea
          ref={inputRef}
          className="ma-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('mobile.ki_textarea')}
          style={{ flex: 1, minHeight: 140, fontSize: 13 }}
        />

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={() => {
            // Foto-Aufnahme: Wenn Backend Vision unterstützt, hier hochladen.
            // Aktuell nur Text-Extraction → User-Hint.
            showToast(t('mobile.capture_photo_soon'));
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
      </div>

      <div className="mob-capture-foot">
        <button
          type="button"
          className="mob-cap-secondary"
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="camera" size={11} /> {t('mobile.ki_photo')}
        </button>
        <button
          type="button"
          className="mob-cap-primary"
          onClick={extractFromText}
          disabled={!text.trim()}
        >
          <Icon name="sparkles" size={11} /> {t('mobile.ki_extract')}
        </button>
      </div>

      <HomeBar />
    </div>
  );
}
