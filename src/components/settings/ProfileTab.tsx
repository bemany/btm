// Settings → Profil.
//
// Editierbar:
//  • Name
//  • Position (Job-Title) — z.B. „Backend-Engineer"
//  • Avatar (Profilbild) — URL oder direkt eine Datei droppen/auswählen
//
// Profilbild-Upload: Datei wird via FileReader zu Data-URL konvertiert
// und auf 256×256 in einem Canvas runterskaliert, damit die DB-Spalte
// nicht mit Mehrere-MB-Base64 vollläuft. Limit: 400 kB Output.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import * as api from '../../data/api';
import { Avatar } from '../shared/Avatar';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';

const MAX_AVATAR_BYTES = 400_000;
const AVATAR_SIZE = 256;

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  // Auf AVATAR_SIZE skalieren via canvas
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  // Cover-Crop: kürzere Seite füllt
  const ratio = Math.min(img.width, img.height) / AVATAR_SIZE;
  const sx = (img.width - AVATAR_SIZE * ratio) / 2;
  const sy = (img.height - AVATAR_SIZE * ratio) / 2;
  ctx.drawImage(img, sx, sy, AVATAR_SIZE * ratio, AVATAR_SIZE * ratio, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  const out = canvas.toDataURL('image/jpeg', 0.85);
  if (out.length > MAX_AVATAR_BYTES) {
    // Erneut komprimieren mit niedrigerer Qualität
    return canvas.toDataURL('image/jpeg', 0.65);
  }
  return out;
}

export function ProfileTab() {
  const t = useT();
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [image, setImage] = useState<string | null>(user?.image ?? null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setJobTitle(user?.jobTitle ?? '');
    setImage(user?.image ?? null);
  }, [user?.name, user?.jobTitle, user?.image]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(t('profile.invalid_file'));
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImage(dataUrl);
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast(t('profile.name_required'));
      return;
    }
    setBusy(true);
    try {
      await api.updateMyProfile({
        name: trimmedName,
        jobTitle: jobTitle.trim() || null,
        image,
      });
      await refresh();
      showToast(t('profile.saved_toast'));
    } catch {
      showToast(t('common.error_generic'));
    } finally {
      setBusy(false);
    }
  };

  const dirty =
    (name.trim() !== (user?.name ?? '')) ||
    ((jobTitle.trim() || null) !== (user?.jobTitle ?? null)) ||
    (image !== (user?.image ?? null));

  return (
    <div className="set-pane">
      <p className="set-intro">{t('profile.intro')}</p>

      <div className="profile-avatar-row">
        <div className="profile-avatar-preview">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={image} alt="" className="profile-avatar-img" />
          ) : user ? (
            <Avatar id={user.id} size={88} />
          ) : null}
        </div>
        <div className="profile-avatar-actions">
          <button
            type="button"
            className="tb-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Icon name="upload" size={12} /> {t('profile.upload_image')}
          </button>
          {image && (
            <button
              type="button"
              className="tb-btn"
              onClick={() => setImage(null)}
              disabled={busy}
            >
              <Icon name="x" size={12} /> {t('profile.remove_image')}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void handleFile(f);
              if (e.target) e.target.value = '';
            }}
          />
          <div className="profile-avatar-hint">{t('profile.image_hint')}</div>
        </div>
      </div>

      <label className="profile-field">
        <span className="profile-field-label">{t('profile.name')}</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className="profile-field-input"
        />
      </label>

      <label className="profile-field">
        <span className="profile-field-label">{t('profile.job_title')}</span>
        <input
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder={t('profile.job_title_placeholder')}
          maxLength={120}
          className="profile-field-input"
        />
        <span className="profile-field-hint">{t('profile.job_title_hint')}</span>
      </label>

      <div className="profile-foot">
        <button
          type="button"
          className="tb-btn accent"
          onClick={save}
          disabled={!dirty || busy}
        >
          <Icon name="check" size={12} /> {busy ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
