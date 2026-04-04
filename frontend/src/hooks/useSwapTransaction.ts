"use client";

import { useState, useCallback, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AmmPoolData, SwapQuote, SwapSettings, SwapStatus } from "@/types";
import { buildSwapTransaction, getExecutionConnection } from "@/lib/transaction";
import { parseSwapError } from "@/lib/amm/errors";
import toast from "react-hot-toast";

interface UseSwapTransactionParams {
  pool: AmmPoolData | null;
  quote: SwapQuote | null;
  inputMint: string | null;
  outputMint: string | null;
  settings: SwapSettings;
  onSuccess?: (signature: string) => void;
}

interface UseSwapTransactionResult {
  swapStatus: SwapStatus;
  executeSwap: () => void;
  resetStatus: () => void;
}

/**
 * React hook: execute a swap transaction, tracking status through all stages.
 *
 * Status lifecycle: idle → building → signing → sending → confirming → confirmed | error
 */
export function useSwapTransaction({
  pool,
  quote,
  inputMint,
  outputMint,
  settings,
  onSuccess,
}: UseSwapTransactionParams): UseSwapTransactionResult {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [swapStatus, setSwapStatus] = useState<SwapStatus>({ status: "idle" });

  // Memoize PublicKey instances to avoid rebuilding on every executeSwap call.
  const inputPubkey = useMemo(() => {
    try { return inputMint ? new PublicKey(inputMint) : null; } catch { return null; }
  }, [inputMint]);
  const outputPubkey = useMemo(() => {
    try { return outputMint ? new PublicKey(outputMint) : null; } catch { return null; }
  }, [outputMint]);

  const executeSwap = useCallback(async () => {
    if (!pool || !quote || !publicKey || !signTransaction || !inputPubkey || !outputPubkey) {
      return;
    }

    if (quote.amountIn <= 0n || quote.amountOut <= 0n) {
      setSwapStatus({ status: "error", error: "Invalid swap amounts" });
      return;
    }

    try {
      const executionConnection = getExecutionConnection(connection, settings);

      // 1. Build transaction
      setSwapStatus({ status: "building" });
      const tx = await buildSwapTransaction({
        connection: executionConnection,
        pool,
        quote,
        inputMint: inputPubkey,
        outputMint: outputPubkey,
        wallet: publicKey,
        settings,
      });

      // 2. Request wallet signature
      setSwapStatus({ status: "signing" });
      const signed = await signTransaction(tx);

      // 3. Send raw transaction
      setSwapStatus({ status: "sending" });
      const rawTransaction = signed.serialize();
      const signature = await executionConnection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        maxRetries: 3,
      });

      // 4. Confirm
      setSwapStatus({ status: "confirming" });
      await executionConnection.confirmTransaction(signature, "confirmed");

      // 5. Success!
      setSwapStatus({ status: "confirmed", signature });
      toast.success("Trade placed successfully!", { icon: "✅" });
      onSuccess?.(signature);
    } catch (err) {
      const message = parseSwapError(err);
      setSwapStatus({ status: "error", error: message });

      // Don't toast if user simply cancelled
      if (message !== "Transaction cancelled by user") {
        toast.error(message);
      }
    }
  }, [pool, quote, inputPubkey, outputPubkey, settings, publicKey, signTransaction, connection, onSuccess]);

  const resetStatus = useCallback(() => {
    setSwapStatus({ status: "idle" });
  }, []);

  return { swapStatus, executeSwap, resetStatus };
}
