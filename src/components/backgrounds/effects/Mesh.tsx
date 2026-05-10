// Mesh-Gradient — vier weiche Color-Punkte die langsam pulsieren.
// Inspiration: macOS Sequoia / Apple Mesh-Gradient.

export function Mesh({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-mesh ${preview ? 'is-preview' : ''}`}>
      <div className="bg-mesh-pt bg-mesh-pt-1" />
      <div className="bg-mesh-pt bg-mesh-pt-2" />
      <div className="bg-mesh-pt bg-mesh-pt-3" />
      <div className="bg-mesh-pt bg-mesh-pt-4" />
    </div>
  );
}
