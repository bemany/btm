// Grain — feines Film-Noise mit langsamer Drift. SVG-Filter (fractalNoise)
// als data-URI in einem CSS-Background, Animation per @keyframes.

export function Grain({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-grain ${preview ? 'is-preview' : ''}`}>
      <div className="bg-grain-tint" />
      <div className="bg-grain-noise" />
    </div>
  );
}
