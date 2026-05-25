// Silk — weich fliessende Wellen-Layer im React-Bits-"Silk"-Stil.
// Vier ueberlappende SVG-Wellen mit unterschiedlichen Frequenzen + Drift-
// Animationen ergeben ein langsam atmendes Seide-Pattern. Color-Stops
// reagieren auf Akzent-Variable (--accent-rgb), pulsen aber nicht stark.
//
// CSS-only Animation, kein requestAnimationFrame — pausiert automatisch
// im Hintergrund-Tab.

export function Silk({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-silk ${preview ? 'is-preview' : ''}`}>
      <svg
        className="bg-silk-svg"
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="silk-grad-a" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0.45)" />
            <stop offset="50%" stopColor="rgba(var(--accent-rgb), 0.15)" />
            <stop offset="100%" stopColor="rgba(var(--accent-rgb), 0.40)" />
          </linearGradient>
          <linearGradient id="silk-grad-b" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(120, 150, 200, 0.30)" />
            <stop offset="50%" stopColor="rgba(160, 130, 200, 0.10)" />
            <stop offset="100%" stopColor="rgba(120, 150, 200, 0.30)" />
          </linearGradient>
        </defs>
        {/* 4 Wellen mit verschiedenen Tiefen + Phasen */}
        <path
          className="bg-silk-wave bg-silk-wave-1"
          fill="url(#silk-grad-a)"
          d="M0,300 C200,200 400,400 600,300 C800,200 1000,400 1200,300 L1200,600 L0,600 Z"
        />
        <path
          className="bg-silk-wave bg-silk-wave-2"
          fill="url(#silk-grad-b)"
          d="M0,360 C250,260 450,460 700,360 C900,290 1100,460 1300,380 L1300,600 L0,600 Z"
        />
        <path
          className="bg-silk-wave bg-silk-wave-3"
          fill="url(#silk-grad-a)"
          d="M0,420 C220,330 480,520 720,420 C920,340 1120,500 1300,440 L1300,600 L0,600 Z"
        />
        <path
          className="bg-silk-wave bg-silk-wave-4"
          fill="url(#silk-grad-b)"
          d="M0,480 C240,400 460,560 740,480 C940,400 1140,540 1300,500 L1300,600 L0,600 Z"
        />
      </svg>
    </div>
  );
}
