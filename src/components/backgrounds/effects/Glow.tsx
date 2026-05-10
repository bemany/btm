// Sanfter zentraler Akzent-Glow — atmet langsam.

export function Glow({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-glow ${preview ? 'is-preview' : ''}`}>
      <div className="bg-glow-orb" />
    </div>
  );
}
