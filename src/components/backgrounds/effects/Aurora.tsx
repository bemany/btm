// Aurora — drei weiche Color-Blobs die langsam durch den Viewport
// driften. Light-Mode warmes Cream + Akzent-Hauch, Dark-Mode kühlere
// Violett/Blau-Tinte.

export function Aurora({ preview = false }: { preview?: boolean }) {
  return (
    <div className={`bg-aurora ${preview ? 'is-preview' : ''}`}>
      <div className="bg-aurora-blob bg-aurora-blob-1" />
      <div className="bg-aurora-blob bg-aurora-blob-2" />
      <div className="bg-aurora-blob bg-aurora-blob-3" />
    </div>
  );
}
