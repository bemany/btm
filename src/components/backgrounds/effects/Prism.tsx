// Prism — radialer Conic-Rainbow-Gradient, der langsam rotiert.

export function Prism({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-prism ${preview ? 'is-preview' : ''}`}>
      <div className="bg-prism-conic" />
    </div>
  );
}
