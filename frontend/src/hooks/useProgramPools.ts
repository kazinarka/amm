"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Connection } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { DiscoveredAmmPool, TokenOption } from "@/types";
import { discoverAmmPools, getUniqueTokenOptions } from "@/lib/amm/discovery";
import { NETWORK, READ_RPC_ENDPOINT } from "@/constants";

const POLL_INTERVAL_MS = 20_000;

interface UseProgramPoolsResult {
  pools: DiscoveredAmmPool[];
  tokens: TokenOption[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function formatPoolLoadError(err: unknown) {
  const message = err instanceof Error ? err.message : "Failed to load AMM pools";

  if (/403|access forbidden|forbidden/i.test(message)) {
    return `RPC access was denied by ${READ_RPC_ENDPOINT}. The app is using ${NETWORK}. Set NEXT_PUBLIC_RPC_URL to a working ${NETWORK} Solana RPC if needed.`;
  }

  return message;
}

export function useProgramPools(): UseProgramPoolsResult {
  const { connection } = useConnection();
  const [pools, setPools] = useState<DiscoveredAmmPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);
  // Use a ref so the polling callback always reads the latest connection
  // without recreating the callback (and therefore restarting the interval).
  const connectionRef = useRef<Connection>(connection);
  connectionRef.current = connection;

  const fetchPools = useCallback(async () => {
    try {
      if (!hasFetchedRef.current) setLoading(true);
      const nextPools = await discoverAmmPools(connectionRef.current);
      setPools(nextPools);
      setError(null);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(formatPoolLoadError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
    intervalRef.current = setInterval(fetchPools, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPools]);

  const tokens = useMemo(() => getUniqueTokenOptions(pools), [pools]);

  return { pools, tokens, loading, error, refetch: fetchPools };
}
