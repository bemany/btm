import { useEffect, useState } from 'react';
import type { ThemeMode } from '../../store/types';
import { Icon } from '../shared/Icon';
import { useT } from '../../i18n';
import { AppearanceTab } from './AppearanceTab';
import { LanguageTab } from './LanguageTab';
import { ApiTokensTab } from './ApiTokensTab';
import { DataTab } from './DataTab';
import { NotificationsTab } from './NotificationsTab';
import { BackgroundsTab } from './BackgroundsTab';
import { ProfileTab } from './ProfileTab';
import { CalendarTab } from './CalendarTab';
import type { BackgroundId } from '../backgrounds/catalog';

export type SettingsTabId =
  | 'profile'
  | 'appearance'
  | 'backgrounds'
  | 'language'
  | 'notifications'
  | 'calendar'
  | 'api_tokens'
  | 'data';

export interface SettingsModalProps {
  onClose: () => void;
  initialTab?: SettingsTabId;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  background: BackgroundId;
  setBackground: (id: BackgroundId) => void;
  accentColor: string | null;
  setAccentColor: (hex: string | null) => void;
  onReplayTour?: () => void;
}

export function SettingsModal({
  onClose,
  initialTab = 'appearance',
  theme,
  setTheme,
  background,
  setBackground,
  accentColor,
  setAccentColor,
  onReplayTour,
}: SettingsModalProps) {
  const t = useT();
  const [tab, setTab] = useState<SettingsTabId>(initialTab);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs: Array<{ id: SettingsTabId; label: string; icon: string }> = [
    { id: 'profile', label: t('settings.tab_profile'), icon: 'user' },
    { id: 'appearance', label: t('settings.tab_appearance'), icon: 'palette' },
    { id: 'backgrounds', label: t('settings.tab_backgrounds'), icon: 'sparkles' },
    { id: 'language', label: t('settings.tab_language'), icon: 'globe' },
    { id: 'notifications', label: t('settings.tab_notifications'), icon: 'bell' },
    { id: 'calendar', label: t('settings.tab_calendar'), icon: 'calendar' },
    { id: 'api_tokens', label: t('settings.tab_api_tokens'), icon: 'key-round' },
    { id: 'data', label: t('settings.tab_data'), icon: 'database' },
  ];

  return (
    <div
      className="set-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
    >
      <div className="set-shell">
        <div className="set-head">
          <h2 className="set-title">{t('settings.title')}</h2>
          <button className="set-close" onClick={onClose} aria-label={t('settings.close')}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="set-body">
          <nav className="set-nav" aria-label={t('settings.title')}>
            {tabs.map((tb) => (
              <button
                key={tb.id}
                type="button"
                className={`set-nav-item ${tab === tb.id ? 'is-active' : ''}`}
                onClick={() => setTab(tb.id)}
              >
                <Icon name={tb.icon} size={14} className="set-nav-icon" />
                <span>{tb.label}</span>
              </button>
            ))}
          </nav>
          <div className="set-content">
            {tab === 'profile' && <ProfileTab />}
            {tab === 'appearance' && (
              <AppearanceTab
                theme={theme}
                setTheme={setTheme}
                accentColor={accentColor}
                setAccentColor={setAccentColor}
              />
            )}
            {tab === 'backgrounds' && (
              <BackgroundsTab theme={theme} background={background} setBackground={setBackground} />
            )}
            {tab === 'language' && <LanguageTab />}
            {tab === 'notifications' && <NotificationsTab />}
            {tab === 'calendar' && <CalendarTab />}
            {tab === 'api_tokens' && <ApiTokensTab />}
            {tab === 'data' && <DataTab onReplayTour={onReplayTour} onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );
}
