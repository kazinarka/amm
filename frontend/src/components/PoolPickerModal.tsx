"use client";

import { motion } from "framer-motion";
import { DiscoveredAmmPool } from "@/types";
import { formatPoolLabel } from "@/lib/amm/discovery";
import { shortenAddress } from "@/constants";

// Hoisted — avoids creating new objects on every render.
const OVERLAY_INITIAL = { opacity: 0 } as const;
const OVERLAY_ANIMATE = { opacity: 1 } as const;
const OVERLAY_EXIT = { opacity: 0 } as const;
const PANEL_INITIAL = { scale: 0.96, opacity: 0, y: 8 } as const;
const PANEL_ANIMATE = { scale: 1, opacity: 1, y: 0 } as const;
const PANEL_EXIT = { scale: 0.96, opacity: 0, y: 8 } as const;

interface PoolPickerModalProps {
  pools: DiscoveredAmmPool[];
  selectedPoolId: string | null;
  onSelect: (pool: DiscoveredAmmPool) => void;
  onClose: () => void;
}

export function PoolPickerModal({ pools, selectedPoolId, onSelect, onClose }: PoolPickerModalProps) {
  return (
    <motion.div
      initial={OVERLAY_INITIAL}
      animate={OVERLAY_ANIMATE}
      exit={OVERLAY_EXIT}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <motion.div
        initial={PANEL_INITIAL}
        animate={PANEL_ANIMATE}
        exit={PANEL_EXIT}
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h3 className="text-lg font-semibold">Choose pool</h3>
            <p className="mt-1 text-xs text-dark-500">If multiple pools support this pair, pick which one to trade or manage.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-dark-400 transition-colors hover:bg-surface-raised hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {pools.length === 0 ? (
            <div className="py-12 text-center text-sm text-dark-500">No pools match this token pair.</div>
          ) : (
            pools.map((pool) => (
              <button
                key={pool.poolId}
                onClick={() => onSelect(pool)}
                className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-raised/80 ${
                  pool.poolId === selectedPoolId ? "bg-accent/5" : ""
                }`}
              >
                <div>
                  <div className="font-semibold">{formatPoolLabel(pool)}</div>
                  <div className="mt-1 text-xs text-dark-500">Market ID {shortenAddress(pool.marketId)}</div>
                </div>
                <div className="text-right text-xs text-dark-500">
                  <div>{shortenAddress(pool.poolId)}</div>
                  <div className="mt-1">LP {shortenAddress(pool.lpMint)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
