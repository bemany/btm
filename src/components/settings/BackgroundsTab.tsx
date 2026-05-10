// Settings → Hintergrund.
//
// Aufbau:
//   • Hero-Preview oben — zeigt einen Mock-Ausschnitt aus der App
//     (Sidebar-Strip + Topbar-Strip + Card) auf dem aktuell hovered
//     bzw. ausgewählten Background. Live mit voller Animation.
//   • Tile-Grid drunter — kleinere Vorschauen aller verfügbaren Effekte.
//     Hover über Tile → Hero-Preview switched temporär. Klick → speichert
//     auf Server, bleibt persistent.
//
// Aktiv nur in Glass-Themes — bei Solid-Themes Hinweis statt Picker.

import { Suspense, useState } from 'react';
import type { ThemeMode } from '../../store/types';
import { BACKGROUNDS, type BackgroundId, getBackground } from '../backgrounds/catalog';
import { Icon } from '../shared/Icon';
import { useT } from '../../i18n';

export interface BackgroundsTabProps {
  theme: ThemeMode;
  background: BackgroundId;
  setBackground: (id: BackgroundId) => void;
}

function isGlassTheme(theme: ThemeMode): boolean {
  return theme === 'glass' || theme === 'glass-dark';
}

export function BackgroundsTab({ theme, background, setBackground }: BackgroundsTabProps) {
  const t = useT();
  const glass = isGlassTheme(theme);
  // hovered überschreibt die Hero-Vorschau temporär — beim Verlassen
  // fällt sie auf den persistierten background zurück.
  const [hovered, setHovered] = useState<BackgroundId | null>(null);
  const previewId: BackgroundId = hovered ?? background;
  const previewEntry = getBackground(previewId);
  const PreviewComponent = previewEntry.Component;

  return (
    <div className="set-pane">
      <p className="set-intro">{t('settings.backgrounds_intro')}</p>

      {!glass && (
        <div className="bg-picker-disabled">
          <strong>{t('settings.backgrounds_disabled_title')}</strong>
          <br />
          {t('settings.backgrounds_disabled_body')}
        </div>
      )}

      {/* ── Hero-Preview ───────────────────────────────────────────── */}
      <div className="bg-hero" data-preview-theme={glass ? theme : 'glass'}>
        <div className="bg-hero-bg">
          {PreviewComponent && (
            <Suspense fallback={null}>
              <PreviewComponent preview />
            </Suspense>
          )}
        </div>
        <div className="bg-hero-mock">
          {/* Mini-Sidebar */}
          <div className="bg-hero-side">
            <div className="bg-hero-side-brand">
              <span className="bg-hero-side-dot" />
              <span className="bg-hero-side-title">BTM</span>
            </div>
            <div className="bg-hero-side-item is-active">Meine Woche</div>
            <div className="bg-hero-side-item">Wochenboard</div>
            <div className="bg-hero-side-item">Kapazität</div>
            <div className="bg-hero-side-item">Zeiten</div>
          </div>
          {/* Mini-Main */}
          <div className="bg-hero-main">
            <div className="bg-hero-topbar">
              <div className="bg-hero-crumb">Wochenboard</div>
              <div className="bg-hero-meta">KW 19 · 16 Aufgaben</div>
              <div className="bg-hero-spacer" />
              <div className="bg-hero-pill">⌘ Planungs-KI</div>
            </div>
            <div className="bg-hero-cards">
              <div className="bg-hero-card">
                <div className="bg-hero-card-tag">FA-SEO</div>
                <div className="bg-hero-card-title">iOS-Listing fixen</div>
                <div className="bg-hero-card-foot">
                  <span className="bg-hero-card-time">0,5h</span>
                  <span className="bg-hero-card-avatar" />
                </div>
              </div>
              <div className="bg-hero-card">
                <div className="bg-hero-card-tag">BTM</div>
                <div className="bg-hero-card-title">Comments + Mentions</div>
                <div className="bg-hero-card-foot">
                  <span className="bg-hero-card-time">2,0h</span>
                  <span className="bg-hero-card-avatar" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-hero-label">
          <span className="bg-hero-label-name">{t(previewEntry.nameKey as 'backgrounds.aurora_name')}</span>
          <span className="bg-hero-label-desc">{t(previewEntry.descKey as 'backgrounds.aurora_desc')}</span>
        </div>
      </div>

      {/* ── Tile-Grid ──────────────────────────────────────────────── */}
      <div className="bg-picker-grid">
        {BACKGROUNDS.map((entry) => {
          const isActive = background === entry.id;
          const Component = entry.Component;
          return (
            <button
              key={entry.id}
              type="button"
              className={`bg-picker-tile ${isActive ? 'is-active' : ''}`}
              onClick={() => setBackground(entry.id)}
              onMouseEnter={() => setHovered(entry.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(entry.id)}
              onBlur={() => setHovered(null)}
              disabled={!glass}
              title={t(entry.descKey as 'backgrounds.aurora_desc')}
            >
              <div className="bg-picker-preview">
                {Component ? (
                  <Suspense fallback={null}>
                    <Component preview />
                  </Suspense>
                ) : (
                  <div className="bg-picker-preview-empty">{t('backgrounds.none_preview_label')}</div>
                )}
                {entry.isNew && <span className="bg-picker-tile-new">{t('common.new')}</span>}
                {isActive && (
                  <span className="bg-picker-check">
                    <Icon name="check" size={12} />
                  </span>
                )}
              </div>
              <div className="bg-picker-label">{t(entry.nameKey as 'backgrounds.aurora_name')}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
