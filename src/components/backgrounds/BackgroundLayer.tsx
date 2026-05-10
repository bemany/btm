// Background-Layer — rendert den ausgewählten animierten Hintergrund
// fixed im Viewport, hinter dem App-Content.
//
// Aktivität:
//   • mountet nur, wenn der aktuelle Theme ein Glass-Theme ist (sonst
//     Solid-Themes, die einen eigenen Cream-Hintergrund haben — wäre
//     verschwendete Performance + visuelles Geschacher)
//   • mountet nur, wenn id !== 'none'
//
// Wichtig: Der Glass-Theme setzt am `body` einen Ambient-radial-gradient
// (`btm-glass.css`). Damit unser Layer sichtbar ist, müssen wir diesen
// gradient ausschalten — wir setzen `data-bg=<id>` aufs body, der CSS-
// Override in `backgrounds.css` macht das body transparent.
//
// Pointer-Interaktion:
//   • Globaler `mousemove`-Listener throttled per requestAnimationFrame
//   • Schreibt `--mx` / `--my` (0..1, Viewport-relativ) und `--mxp` /
//     `--myp` (in % für Translate) aufs Body
//   • Effekte nutzen die Variablen in `backgrounds.css` für Glow-Follow,
//     Aurora-Tilt, Mesh-Drift etc. — keine zusätzlichen Re-Renders
//   • Auf Touch-only-Geräten (`pointer: coarse`) wird kein Listener
//     installiert (Default-Werte greifen)
//   • Respektiert `prefers-reduced-motion: reduce`

import { Suspense, useEffect } from 'react';
import type { ThemeMode } from '../../store/types';
import { getBackground, type BackgroundId } from './catalog';

export interface BackgroundLayerProps {
  theme: ThemeMode;
  id: BackgroundId;
}

function isGlassTheme(theme: ThemeMode): boolean {
  return theme === 'glass' || theme === 'glass-dark';
}

export function BackgroundLayer({ theme, id }: BackgroundLayerProps) {
  const active = isGlassTheme(theme) && id !== 'none';

  // Body-Attribut für die CSS-Übersteuerung des Ambient-Gradients
  useEffect(() => {
    if (active) {
      document.body.dataset.bg = id;
    } else {
      delete document.body.dataset.bg;
    }
    return () => {
      delete document.body.dataset.bg;
    };
  }, [active, id]);

  // Pointer-Tracker: schreibt --mx / --my (0..1) + --mxp / --myp (Prozent)
  // aufs body. Throttled per rAF, damit pro Frame nur 1× gesetzt wird.
  useEffect(() => {
    if (!active) return;
    // Touch-Geräte und Reduce-Motion-User → kein Tracker
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let queued = false;
    let lastX = 0.5;
    let lastY = 0.5;
    const update = () => {
      queued = false;
      const root = document.body.style;
      root.setProperty('--mx', lastX.toFixed(4));
      root.setProperty('--my', lastY.toFixed(4));
      root.setProperty('--mxp', (lastX * 100).toFixed(2) + '%');
      root.setProperty('--myp', (lastY * 100).toFixed(2) + '%');
      // Centered: -0.5..+0.5 (für Tilt-Effekte mit Mitte=0)
      root.setProperty('--mxc', (lastX - 0.5).toFixed(4));
      root.setProperty('--myc', (lastY - 0.5).toFixed(4));
    };
    const onMove = (e: MouseEvent) => {
      lastX = e.clientX / window.innerWidth;
      lastY = e.clientY / window.innerHeight;
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };
    // Initial: Mitte
    update();
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
    };
  }, [active]);

  if (!active) return null;
  const entry = getBackground(id);
  if (!entry.Component) return null;
  const Component = entry.Component;
  return (
    <div className="bg-layer" aria-hidden>
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    </div>
  );
}
