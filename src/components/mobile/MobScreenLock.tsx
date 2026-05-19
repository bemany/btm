// Screen 8 · Lockscreen-Preview
// Reines Mockup wie eine Push-Notification aussieht — wird auf der
// Profil-Seite oder als Test-Push-Vorschau angezeigt.

import { useStore } from '../../store/store';
import { useT } from '../../i18n';

interface Props {
  onDismiss: () => void;
}

export function MobScreenLock({ onDismiss }: Props) {
  const t = useT();
  const tasks = useStore((s) => s.tasks);
  const timer = useStore((s) => s.timer);
  const liveTask = timer ? tasks.find((tk) => tk.id === timer.taskId) : null;

  const now = new Date();
  const dateLine = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeLine = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="mob-screen-lock"
      onClick={onDismiss}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #2a221a 0%, #0d0907 60%, #1a1410 100%)',
        color: 'var(--cream-50)',
      }}
    >
      <div className="mob-lock-time">
        <div className="mono" style={{ fontSize: 11, color: 'rgba(250,247,242,0.7)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {dateLine}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 200, color: '#FAF7F2', letterSpacing: '-0.04em', lineHeight: 1, marginTop: 4 }}>
          {timeLine}
        </div>
      </div>

      <div className="mob-lock-stack">
        <div className="mob-noti primary">
          <div className="mob-noti-head">
            <div className="mob-noti-app">
              <svg viewBox="0 0 32 32" width="14" height="14">
                <rect x="6" y="9" width="20" height="3" rx="1" fill="#FAF7F2" />
                <rect x="6" y="14" width="14" height="3" rx="1" fill="#FAF7F2" />
                <rect x="6" y="19" width="17" height="3" rx="1" fill="#FAF7F2" />
                <circle cx="24" cy="15.5" r="2" fill="#C85A2C" />
              </svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#FAF7F2' }}>BTM</span>
            <span className="mono" style={{ fontSize: 9, color: 'rgba(250,247,242,0.55)', marginLeft: 'auto' }}>
              {t('mobile.lock_now')}
            </span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#FAF7F2', marginTop: 6 }}>
            🍅 {t('mobile.lock_pomo_done')}
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(250,247,242,0.78)', marginTop: 3, lineHeight: 1.35 }}>
            {t('mobile.lock_pomo_body', { title: liveTask?.title ?? t('mobile.lock_pomo_demo_title') })}
          </div>
        </div>

        <div className="mob-noti">
          <div className="mob-noti-head">
            <div className="mob-noti-app">
              <svg viewBox="0 0 32 32" width="14" height="14">
                <rect x="6" y="9" width="20" height="3" rx="1" fill="#FAF7F2" />
                <rect x="6" y="14" width="14" height="3" rx="1" fill="#FAF7F2" />
                <rect x="6" y="19" width="17" height="3" rx="1" fill="#FAF7F2" />
                <circle cx="24" cy="15.5" r="2" fill="#C85A2C" />
              </svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#FAF7F2' }}>BTM</span>
            <span className="mono" style={{ fontSize: 9, color: 'rgba(250,247,242,0.55)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {t('mobile.lock_ago_8')}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#FAF7F2', marginTop: 4 }}>
            {t('mobile.lock_digest_title')}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(250,247,242,0.7)', marginTop: 2 }}>
            {t('mobile.lock_digest_body')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
        <span className="mono" style={{ fontSize: 10, color: 'rgba(250,247,242,0.5)' }}>
          {t('mobile.lock_tap_to_close')}
        </span>
      </div>

    </div>
  );
}
