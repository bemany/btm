// Dotgrid — sanftes Punkte-Raster mit langsam wandernder Vignette.

export function Dotgrid({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-dotgrid ${preview ? 'is-preview' : ''}`}>
      <div className="bg-dotgrid-pattern" />
      <div className="bg-dotgrid-vignette" />
    </div>
  );
}
