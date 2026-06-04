// Screen 7 · Profil
// Avatar/Name/Rolle Hero, Stats-Strip, Streak, Settings-Gruppen
// (Push, Pomodoro, Tagesziel, Theme), Konto-Sektion, Logout.

import { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../shared/Icon';
import { Avatar } from '../shared/Avatar';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
} from '../../lib/pushNotifications';
import { MobStatusBar, HomeBar } from './MobileChrome';

export function MobScreenProfile() {
  const t = useT();
  const tasks = useStore((s) => s.tasks);
  const currentUser = useStore((s) => s.currentUser);
  const users = useStore((s) => s.users);
  const teams = useStore((s) => s.teams);
  const { user: authUser, refresh } = useAuth();

  const meUser = users.find((u) => u.id === currentUser);
  const team = meUser ? teams.find((tm) => tm.id === meUser.teamId)?.name ?? '—' : '—';
  const role = meUser?.role === 'admin' ? t('admin.badge_admin') : t('mobile.profile_role_member');

  // Real Stats aus Store
  const myTasks = tasks.filter((tk) => tk.who === currentUser);
  const totalEst = myTasks.filter((tk) => tk.col !== 'done').reduce((a, b) => a + (b.estH || 0), 0);
  const totalLogged = myTasks.reduce((a, b) => a + (b.loggedH || 0), 0);
  const weekPct = totalEst > 0 ? Math.min(100, Math.round((totalLogged / totalEst) * 100)) : 0;

  const tasksDone = myTasks.filter((tk) => tk.col === 'done').length;
  const tasksTotal = myTasks.length;

  // Push-Toggle
  const pushSupported = isPushSupported();
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const perm = getPushPermission();

  useEffect(() => {
    if (!pushSupported) return;
    getCurrentSubscription().then((sub) => setPushActive(!!sub));
  }, [pushSupported]);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushActive) {
        await unsubscribeFromPush();
        setPushActive(false);
        showToast(t('settings.push_disabled'));
      } else {
        const result = await subscribeToPush();
        if (result === 'granted') { setPushActive(true); showToast(t('settings.push_enabled')); }
        else if (result === 'denied') showToast(t('settings.push_denied'));
        else showToast(t('common.error_generic'));
      }
    } finally {
      setPushBusy(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
      await refresh();
      window.location.reload();
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  return (
    <div className="mob-screen">
      <MobStatusBar />

      <div className="mob-prof-head">
        <div style={{ width: 18 }} />
        <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
          {t('mobile.profile_title')}
        </div>
        <Icon name="settings" size={16} style={{ color: 'var(--ink-700)' }} />
      </div>

      <div className="mob-prof-scroll">
        <div className="mob-prof-hero">
          {meUser && (
            <div className="mob-prof-avatar-wrap">
              <Avatar id={meUser.id} size={64} />
              <span className="mob-prof-status-dot" />
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em', marginTop: 10, whiteSpace: 'nowrap' }}>
            {meUser?.name ?? authUser?.email ?? '—'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2, whiteSpace: 'nowrap' }}>
            {role} · {team}
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-400)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95%' }}>
            {authUser?.email ?? meUser?.email ?? '—'}
          </div>
        </div>

        <div className="mob-prof-stats">
          <div className="mob-prof-stat">
            <div className="mob-prof-stat-val">{weekPct}<span style={{ fontSize: 11 }}>%</span></div>
            <div className="mob-prof-stat-lbl">{t('mobile.profile_stat_progress')}</div>
          </div>
          <div className="mob-prof-stat">
            <div className="mob-prof-stat-val">{tasksDone}<span style={{ fontSize: 11 }}>/{tasksTotal}</span></div>
            <div className="mob-prof-stat-lbl">{t('mobile.profile_stat_done')}</div>
          </div>
          <div className="mob-prof-stat">
            <div className="mob-prof-stat-val">{totalLogged.toFixed(1).replace('.', ',')}<span style={{ fontSize: 11 }}>h</span></div>
            <div className="mob-prof-stat-lbl">{t('mobile.profile_stat_logged')}</div>
          </div>
        </div>

        <div className="mob-prof-section-h">{t('mobile.profile_section_settings')}</div>
        <div className="mob-prof-group">
          {pushSupported && (
            <div className="mob-prof-row">
              <div className="mob-prof-row-icon a-blue"><Icon name="bell" size={13} /></div>
              <div className="mob-prof-row-main">
                <div className="mob-prof-row-title">{t('settings.push_title')}</div>
                <div className="mob-prof-row-sub">{t('settings.push_body')}</div>
              </div>
              {perm === 'denied' ? (
                <span className="mono" style={{ fontSize: 9, color: 'var(--err-500, #C0432C)' }}>
                  {t('settings.push_denied')}
                </span>
              ) : (
                <div
                  className={`mob-toggle ${pushActive ? 'is-on' : ''}`}
                  onClick={togglePush}
                  style={{ opacity: pushBusy ? 0.5 : 1 }}
                >
                  <span />
                </div>
              )}
            </div>
          )}
          {/* FtkF6nfsdTm: Rows oeffnen jetzt das SettingsModal mit dem
              entsprechenden Tab (vorher nur ChevronRight ohne Funktion). */}
          <div
            className="mob-prof-row"
            onClick={() => window.dispatchEvent(new CustomEvent('btm:open-settings', { detail: { tab: 'appearance' } }))}
          >
            <div className="mob-prof-row-icon a-red"><Icon name="timer" size={13} /></div>
            <div className="mob-prof-row-main">
              <div className="mob-prof-row-title">{t('mobile.profile_pomodoro')}</div>
              <div className="mob-prof-row-sub">{t('mobile.profile_pomodoro_sub')}</div>
            </div>
            <Icon name="chevron-right" size={13} style={{ color: 'var(--ink-400)' }} />
          </div>
          <div
            className="mob-prof-row"
            onClick={() => window.dispatchEvent(new CustomEvent('btm:open-settings', { detail: { tab: 'profile' } }))}
          >
            <div className="mob-prof-row-icon a-green"><Icon name="target" size={13} /></div>
            <div className="mob-prof-row-main">
              <div className="mob-prof-row-title">{t('mobile.profile_daily_goal')}</div>
              <div className="mob-prof-row-sub">{t('mobile.profile_daily_goal_sub', { hours: meUser?.cap ?? 40 })}</div>
            </div>
            <Icon name="chevron-right" size={13} style={{ color: 'var(--ink-400)' }} />
          </div>
        </div>

        <div className="mob-prof-section-h">{t('mobile.profile_section_account')}</div>
        <div className="mob-prof-group">
          <div
            className="mob-prof-row"
            onClick={() => window.dispatchEvent(new CustomEvent('btm:open-settings', { detail: { tab: 'calendar' } }))}
          >
            <div className="mob-prof-row-icon a-amber"><Icon name="link-2" size={13} /></div>
            <div className="mob-prof-row-main">
              <div className="mob-prof-row-title">{t('mobile.profile_calendar')}</div>
              <div className="mob-prof-row-sub">{t('mobile.profile_calendar_sub')}</div>
            </div>
            <Icon name="chevron-right" size={13} style={{ color: 'var(--ink-400)' }} />
          </div>
          <div
            className="mob-prof-row"
            onClick={() => window.dispatchEvent(new CustomEvent('btm:open-settings', { detail: { tab: 'data' } }))}
          >
            <div className="mob-prof-row-icon a-slate"><Icon name="shield-check" size={13} /></div>
            <div className="mob-prof-row-main">
              <div className="mob-prof-row-title">{t('mobile.profile_privacy')}</div>
              <div className="mob-prof-row-sub">{t('mobile.profile_privacy_sub')}</div>
            </div>
            <Icon name="chevron-right" size={13} style={{ color: 'var(--ink-400)' }} />
          </div>
        </div>

        <div className="mob-prof-logout" onClick={logout}>
          <Icon name="log-out" size={12} />
          <span>{t('mobile.profile_logout')}</span>
        </div>

        <div className="mob-prof-version">BTM · Beta</div>
      </div>

      <HomeBar />
    </div>
  );
}
