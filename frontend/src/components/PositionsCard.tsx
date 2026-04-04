"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { DiscoveredAmmPool } from "@/types";
import { useLpPositions } from "@/hooks/useLpPositions";
import { formatPoolLabel } from "@/lib/amm/discovery";
import { formatTokenAmount } from "@/lib/amm/quote";
import { shortenAddress } from "@/constants";

interface PositionsCardProps {
  pools: DiscoveredAmmPool[];
  loading: boolean;
}

export function PositionsCard({ pools, loading }: PositionsCardProps) {
  const { connected } = useWallet();
  const { positions, loading: positionsLoading } = useLpPositions(pools);

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface/90 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="border-b border-surface-border/50 px-5 py-4">
        <h2 className="text-lg font-semibold">Positions</h2>
        <p className="mt-1 text-sm text-dark-500">View every LP token position detected in your connected wallet.</p>
      </div>

      {!connected ? (
        <div className="px-5 py-12 text-center text-sm text-dark-500">Connect your wallet to see LP token balances across all discovered pools.</div>
      ) : loading || positionsLoading ? (
        <div className="px-5 py-12 text-center text-sm text-dark-500">Scanning wallet LP positions...</div>
      ) : positions.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-dark-500">No LP token balances found for the current wallet.</div>
      ) : (
        <div className="divide-y divide-surface-border/40">
          {positions.map((position) => (
            <div key={position.pool.poolId} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{formatPoolLabel(position.pool)}</div>
                  <div className="mt-1 text-xs text-dark-500">Pool {shortenAddress(position.pool.poolId)} • Market ID {shortenAddress(position.pool.marketId)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatTokenAmount(position.lpBalance, position.pool.coinDecimals)}</div>
                  <div className="text-xs text-dark-500">LP tokens</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl border border-surface-border/40 bg-surface-raised/50 px-3 py-2 text-xs text-dark-400">
                <span>Wallet share</span>
                <span>{(position.shareBps / 100).toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
