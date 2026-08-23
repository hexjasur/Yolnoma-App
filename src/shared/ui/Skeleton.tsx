/** Grid of card skeletons while data loads. */
export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ aspectRatio: '3/4', borderRadius: 14 }}
        />
      ))}
    </div>
  );
}

/** Single line skeleton (text placeholder). */
export function LineSkeleton({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 6 }} />;
}
