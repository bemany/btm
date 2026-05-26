import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icon';
import type { ThemeMode } from '../../store/types';
import { composeTheme, decomposeTheme } from '../../store/types';
import { useT } from '../../i18n';
import { ACCENT_DEFAULT, ACCENT_PRESETS, isValidAccentHex } from '../../lib/accentColor';

export interface AppearanceTabProps {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  /** null = Default-Orange (Globio-Token). String = '#RRGGBB'. */
  accentColor: string | null;
  setAccentColor: (hex: string | null) => void;
}

export function AppearanceTab({ theme, setTheme, accentColor, setAccentColor }: AppearanceTabProps) {
  const t = useT();
  const { base, brightness } = decomposeTheme(theme);

  // Lokaler State für den Color-Picker — Live-Preview im Input ohne sofort
  // PATCH-Storm. Wir commiten erst onBlur oder bei Preset-Klick.
  const effective = (accentColor ?? ACCENT_DEFAULT).toLowerCase();
  const [pickerValue, setPickerValue] = useState<string>(effective);

  // External-Change (z.B. Server-Sync) ins Input spiegeln.
  useEffect(() => {
    setPickerValue(effective);
  }, [effective]);

  const isDefault = accentColor === null;

  return (
    <div className="set-pane">
      <p className="set-intro">{t('settings.appearance_intro')}</p>

      {/* Studio-Theme deaktiviert (2026-05-26) — User koennen nur noch zwischen
          Light/Dark des Glass-Themes waehlen. Solid-Studio-Themes bleiben als
          ThemeMode-Werte erhalten, werden aber automatisch auf Glass migriert
          (siehe App.tsx). */}
      <div className="set-section-label">
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

      <div className="set-section-label" style={{ marginTop: 22 }}>
        {t('settings.appearance_accent')}
      </div>
      <p className="set-pane-help" style={{ marginTop: 0 }}>
        {t('settings.appearance_accent_help')}
      </p>

      <div className="accent-presets">
        {ACCENT_PRESETS.map((preset) => {
          const active = !isDefault && effective === preset.hex.toLowerCase();
          // Orange-Preset zählt zusätzlich als "default", wenn accentColor=null.
          const isOrangeDefault = preset.id === 'orange' && isDefault;
          return (
            <button
              key={preset.id}
              type="button"
              className={`accent-preset ${active || isOrangeDefault ? 'is-active' : ''}`}
              onClick={() => {
                // Bei Klick auf Orange → null (Default), sonst Hex.
                setAccentColor(preset.id === 'orange' ? null : preset.hex);
              }}
              aria-label={t(preset.labelKey as never)}
              title={t(preset.labelKey as never)}
            >
              <span
                className="accent-preset-swatch"
                style={{ background: preset.hex }}
                aria-hidden="true"
              />
              <span className="accent-preset-label">{t(preset.labelKey as never)}</span>
              {(active || isOrangeDefault) && (
                <Icon name="check" size={12} className="accent-preset-check" />
              )}
            </button>
          );
        })}
      </div>

      <div className="accent-custom">
        <label className="accent-custom-label">
          <span>{t('settings.appearance_accent_custom')}</span>
          <span className="accent-custom-row">
            <input
              type="color"
              className="accent-custom-input"
              value={pickerValue}
              onChange={(e) => setPickerValue(e.target.value)}
              onBlur={() => {
                if (isValidAccentHex(pickerValue) && pickerValue.toLowerCase() !== effective) {
                  setAccentColor(pickerValue.toLowerCase());
                }
              }}
              aria-label={t('settings.appearance_accent_custom')}
            />
            <code className="accent-custom-hex">{pickerValue.toUpperCase()}</code>
            <button
              type="button"
              className="accent-custom-apply"
              onClick={() => {
                if (isValidAccentHex(pickerValue) && pickerValue.toLowerCase() !== effective) {
                  setAccentColor(pickerValue.toLowerCase());
                }
              }}
              disabled={!isValidAccentHex(pickerValue) || pickerValue.toLowerCase() === effective}
            >
              {t('settings.appearance_accent_apply')}
            </button>
          </span>
        </label>
        {!isDefault && (
          <button
            type="button"
            className="accent-custom-reset"
            onClick={() => setAccentColor(null)}
          >
            <Icon name="rotate-ccw" size={12} />
            <span>{t('settings.appearance_accent_reset')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
