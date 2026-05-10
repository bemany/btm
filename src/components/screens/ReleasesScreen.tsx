// Release-Notes-Seite — listet Versionen, Roadmap und bekannte Probleme.
//
// Datenquelle: src/data/releases.ts (manuell gepflegte Konstante).
// Beim Öffnen wird automatisch die letzte gesehene Version gespeichert,
// damit das ReleaseModal beim nächsten Login nicht mehr feuert.

import { useEffect } from 'react';
import {
  RELEASES,
  ROADMAP,
  KNOWN_ISSUES,
  setLastSeenRelease,
  latestReleaseVersion,
  tx,
  type ChangeKind,
  type KnownIssue,
} from '../../data/releases';
import { Icon } from '../shared/Icon';
import { useT, useLocale } from '../../i18n';
import { renderInlineMarkdown } from '../../lib/inlineMarkdown';

export function ReleasesScreen() {
  const t = useT();
  const [locale] = useLocale();
  const KIND_LABEL: Record<ChangeKind, string> = {
    feature: t('release.kind_feature'),
    fix: t('release.kind_fix'),
    change: t('release.kind_change'),
    breaking: t('release.kind_breaking'),
  };
  const STATUS_LABEL: Record<KnownIssue['status'], string> = {
    investigating: t('release.status_investigating'),
    'fix-pending': t('release.status_fix_pending'),
    external: t('release.status_external'),
  };
  // Beim Öffnen der Seite die aktuellste Version als „gesehen" markieren —
  // so verschwindet das NEU-Pill in der Sidebar und das Modal kommt nicht mehr.
  useEffect(() => {
    const v = latestReleaseVersion();
    if (v) setLastSeenRelease(v);
    // Notify the rest of the app (Sidebar) damit das Badge sofort verschwindet
    window.dispatchEvent(new Event('btm:release-seen'));
  }, []);

  return (
    <div className="page rel-page">
      <div className="rel-header">
        <h1>{t('release.page_title')}</h1>
        <p className="rel-sub">
          {t('release.page_sub', { version: latestReleaseVersion() ?? '?' })}
        </p>
      </div>

      {/* Hauptlayout: Releases links (80%), Status-Sidebar rechts (20%, sticky) */}
      <div className="rel-layout">
        <main className="rel-main">
          <section className="rel-section">
            <div className="rel-section-head">
              <Icon name="package" size={16} className="rel-section-icon" />
              <h2>{t('release.section_releases')}</h2>
            </div>
            <div className="rel-releases">
              {RELEASES.map((rel) => (
                <article key={rel.version} className="rel-release">
                  <header>
                    <span className="rel-version">v{rel.version}</span>
                    <span className="rel-date">{rel.date}</span>
                    <h3>{tx(rel.title, locale)}</h3>
                  </header>
                  <ul className="rel-changes">
                    {rel.changes.map((c, j) => (
                      <li key={j} className={`rel-change kind-${c.kind}`}>
                        <span className={`rel-kind-pill kind-${c.kind}`}>{KIND_LABEL[c.kind]}</span>
                        <span className="rel-change-text">{renderInlineMarkdown(tx(c.text, locale))}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="rel-aside">
          {KNOWN_ISSUES.length > 0 && (
            <section className="rel-section">
              <div className="rel-section-head">
                <Icon name="alert-triangle" size={14} className="rel-section-icon warn" />
                <h2>{t('release.section_issues')}</h2>
              </div>
              <div className="rel-aside-cards">
                {KNOWN_ISSUES.map((iss, i) => (
                  <article key={i} className={`rel-card issue status-${iss.status}`}>
                    <header>
                      <span className={`rel-status-pill status-${iss.status}`}>
                        {STATUS_LABEL[iss.status]}
                      </span>
                      <h3>{tx(iss.title, locale)}</h3>
                    </header>
                    <p>{renderInlineMarkdown(tx(iss.description, locale))}</p>
                    {iss.workaround && (
                      <p className="rel-workaround">
                        <strong>{t('release.workaround')}</strong>{' '}
                        {renderInlineMarkdown(tx(iss.workaround, locale))}
                      </p>
                    )}
                    <footer>{t('release.since', { date: iss.reportedAt })}</footer>
                  </article>
                ))}
              </div>
            </section>
          )}

          {ROADMAP.length > 0 && (
            <section className="rel-section">
              <div className="rel-section-head">
                <Icon name="hammer" size={14} className="rel-section-icon" />
                <h2>{t('release.section_roadmap')}</h2>
              </div>
              <div className="rel-aside-cards">
                {ROADMAP.map((item, i) => (
                  <article key={i} className="rel-card roadmap">
                    <h3>{tx(item.title, locale)}</h3>
                    {item.description && (
                      <p>{renderInlineMarkdown(tx(item.description, locale))}</p>
                    )}
                    {item.eta && (
                      <footer>
                        <Icon name="clock" size={11} /> {tx(item.eta, locale)}
                      </footer>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
