import { T } from "@/styles/tokens";

interface TickerChipProps {
  ticker: string;
  price?: number;
  change?: number;
  changePercent?: number;
}

export function TickerChip({ ticker, price, change, changePercent }: TickerChipProps) {
  const isPositive = (change ?? 0) >= 0;
  const tickerColor = isPositive ? T.green : T.red;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: tickerColor,
        }}
      >
        {ticker}
      </span>
      {price !== undefined && (
        <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.white }}>
          {price.toFixed(2)}
        </span>
      )}
      {changePercent !== undefined && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: 11,
            color: isPositive ? T.green : T.red,
          }}
        >
          {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
        </span>
      )}
    </span>
  );
}
