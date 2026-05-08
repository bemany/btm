import { Icon } from '../shared/Icon';
import { useLocale, useT } from '../../i18n';

export function LanguageTab() {
  const t = useT();
  const [locale, setLocale] = useLocale();
  return (
    <div className="set-pane">
      <p className="set-intro">{t('settings.language_intro')}</p>
      <div className="set-card-grid">
        <button
          type="button"
          className={`set-card ${locale === 'de' ? 'is-active' : ''}`}
          onClick={() => setLocale('de')}
        >
          <span className="set-card-icon mono">DE</span>
          <span className="set-card-text">
            <span className="set-card-title">{t('sidebar.profile_language_de')}</span>
            <span className="set-card-sub">Deutsch · de-DE</span>
          </span>
          {locale === 'de' && <Icon name="check" size={14} className="set-card-check" />}
        </button>
        <button
          type="button"
          className={`set-card ${locale === 'en' ? 'is-active' : ''}`}
          onClick={() => setLocale('en')}
        >
          <span className="set-card-icon mono">EN</span>
          <span className="set-card-text">
            <span className="set-card-title">{t('sidebar.profile_language_en')}</span>
            <span className="set-card-sub">English · en-US</span>
          </span>
          {locale === 'en' && <Icon name="check" size={14} className="set-card-check" />}
        </button>
      </div>
    </div>
  );
}
