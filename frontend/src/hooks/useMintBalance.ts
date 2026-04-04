"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { SOL_MINT } from "@/constants";

interface UseMintBalanceResult {
  balance: bigint;
  loading: boolean;
  refetch: () => void;
}

export function useMintBalance(
  mint: string | null,
  refreshTick = 0
): UseMintBalanceResult {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);
  const connectionRef = useRef<Connection>(connection);
  connectionRef.current = connection;

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !mint) {
      setBalance(0n);
      return;
    }

    setLoading(true);
    try {
      if (mint === SOL_MINT) {
        const lamports = await connectionRef.current.getBalance(publicKey, "confirmed");
        setBalance(BigInt(lamports));
      } else {
        const mintKey = new PublicKey(mint);
        const ata = getAssociatedTokenAddressSync(
          mintKey,
          publicKey,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const tokenBalance = await connectionRef.current.getTokenAccountBalance(ata, "confirmed");
        setBalance(BigInt(tokenBalance.value.amount));
      }
    } catch {
      setBalance(0n);
    } finally {
      setLoading(false);
    }
  }, [mint, publicKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, refreshTick]);

  return { balance, loading, refetch: fetchBalance };
}
