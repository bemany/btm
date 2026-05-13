// AttachmentsSection: Datei-Anhänge an Tasks. Drag-and-Drop oder Klick zum
// Auswählen. Max 5 MB pro Datei. Listet hochgeladene Dateien mit Icon je
// Mime-Type, Größe, Download- und Lösch-Button (nur Uploader/Admin).
// Feature FmFsMB3v6rK.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import type { TaskAttachmentDTO } from '../../data/api';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';

const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  taskId: string;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function iconForMime(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'file-text';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'music';
  if (mime.includes('zip') || mime.includes('compressed')) return 'archive';
  if (mime.includes('word') || mime.includes('document')) return 'file-text';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'file-spreadsheet';
  return 'file';
}

export function AttachmentsSection({ taskId }: Props) {
  const t = useT();
  const { user } = useAuth();
  const users = useStore((s) => s.users);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const queryKey = ['btm', 'task', taskId, 'attachments'] as const;
  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.listTaskAttachments(taskId),
    staleTime: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  async function uploadFile(file: File) {
    if (file.size > MAX_BYTES) {
      showToast(t('attachments.too_large', { max: '5 MB' }));
      return;
    }
    if (file.size === 0) {
      showToast(t('attachments.empty'));
      return;
    }
    setUploading(true);
    try {
      await api.uploadTaskAttachment(taskId, file);
      refresh();
      showToast(t('attachments.uploaded', { name: file.name }));
    } catch (e) {
      const code = (e as Error).message;
      if (code === 'too_large') showToast(t('attachments.too_large', { max: '5 MB' }));
      else showToast(t('common.error_generic'));
    } finally {
      setUploading(false);
    }
  }

  async function handleFileInput(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (file) await uploadFile(file);
    // Input zurücksetzen damit der gleiche File-Name nochmal hochgeladen werden kann
    ev.target.value = '';
  }

  async function handleDrop(ev: React.DragEvent) {
    ev.preventDefault();
    setDragOver(false);
    const file = ev.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  }

  async function handleDelete(att: TaskAttachmentDTO) {
    if (!confirm(t('attachments.delete_confirm', { name: att.filename }))) return;
    try {
      await api.deleteTaskAttachment(taskId, att.id);
      refresh();
      showToast(t('attachments.deleted'));
    } catch {
      showToast(t('common.error_generic'));
    }
  }

  const canDelete = (att: TaskAttachmentDTO): boolean => {
    if (!user) return false;
    return user.role === 'admin' || att.uploaderId === user.id;
  };

  return (
    <div className="ta-section">
      <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>
        {t('attachments.heading', { count: attachments.length })}
      </div>

      {/* Liste */}
      {!isLoading && attachments.length > 0 && (
        <ul className="ta-list">
          {attachments.map((att) => {
            const uploader = users.find((u) => u.id === att.uploaderId);
            return (
              <li key={att.id} className="ta-item">
                <Icon name={iconForMime(att.mimeType)} size={16} className="ta-item-icon" />
                <a
                  href={api.taskAttachmentDownloadUrl(taskId, att.id)}
                  className="ta-item-name"
                  download={att.filename}
                  title={att.filename}
                >
                  {att.filename}
                </a>
                <span className="ta-item-meta">
                  {fmtBytes(att.sizeBytes)}
                  {uploader && <> · {uploader.name.split(' ')[0]}</>}
                </span>
                {canDelete(att) && (
                  <button
                    type="button"
                    className="ta-item-delete"
                    onClick={() => handleDelete(att)}
                    title={t('common.delete')}
                  >
                    <Icon name="x" size={11} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Dropzone / Upload-Button */}
      <label
        className={`ta-dropzone ${dragOver ? 'is-drag' : ''} ${uploading ? 'is-uploading' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input type="file" hidden onChange={handleFileInput} disabled={uploading} />
        <Icon name={uploading ? 'loader-2' : 'paperclip'} size={16} className={uploading ? 'ta-spin' : ''} />
        <span>
          {uploading
            ? t('attachments.uploading')
            : attachments.length > 0
            ? t('attachments.add_more')
            : t('attachments.drop_or_click')}
        </span>
        <span className="ta-dropzone-hint">{t('attachments.max_size', { max: '5 MB' })}</span>
      </label>
    </div>
  );
}
