// DarkVeil — dunkler Verlauf mit langsam wandernder Vignette.

export function DarkVeil({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-dark-veil ${preview ? 'is-preview' : ''}`}>
      <div className="bg-dv-base" />
      <div className="bg-dv-vignette" />
    </div>
  );
}
