// Animated-Background-Library für den Glass-Modus.
//
// Jeder Background ist eine kleine, in sich geschlossene React-Komponente
// in `./effects/`. Hier definieren wir nur das Verzeichnis (ID, Name,
// Komponente) — die Auswahl-UI im Settings-Modal nutzt dieses Verzeichnis
// um das Picker-Grid zu rendern.
//
// Konventionen:
//  • Komponenten sind purely CSS/SVG-basiert (keine Canvas-Loops, keine
//    requestAnimationFrame-Schleifen) → null Performance-Kosten
//  • CSS-Animationen pausen automatisch wenn der Tab im Background ist
//  • Komponente rendert absolute-positioned, Parent kümmert sich um
//    `position: fixed; inset: 0; z-index: -1; pointer-events: none`
//  • Funktionieren in Light + Dark Glass — in Solid-Themes wird der
//    Background gar nicht gemounted (siehe BackgroundLayer)
//
// React-Bits-Inspiration: Aurora, Beams, Mesh-Gradient, Light-Rays,
// Floating-Dots — pragmatisch nachgebaut, passend zum BTM-Cream-Akzent.

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type BackgroundId =
  | 'none'
  | 'aurora'
  | 'mesh'
  | 'glow'
  | 'beams'
  | 'grain'
  | 'dotgrid'
  | 'lines'
  | 'waves'
  | 'soft-aurora'
  | 'light-pillar'
  | 'prism'
  | 'dark-veil'
  | 'grainient'
  | 'silk'
  | 'hyperspeed';

export interface BackgroundEntry {
  id: BackgroundId;
  /** i18n-Key unter `backgrounds.{id}_name` */
  nameKey: string;
  /** i18n-Key unter `backgrounds.{id}_desc` */
  descKey: string;
  /** Lazy-import; nur die ausgewählte wird wirklich geladen */
  Component: LazyExoticComponent<ComponentType<{ preview?: boolean }>> | null;
  /** "NEU"-Chip im Picker */
  isNew?: boolean;
}

// `Component = null` für 'none' — Layer rendert dann gar nichts.
export const BACKGROUNDS: BackgroundEntry[] = [
  {
    id: 'none',
    nameKey: 'backgrounds.none_name',
    descKey: 'backgrounds.none_desc',
    Component: null,
  },
  {
    id: 'aurora',
    nameKey: 'backgrounds.aurora_name',
    descKey: 'backgrounds.aurora_desc',
    Component: lazy(() => import('./effects/Aurora').then((m) => ({ default: m.Aurora }))),
  },
  {
    id: 'mesh',
    nameKey: 'backgrounds.mesh_name',
    descKey: 'backgrounds.mesh_desc',
    Component: lazy(() => import('./effects/Mesh').then((m) => ({ default: m.Mesh }))),
  },
  {
    id: 'glow',
    nameKey: 'backgrounds.glow_name',
    descKey: 'backgrounds.glow_desc',
    Component: lazy(() => import('./effects/Glow').then((m) => ({ default: m.Glow }))),
  },
  {
    id: 'beams',
    nameKey: 'backgrounds.beams_name',
    descKey: 'backgrounds.beams_desc',
    Component: lazy(() => import('./effects/Beams').then((m) => ({ default: m.Beams }))),
  },
  {
    id: 'grain',
    nameKey: 'backgrounds.grain_name',
    descKey: 'backgrounds.grain_desc',
    Component: lazy(() => import('./effects/Grain').then((m) => ({ default: m.Grain }))),
  },
  {
    id: 'dotgrid',
    nameKey: 'backgrounds.dotgrid_name',
    descKey: 'backgrounds.dotgrid_desc',
    Component: lazy(() => import('./effects/Dotgrid').then((m) => ({ default: m.Dotgrid }))),
  },
  {
    id: 'lines',
    nameKey: 'backgrounds.lines_name',
    descKey: 'backgrounds.lines_desc',
    Component: lazy(() => import('./effects/Lines').then((m) => ({ default: m.Lines }))),
  },
  {
    id: 'waves',
    nameKey: 'backgrounds.waves_name',
    descKey: 'backgrounds.waves_desc',
    Component: lazy(() => import('./effects/Waves').then((m) => ({ default: m.Waves }))),
  },
  {
    id: 'soft-aurora',
    nameKey: 'backgrounds.soft_aurora_name',
    descKey: 'backgrounds.soft_aurora_desc',
    Component: lazy(() => import('./effects/SoftAurora').then((m) => ({ default: m.SoftAurora }))),
    isNew: true,
  },
  {
    id: 'light-pillar',
    nameKey: 'backgrounds.light_pillar_name',
    descKey: 'backgrounds.light_pillar_desc',
    Component: lazy(() => import('./effects/LightPillar').then((m) => ({ default: m.LightPillar }))),
    isNew: true,
  },
  {
    id: 'prism',
    nameKey: 'backgrounds.prism_name',
    descKey: 'backgrounds.prism_desc',
    Component: lazy(() => import('./effects/Prism').then((m) => ({ default: m.Prism }))),
    isNew: true,
  },
  {
    id: 'dark-veil',
    nameKey: 'backgrounds.dark_veil_name',
    descKey: 'backgrounds.dark_veil_desc',
    Component: lazy(() => import('./effects/DarkVeil').then((m) => ({ default: m.DarkVeil }))),
    isNew: true,
  },
  {
    id: 'grainient',
    nameKey: 'backgrounds.grainient_name',
    descKey: 'backgrounds.grainient_desc',
    Component: lazy(() => import('./effects/Grainient').then((m) => ({ default: m.Grainient }))),
    isNew: true,
  },
  {
    id: 'silk',
    nameKey: 'backgrounds.silk_name',
    descKey: 'backgrounds.silk_desc',
    Component: lazy(() => import('./effects/Silk').then((m) => ({ default: m.Silk }))),
    isNew: true,
  },
  {
    id: 'hyperspeed',
    nameKey: 'backgrounds.hyperspeed_name',
    descKey: 'backgrounds.hyperspeed_desc',
    Component: lazy(() => import('./effects/Hyperspeed').then((m) => ({ default: m.Hyperspeed }))),
    isNew: true,
  },
];

const STORAGE_KEY = 'btm.background.v1';

/**
 * Liest den Cache-Wert aus localStorage. Wird beim allerersten Render
 * vor `useAuth` benutzt, damit kein Flicker entsteht. Sobald der User
 * geladen ist, wird `user.backgroundChoice` als Source-of-Truth genommen.
 */
export function loadBackground(): BackgroundId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && isValidBackgroundId(v)) return v;
  } catch {
    /* ignore */
  }
  return 'none';
}

/** localStorage als schneller Cache, Server ist die echte Source-of-Truth. */
export function saveBackground(id: BackgroundId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function isValidBackgroundId(v: unknown): v is BackgroundId {
  return typeof v === 'string' && BACKGROUNDS.some((b) => b.id === v);
}

export function getBackground(id: BackgroundId): BackgroundEntry {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
