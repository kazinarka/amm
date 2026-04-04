"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Connection } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DiscoveredAmmPool, LiquidityPosition } from "@/types";

interface UseLpPositionsResult {
  positions: LiquidityPosition[];
  loading: boolean;
}

export function useLpPositions(pools: DiscoveredAmmPool[]): UseLpPositionsResult {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [loading, setLoading] = useState(false);
  // Stable connection ref — same pattern as the polling hooks.
  const connectionRef = useRef<Connection>(connection);
  connectionRef.current = connection;

  // Derive the set of LP mint addresses so we can refetch when pools arrive.
  const lpMintSet = useMemo(
    () => pools.map((p) => p.lpMint).sort().join(","),
    [pools]
  );

  useEffect(() => {
    let active = true;

    async function fetchBalances() {
      if (!publicKey) {
        if (active) setBalances({});
        return;
      }

      setLoading(true);
      try {
        const accounts = await connectionRef.current.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID },
          "confirmed"
        );

        if (!active) return;

        const nextBalances: Record<string, bigint> = {};
        for (const item of accounts.value) {
          const parsed = item.account.data.parsed.info;
          nextBalances[parsed.mint] = BigInt(parsed.tokenAmount.amount);
        }
        setBalances(nextBalances);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchBalances();

    return () => {
      active = false;
    };
  }, [publicKey, lpMintSet]);

  const positions = useMemo(() => {
    return pools
      .map((pool) => {
        const lpBalance = balances[pool.lpMint] ?? 0n;
        if (lpBalance <= 0n || pool.lpAmount <= 0n) return null;

        const shareBps = Number((lpBalance * 10_000n) / pool.lpAmount);
        return {
          pool,
          lpBalance,
          shareBps,
          estimatedCoinAmount: 0n,
          estimatedPcAmount: 0n,
        } satisfies LiquidityPosition;
      })
      .filter((position): position is LiquidityPosition => Boolean(position))
      // Safe bigint comparison — avoids Number() precision loss for large balances.
      .sort((left, right) =>
        right.lpBalance > left.lpBalance ? 1 : right.lpBalance < left.lpBalance ? -1 : 0
      );
  }, [balances, pools]);

  return { positions, loading };
}
