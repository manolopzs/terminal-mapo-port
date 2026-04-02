import { T } from "@/styles/tokens";

const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <style>{shimmerStyle}</style>
      <div style={{ padding: 16 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 16,
              borderRadius: 3,
              marginBottom: 8,
              backgroundImage: `linear-gradient(90deg, ${T.surfaceAlt} 25%, ${T.border} 50%, ${T.surfaceAlt} 75%)`,
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              opacity: 1 - i * 0.1,
            }}
          />
        ))}
      </div>
    </>
  );
}
