"use client";

import { TradeSide } from "@/types";
import { formatTokenAmount } from "@/lib/amm/quote";

interface QuickAmountButtonsProps {
  side: TradeSide;
  tokenBalance: bigint;
  tokenDecimals: number;
  onAmountChange: (amount: string) => void;
}

const BUY_PRESETS = [
  { label: "0.1 SOL", value: "0.1" },
  { label: "0.5 SOL", value: "0.5" },
  { label: "1 SOL", value: "1" },
];

const SELL_PERCENTAGES = [
  { label: "25%", pct: 25 },
  { label: "50%", pct: 50 },
  { label: "75%", pct: 75 },
  { label: "100%", pct: 100 },
];

/**
 * Quick amount preset buttons.
 * - Buy mode: 0.1, 0.5, 1 SOL preset values
 * - Sell mode: 25%, 50%, 75%, 100% of token balance
 */
export function QuickAmountButtons({
  side,
  tokenBalance,
  tokenDecimals,
  onAmountChange,
}: QuickAmountButtonsProps) {
  if (side === "buy") {
    return (
      <div className="flex gap-2">
        {BUY_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onAmountChange(preset.value)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-surface-raised border border-surface-border/50 text-dark-400 hover:text-white hover:border-accent/40 transition-all duration-200"
          >
            {preset.label}
          </button>
        ))}
      </div>
    );
  }

  // Sell mode: percentage of token balance
  return (
    <div className="flex gap-2">
      {SELL_PERCENTAGES.map((preset) => (
        <button
          key={preset.pct}
          onClick={() => {
            if (tokenBalance <= 0n) return;
            const amount = (tokenBalance * BigInt(preset.pct)) / 100n;
            onAmountChange(formatTokenAmount(amount, tokenDecimals));
          }}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-surface-raised border border-surface-border/50 text-dark-400 hover:text-white hover:border-red-500/40 transition-all duration-200"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
