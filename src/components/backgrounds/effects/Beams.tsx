// Light-Beams — drei diagonale Lichtsäulen die langsam von oben nach
// unten driften. Subtil, kein Disco.

export function Beams({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-beams ${preview ? 'is-preview' : ''}`}>
      <div className="bg-beam bg-beam-1" />
      <div className="bg-beam bg-beam-2" />
      <div className="bg-beam bg-beam-3" />
    </div>
  );
}
