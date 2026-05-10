// Waves — drei sanfte horizontale Wellen unten am Viewport, animiert
// per CSS-Translate (kein JS-Loop).

export function Waves({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-waves ${preview ? 'is-preview' : ''}`}>
      <svg
        viewBox="0 0 1200 320"
        preserveAspectRatio="none"
        className="bg-waves-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="bg-wave-path bg-wave-1"
          d="M0,160 C200,80 400,240 600,160 C800,80 1000,240 1200,160 L1200,320 L0,320 Z"
        />
        <path
          className="bg-wave-path bg-wave-2"
          d="M0,200 C200,120 400,280 600,200 C800,120 1000,280 1200,200 L1200,320 L0,320 Z"
        />
        <path
          className="bg-wave-path bg-wave-3"
          d="M0,240 C200,180 400,300 600,240 C800,180 1000,300 1200,240 L1200,320 L0,320 Z"
        />
      </svg>
    </div>
  );
}
