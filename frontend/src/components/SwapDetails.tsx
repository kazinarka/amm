"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SwapQuote } from "@/types";
import { formatTokenAmount } from "@/lib/amm/quote";

// Hoisted — avoids creating new objects on every render.
const COLLAPSE_INITIAL = { height: 0, opacity: 0 } as const;
const COLLAPSE_ANIMATE = { height: "auto", opacity: 1 } as const;
const COLLAPSE_EXIT = { height: 0, opacity: 0 } as const;
const COLLAPSE_TRANSITION = { duration: 0.2, ease: "easeOut" } as const;

interface SwapDetailsProps {
  quote: SwapQuote;
  inputSymbol: string;
  outputSymbol: string;
  outputDecimals: number;
  feeDecimals: number;
  slippageBps: number;
}

/**
 * Swap details panel — shows rate, price impact, minimum received, fee, slippage.
 * Wired to real SwapQuote data from the AMM.
 * Collapsible: click to expand/collapse details.
 */
export function SwapDetails({
  quote,
  inputSymbol,
  outputSymbol,
  outputDecimals,
  feeDecimals,
  slippageBps,
}: SwapDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  const rate = quote.rate > 0 ? quote.rate.toFixed(6) : "0";
  const minReceived = formatTokenAmount(quote.minimumAmountOut, outputDecimals);
  const fee = formatTokenAmount(quote.fee, feeDecimals);
  const priceImpact = (quote.priceImpactBps / 100).toFixed(2);

  const impactColor =
    quote.priceImpactBps > 500
      ? "text-red-400"
      : quote.priceImpactBps > 100
      ? "text-yellow-400"
      : "text-accent";

  return (
    <motion.div
      initial={COLLAPSE_INITIAL}
      animate={COLLAPSE_ANIMATE}
      exit={COLLAPSE_EXIT}
      transition={COLLAPSE_TRANSITION}
      className="overflow-hidden"
    >
      <div className="mx-4 mb-4 rounded-xl bg-surface-raised/50 border border-surface-border/30">
        {/* Clickable header row — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3.5 text-xs"
        >
          <span className="text-dark-500">Rate</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium font-mono text-dark-200">
              1 {inputSymbol} ≈ {rate} {outputSymbol}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`text-dark-400 transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {/* Expandable details */}
        {expanded && (
          <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-surface-border/20 pt-2.5">
            <DetailRow
              label="Price Impact"
              value={`${priceImpact}%`}
              valueColor={impactColor}
            />
            <DetailRow
              label="Min. Received"
              value={`${minReceived} ${outputSymbol}`}
            />
            <DetailRow
              label="Swap Fee"
              value={`${fee} ${inputSymbol}`}
            />
            <DetailRow
              label="Slippage"
              value={`${(slippageBps / 100).toFixed(1)}%`}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DetailRow({
  label,
  value,
  valueColor = "text-dark-200",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-dark-500">{label}</span>
      <span className={`font-medium font-mono ${valueColor}`}>{value}</span>
    </div>
  );
}
