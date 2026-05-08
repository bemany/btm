// Release-Modal — zeigt einmalig nach Login die ungesehenen Changes seit
// der letzten besuchten Version. Speichert „gesehen" in localStorage,
// damit es nicht erneut auftaucht.

import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  unseenReleases,
  getLastSeenRelease,
  setLastSeenRelease,
  latestReleaseVersion,
  tx,
  type ChangeKind,
} from '../../data/releases';
import { navigate } from '../../router';
import { Icon } from '../shared/Icon';
import { useT, useLocale } from '../../i18n';

export function ReleaseModal() {
  const { user, status } = useAuth();
  const t = useT();
  const [locale] = useLocale();
  const KIND_LABEL: Record<ChangeKind, string> = {
    feature: t('release.kind_feature'),
    fix: t('release.kind_fix'),
    change: t('release.kind_change'),
    breaking: t('release.kind_breaking'),
  };
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState<ReturnType<typeof unseenReleases>>([]);

  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    const last = getLastSeenRelease();
    const list = unseenReleases(last);
    // Beim allerersten Login (last == null) zeigen wir das Modal NICHT —
    // das wäre Doppel-Frust mit der Onboarding-Tour. Stattdessen still die
    // aktuelle Version als „gesehen" markieren.
    if (last == null) {
      const v = latestReleaseVersion();
      if (v) setLastSeenRelease(v);
      return;
    }
    if (list.length > 0) {
      setUnseen(list);
      setOpen(true);
    }
  }, [user, status]);

  const close = () => {
    const v = latestReleaseVersion();
    if (v) setLastSeenRelease(v);
    window.dispatchEvent(new Event('btm:release-seen'));
    setOpen(false);
  };

  if (!open || unseen.length === 0) return null;

  // Alle ungesehenen Releases zusammenfassen — neueste zuerst
  return (
    <div className="rm-backdrop" role="dialog" aria-modal="true" onClick={close}>
      <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rm-close" onClick={close} aria-label={t('common.close')}>
          <Icon name="x" size={14} />
        </button>
        <div className="rm-eyebrow">
          <Icon name="sparkles" size={12} />
          <span>{t('release.modal_eyebrow')}</span>
        </div>
        <h2 className="rm-title">
          {unseen.length === 1
            ? t('release.modal_title_one', { version: unseen[0].version })
            : t('release.modal_title_many', { count: unseen.length })}
        </h2>
        <p className="rm-sub">{tx(unseen[0].title, locale)}</p>

        <div className="rm-body">
          {unseen.map((rel) => (
            <div key={rel.version} className="rm-rel">
              {unseen.length > 1 && (
                <div className="rm-rel-head">
                  <span className="rm-version">v{rel.version}</span>
                  <span className="rm-date">{rel.date}</span>
                  <span className="rm-rel-title">{tx(rel.title, locale)}</span>
                </div>
              )}
              <ul className="rm-changes">
                {rel.changes.map((c, j) => (
                  <li key={j}>
                    <span className={`rel-kind-pill kind-${c.kind}`}>{KIND_LABEL[c.kind]}</span>
                    <span>{tx(c.text, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rm-actions">
          <button
            className="rm-btn"
            onClick={() => {
              close();
              navigate('/releases');
            }}
          >
            {t('release.modal_more')}
          </button>
          <button className="rm-btn primary" onClick={close}>
            {t('release.modal_understood')}
          </button>
        </div>
      </div>
    </div>
  );
}
