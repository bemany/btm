// Bottom-Sheet im Apple-Stil mit zwei Detents (medium ~50vh, large ~88vh).
//
// Verhalten:
//   - Slide-In von unten mit iOS-Standard-Easing
//   - Drag am Handle: folgt dem Finger
//   - Swipe-Down über Threshold (oder schneller Flick) → schließt
//   - Drag zwischen Detents snapt zum nächsten
//   - Backdrop-Tap schließt
//   - Während Drag: keine Transition; nach Release: Spring-Snap

import { useRef, useState, useCallback, useEffect } from 'react';

export type SheetDetent = 'medium' | 'large';

export interface MobBottomSheetProps {
  onClose: () => void;
  initialDetent?: SheetDetent;
  children: React.ReactNode;
}

// Tracking-Eintrag für Velocity-Berechnung
type VelocitySample = { y: number; t: number };

// Threshold-Konstanten in px (Drag-Distanz vom aktuellen Detent)
const CLOSE_DISTANCE = 120;
const DETENT_SWITCH_DISTANCE = 60;
const FLICK_VELOCITY = 0.6; // px/ms — über dieser Geschwindigkeit gilt's als Flick

export function MobBottomSheet({
  onClose,
  initialDetent = 'medium',
  children,
}: MobBottomSheetProps) {
  const [detent, setDetent] = useState<SheetDetent>(initialDetent);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startY = useRef(0);
  const samples = useRef<VelocitySample[]>([]);

  // Esc-Key schließt (nur Desktop-Test mit ?mobile=1)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    samples.current = [{ y: startY.current, t: performance.now() }];
    setDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const y = e.touches[0].clientY;
    const delta = y - startY.current;
    // Pull-up auf large erlauben (negative offset bis -80)
    const clamped = detent === 'large' && delta < 0 ? Math.max(-40, delta) : Math.max(-40, delta);
    setDragOffset(clamped);
    samples.current.push({ y, t: performance.now() });
    // Nur die letzten 6 Samples behalten (~100ms)
    if (samples.current.length > 6) samples.current.shift();
  }, [detent]);

  const computeVelocity = (): number => {
    const s = samples.current;
    if (s.length < 2) return 0;
    const first = s[0];
    const last = s[s.length - 1];
    const dt = last.t - first.t;
    if (dt <= 0) return 0;
    return (last.y - first.y) / dt;
  };

  const onTouchEnd = useCallback(() => {
    setDragging(false);
    const delta = dragOffset;
    const velocity = computeVelocity();

    // Schneller Flick nach unten → schließen
    if (velocity > FLICK_VELOCITY && delta > 20) {
      onClose();
      return;
    }
    // Großer Drag nach unten → schließen
    if (delta > CLOSE_DISTANCE) {
      onClose();
      return;
    }
    // Drag nach unten mittlerer Größe + im large-Detent → snap zu medium
    if (delta > DETENT_SWITCH_DISTANCE && detent === 'large') {
      setDetent('medium');
      setDragOffset(0);
      return;
    }
    // Drag nach oben + im medium-Detent → snap zu large
    if (delta < -DETENT_SWITCH_DISTANCE / 2 && detent === 'medium') {
      setDetent('large');
      setDragOffset(0);
      return;
    }
    // Schneller Flick nach oben → snap zu large
    if (velocity < -FLICK_VELOCITY && detent === 'medium') {
      setDetent('large');
      setDragOffset(0);
      return;
    }
    // Sonst: zurück zur aktuellen Position
    setDragOffset(0);
  }, [dragOffset, detent, onClose]);

  const onBackdropClick = useCallback((e: React.MouseEvent) => {
    // Nur wenn auf den Backdrop selbst geklickt wird, nicht auf die Card
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Opacity des Backdrops je nach Detent (medium etwas durchsichtiger)
  const backdropOpacity = detent === 'medium' ? 0.35 : 0.5;

  return (
    <div
      className="mob-bs-backdrop"
      style={{ ['--backdrop-opacity' as string]: backdropOpacity }}
      onClick={onBackdropClick}
    >
      <div
        className={`mob-bs-card detent-${detent} ${dragging ? 'is-dragging' : ''}`}
        style={{ transform: dragOffset !== 0 ? `translateY(${dragOffset}px)` : undefined }}
      >
        <div
          className="mob-bs-handle"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => { setDragging(false); setDragOffset(0); }}
        >
          <span className="mob-bs-handle-bar" />
        </div>
        <div className="mob-bs-body">
          {children}
        </div>
      </div>
    </div>
  );
}
