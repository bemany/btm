import { Icon } from '../shared/Icon';
import type { ThemeMode } from '../../store/types';
import { composeTheme, decomposeTheme } from '../../store/types';
import { useT } from '../../i18n';

export interface AppearanceTabProps {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

export function AppearanceTab({ theme, setTheme }: AppearanceTabProps) {
  const t = useT();
  const { base, brightness } = decomposeTheme(theme);

  return (
    <div className="set-pane">
      <p className="set-intro">{t('settings.appearance_intro')}</p>

      <div className="set-section-label">{t('settings.appearance_theme')}</div>
      <div className="set-card-grid">
        <button
          type="button"
          className={`set-card ${base === 'glass' ? 'is-active' : ''}`}
          onClick={() => setTheme(composeTheme('glass', brightness))}
        >
          <span className="set-card-swatch glass" />
          <span className="set-card-text">
            <span className="set-card-title">{t('sidebar.profile_glass')}</span>
            <span className="set-card-sub">{t('sidebar.profile_glass_sub')}</span>
          </span>
          {base === 'glass' && <Icon name="check" size={14} className="set-card-check" />}
        </button>
        <button
          type="button"
          className={`set-card ${base === 'default' ? 'is-active' : ''}`}
          onClick={() => setTheme(composeTheme('default', brightness))}
        >
          <span className="set-card-swatch studio" />
          <span className="set-card-text">
            <span className="set-card-title">{t('sidebar.profile_studio')}</span>
            <span className="set-card-sub">{t('sidebar.profile_studio_sub')}</span>
          </span>
          {base === 'default' && <Icon name="check" size={14} className="set-card-check" />}
        </button>
      </div>

      <div className="set-section-label" style={{ marginTop: 22 }}>
        {t('settings.appearance_brightness')}
      </div>
      <div className="set-card-grid">
        <button
          type="button"
          className={`set-card ${brightness === 'light' ? 'is-active' : ''}`}
          onClick={() => setTheme(composeTheme(base, 'light'))}
        >
          <span className="set-card-icon">
            <Icon name="sun" size={20} />
          </span>
          <span className="set-card-text">
            <span className="set-card-title">{t('sidebar.profile_light')}</span>
            <span className="set-card-sub">{t('sidebar.profile_light_sub')}</span>
          </span>
          {brightness === 'light' && <Icon name="check" size={14} className="set-card-check" />}
        </button>
        <button
          type="button"
          className={`set-card ${brightness === 'dark' ? 'is-active' : ''}`}
          onClick={() => setTheme(composeTheme(base, 'dark'))}
        >
          <span className="set-card-icon">
            <Icon name="moon" size={20} />
          </span>
          <span className="set-card-text">
            <span className="set-card-title">{t('sidebar.profile_dark')}</span>
            <span className="set-card-sub">{t('sidebar.profile_dark_sub')}</span>
          </span>
          {brightness === 'dark' && <Icon name="check" size={14} className="set-card-check" />}
        </button>
      </div>
    </div>
  );
}
