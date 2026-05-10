// Grainient — kräftiger Mehrfarb-Gradient + grobes Filmkorn-Overlay.

export function Grainient({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-grainient ${preview ? 'is-preview' : ''}`}>
      <div className="bg-grainient-color" />
      <div className="bg-grainient-noise" />
    </div>
  );
}
