// LightPillar — eine breite Lichtsäule mittig, die langsam atmet.

export function LightPillar({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-light-pillar ${preview ? 'is-preview' : ''}`}>
      <div className="bg-lp-pillar" />
      <div className="bg-lp-glow" />
    </div>
  );
}
