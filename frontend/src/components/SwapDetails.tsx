"use client";

import { motion } from "framer-motion";
import { Token } from "@/types";

interface SwapDetailsProps {
  tokenFrom: Token;
  tokenTo: Token;
  amountFrom: string;
  amountTo: string;
  slippage: number;
}

export function SwapDetails({ tokenFrom, tokenTo, amountFrom, amountTo, slippage }: SwapDetailsProps) {
  const rate = parseFloat(amountFrom) > 0
    ? (parseFloat(amountTo) / parseFloat(amountFrom)).toFixed(6)
    : "0";

  const minimumReceived = parseFloat(amountTo) > 0
    ? (parseFloat(amountTo) * (1 - slippage / 10000)).toFixed(6)
    : "0";

  const priceImpact = parseFloat(amountFrom) > 0
    ? Math.min(parseFloat(amountFrom) * 0.001, 5).toFixed(2)
    : "0";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="mx-4 mb-4 rounded-xl bg-surface-raised/50 border border-surface-border/30 p-3.5 space-y-2.5">
        <DetailRow
          label="Rate"
          value={`1 ${tokenFrom.symbol} ≈ ${rate} ${tokenTo.symbol}`}
        />
        <DetailRow
          label="Price Impact"
          value={`${priceImpact}%`}
          valueColor={parseFloat(priceImpact) > 1 ? "text-yellow-400" : "text-accent"}
        />
        <DetailRow
          label="Min. Received"
          value={`${minimumReceived} ${tokenTo.symbol}`}
        />
        <DetailRow
          label="Slippage"
          value={`${(slippage / 100).toFixed(1)}%`}
        />
        <DetailRow
          label="Network Fee"
          value="~0.00005 SOL"
        />
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
