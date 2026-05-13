/**
 * Per-User Akzentfarbe (Feature F7JzZf65SzX).
 *
 * Übersicht: jeder User kann seine Accent-Color in den Einstellungen wählen.
 * Wir schreiben den Hex-Wert ('#RRGGBB') in `users.accentColor` (Server),
 * cachen ihn in localStorage und übersetzen ihn zur Laufzeit in alle
 * Accent-CSS-Variablen:
 *   --accent-50/100  hellere Tints (Pill-Backgrounds, Focus-Rings)
 *   --accent-500     Primary (Buttons, Highlights)
 *   --accent-600     Hover/Pressed
 *   --accent-700     Pressed-dark, Active-Text-on-Tint
 *   --accent-rgb     R,G,B-Triplet ohne Alpha — für rgba(var(--accent-rgb), X)
 *
 * Bugfix FatbLooqY9-: vorher nur 500/600/700 — viele Komponenten benutzen
 * rgba-Tinten oder die 50/100-Tokens, die dadurch beim Wechsel auf z.B. Lila
 * trotzdem orange blieben. Jetzt richtet sich alles nach dem User-Wert.
 *
 * Default-Verhalten: wenn `accentColor` null/leer ist, entfernen wir die
 * inline overrides → Tokens aus `globio-tokens.css` / `btm-dark.css` greifen
 * (Default-Orange #c85a2c).
 */

export const ACCENT_DEFAULT = '#c85a2c'; // Globio-Terrakotta — Default-Orange.
const STORAGE_KEY = 'btm.accent.v1';

/** Strenge 6-Hex-Validierung; alles andere ignorieren wir bewusst. */
export function isValidAccentHex(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function loadAccent(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return null;
    if (v === '') return null;
    return isValidAccentHex(v) ? v.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function saveAccent(hex: string | null): void {
  try {
    if (hex === null) localStorage.removeItem(STORAGE_KEY);
    else if (isValidAccentHex(hex)) localStorage.setItem(STORAGE_KEY, hex.toLowerCase());
  } catch {
    /* ignore */
  }
}

/* ── Color-Math: aus dem 500er ableiten wir 600 (Hover) + 700 (Pressed)
 *    indem wir die Lightness im HSL-Raum um -10% bzw. -20% drücken.
 *    Das matcht das bestehende Globio-Set (#c85a2c → #a84722 → #86381b)
 *    überraschend gut und liefert für andere Töne (lila/blau/grün) ein
 *    natürlich wirkendes Hover. */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidAccentHex(hex)) return null;
  const n = hex.slice(1);
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
    }
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return {
    r: hue2rgb(p, q, hn + 1 / 3) * 255,
    g: hue2rgb(p, q, hn) * 255,
    b: hue2rgb(p, q, hn - 1 / 3) * 255,
  };
}

function shiftLightness(hex: string, deltaL: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const out = hslToRgb(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + deltaL)));
  return rgbToHex(out.r, out.g, out.b);
}

/** Setzt die helle Tint absolut (überschreibt L) — nutzen wir für 50/100
 *  damit die Tints unabhängig von der Source-Brightness immer hell genug
 *  sind (sonst wirken z.B. helle Türkis-Tones als 50er fast unsichtbar). */
function tintLightness(hex: string, targetL: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Sättigung etwas runternehmen, sonst sehen helle Tints zu „neon" aus.
  const out = hslToRgb(hsl.h, Math.max(0, hsl.s * 0.6), targetL);
  return rgbToHex(out.r, out.g, out.b);
}

/** Schreibt alle Accent-CSS-Variablen auf <body>. `null` → overrides
 *  entfernen, damit die Defaults aus globio-tokens.css / btm-dark.css greifen. */
export function applyAccent(hex: string | null): void {
  const body = document.body;
  if (!body) return;
  const props = ['--accent-50', '--accent-100', '--accent-500', '--accent-600', '--accent-700', '--accent-rgb'];
  if (hex === null || !isValidAccentHex(hex)) {
    for (const p of props) body.style.removeProperty(p);
    return;
  }
  const norm = hex.toLowerCase();
  const rgb = hexToRgb(norm);
  body.style.setProperty('--accent-50', tintLightness(norm, 0.93));
  body.style.setProperty('--accent-100', tintLightness(norm, 0.84));
  body.style.setProperty('--accent-500', norm);
  body.style.setProperty('--accent-600', shiftLightness(norm, -0.1));
  body.style.setProperty('--accent-700', shiftLightness(norm, -0.2));
  if (rgb) {
    body.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }
}

/** Vordefinierte Presets — gerade Werte, klein gehalten, freundliche Töne. */
export const ACCENT_PRESETS: Array<{ id: string; hex: string; labelKey: string }> = [
  { id: 'orange', hex: '#c85a2c', labelKey: 'appearance.accent_preset_orange' },
  { id: 'purple', hex: '#7c3aed', labelKey: 'appearance.accent_preset_purple' },
  { id: 'blue', hex: '#2563eb', labelKey: 'appearance.accent_preset_blue' },
  { id: 'teal', hex: '#0d9488', labelKey: 'appearance.accent_preset_teal' },
  { id: 'green', hex: '#16a34a', labelKey: 'appearance.accent_preset_green' },
  { id: 'pink', hex: '#db2777', labelKey: 'appearance.accent_preset_pink' },
  { id: 'red', hex: '#dc2626', labelKey: 'appearance.accent_preset_red' },
];
