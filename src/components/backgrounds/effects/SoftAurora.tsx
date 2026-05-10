// SoftAurora — sanfter als Aurora, weiche Pastell-Bänder die langsam
// horizontal driften. Inspiriert von React-Bits Soft-Aurora.

export function SoftAurora({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-soft-aurora ${preview ? 'is-preview' : ''}`}>
      <div className="bg-sa-band bg-sa-band-1" />
      <div className="bg-sa-band bg-sa-band-2" />
      <div className="bg-sa-band bg-sa-band-3" />
    </div>
  );
}
