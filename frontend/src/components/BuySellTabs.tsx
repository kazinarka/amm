"use client";

import { TradeSide } from "@/types";

interface BuySellTabsProps {
  side: TradeSide;
  onSideChange: (side: TradeSide) => void;
}

/**
 * Two-button toggle: "Buy" (green accent) / "Sell" (red).
 * PumpSwap-style full-width tab selector.
 */
export function BuySellTabs({ side, onSideChange }: BuySellTabsProps) {
  return (
    <div className="flex gap-1.5 p-1.5 rounded-xl bg-surface-raised/60 border border-surface-border/40">
      <button
        onClick={() => onSideChange("buy")}
        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
          ${
            side === "buy"
              ? "bg-accent text-black shadow-sm shadow-accent/20"
              : "bg-transparent text-dark-400 hover:text-dark-200"
          }`}
      >
        Buy
      </button>
      <button
        onClick={() => onSideChange("sell")}
        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
          ${
            side === "sell"
              ? "bg-red-500 text-white shadow-sm shadow-red-500/20"
              : "bg-transparent text-dark-400 hover:text-dark-200"
          }`}
      >
        Sell
      </button>
    </div>
  );
}
