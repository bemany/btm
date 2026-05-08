import { useEffect, useState } from 'react';
import type { ThemeMode } from '../../store/types';
import { Icon } from '../shared/Icon';
import { useT } from '../../i18n';
import { AppearanceTab } from './AppearanceTab';
import { LanguageTab } from './LanguageTab';
import { ApiTokensTab } from './ApiTokensTab';
import { DataTab } from './DataTab';

export type SettingsTabId = 'appearance' | 'language' | 'api_tokens' | 'data';

export interface SettingsModalProps {
  onClose: () => void;
  initialTab?: SettingsTabId;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  onReplayTour?: () => void;
}

export function SettingsModal({
  onClose,
  initialTab = 'appearance',
  theme,
  setTheme,
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
    { id: 'appearance', label: t('settings.tab_appearance'), icon: 'palette' },
    { id: 'language', label: t('settings.tab_language'), icon: 'globe' },
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
            {tab === 'appearance' && <AppearanceTab theme={theme} setTheme={setTheme} />}
            {tab === 'language' && <LanguageTab />}
            {tab === 'api_tokens' && <ApiTokensTab />}
            {tab === 'data' && <DataTab onReplayTour={onReplayTour} onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );
}
