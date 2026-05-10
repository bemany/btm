// Lines — diagonale Lichtlinien die langsam durch den Viewport gleiten.

export function Lines({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-lines ${preview ? 'is-preview' : ''}`}>
      <div className="bg-lines-stripes" />
    </div>
  );
}
