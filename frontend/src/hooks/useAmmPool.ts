"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { AmmPoolData } from "@/types";
import { fetchAmmPool } from "@/lib/amm/pool";

const POLL_INTERVAL_MS = 10_000;

/** Compare the mutable numeric fields that actually change between polls. */
function poolDataChanged(prev: AmmPoolData | null, next: AmmPoolData | null): boolean {
  if (prev === null || next === null) return prev !== next;
  return (
    prev.coinVaultBalance !== next.coinVaultBalance ||
    prev.pcVaultBalance !== next.pcVaultBalance ||
    prev.lpAmount !== next.lpAmount ||
    prev.needTakePnlCoin !== next.needTakePnlCoin ||
    prev.needTakePnlPc !== next.needTakePnlPc
  );
}

interface UseAmmPoolResult {
  pool: AmmPoolData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * React hook: fetch + poll AMM pool state every ~10s.
 *
 * @param poolId Base58 pool address string, or null to skip fetching.
 */
export function useAmmPool(poolId: string | null): UseAmmPoolResult {
  const { connection } = useConnection();
  const [pool, setPool] = useState<AmmPoolData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);
  const poolRef = useRef<AmmPoolData | null>(null);
  // Use a ref so the polling callback always reads the latest connection
  // without recreating the callback (and therefore restarting the interval).
  const connectionRef = useRef<Connection>(connection);
  connectionRef.current = connection;

  const fetchPool = useCallback(async () => {
    if (!poolId) {
      setPool(null);
      setError(null);
      poolRef.current = null;
      hasFetchedRef.current = false;
      return;
    }

    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(poolId);
    } catch {
      setError("Invalid pool address");
      setPool(null);
      poolRef.current = null;
      return;
    }

    try {
      if (!hasFetchedRef.current) setLoading(true);
      const data = await fetchAmmPool(connectionRef.current, pubkey);

      // Only update state when on-chain data actually changed — avoids
      // cascading re-renders (quote recalc, BigInt math, formatting) on
      // every poll tick when nothing moved.
      if (poolDataChanged(poolRef.current, data)) {
        poolRef.current = data;
        setPool(data);
      }

      setError(null);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch pool");
      setPool(null);
      poolRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  // Fetch on mount and when poolId changes
  useEffect(() => {
    fetchPool();

    // Set up polling
    if (poolId) {
      intervalRef.current = setInterval(fetchPool, POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchPool, poolId]);

  return { pool, loading, error, refetch: fetchPool };
}
