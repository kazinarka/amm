"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

interface UseTokenBalanceResult {
  solBalance: bigint;
  tokenBalance: bigint;
  loading: boolean;
  refetch: () => void;
}

/**
 * React hook: fetch SOL + token balances for the connected wallet.
 *
 * @param coinMint The non-SOL token mint address (base58), or null.
 * @param refreshTick Increment this to trigger a refetch (e.g. after a swap).
 */
export function useTokenBalance(
  coinMint: string | null,
  refreshTick: number = 0
): UseTokenBalanceResult {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [solBalance, setSolBalance] = useState<bigint>(0n);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) {
      setSolBalance(0n);
      setTokenBalance(0n);
      return;
    }

    setLoading(true);
    try {
      // Fetch SOL balance
      const lamports = await connection.getBalance(publicKey);
      setSolBalance(BigInt(lamports));

      // Fetch token balance if mint is provided
      if (coinMint) {
        try {
          const mintPk = new PublicKey(coinMint);
          const ata = getAssociatedTokenAddressSync(
            mintPk,
            publicKey,
            true,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          const accountInfo = await connection.getTokenAccountBalance(ata);
          setTokenBalance(BigInt(accountInfo.value.amount));
        } catch {
          // ATA doesn't exist or other error — balance is 0
          setTokenBalance(0n);
        }
      } else {
        setTokenBalance(0n);
      }
    } catch {
      // RPC error — keep previous values
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, coinMint]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances, refreshTick]);

  return { solBalance, tokenBalance, loading, refetch: fetchBalances };
}
