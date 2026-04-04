"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { AmmPoolData, SwapQuote } from "@/types";
import { quoteSwapBaseIn, parseHumanAmount, SwapDirection } from "@/lib/amm/quote";

const DEBOUNCE_MS = 150;

interface UseSwapQuoteParams {
  pool: AmmPoolData | null;
  inputMint: string | null;
  outputMint: string | null;
  inputAmountHuman: string;
  slippageBps: number;
}

/**
 * React hook: compute a swap quote reactively from input amount + pool state.
 * Pure computation — no RPC calls.
 * Debounced 150ms on input changes.
 */
export function useSwapQuote({
  pool,
  inputMint,
  outputMint,
  inputAmountHuman,
  slippageBps,
}: UseSwapQuoteParams): SwapQuote | null {
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize PublicKey instances — avoids recreating them on every debounce tick.
  const inputKey = useMemo(() => {
    try { return inputMint ? new PublicKey(inputMint) : null; } catch { return null; }
  }, [inputMint]);
  const outputKey = useMemo(() => {
    try { return outputMint ? new PublicKey(outputMint) : null; } catch { return null; }
  }, [outputMint]);

  useEffect(() => {
    // Clear any pending debounce
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // No pool or empty input → no quote
    if (!pool || !inputAmountHuman || inputAmountHuman === "." || inputAmountHuman === "0") {
      setQuote(null);
      return;
    }

    timerRef.current = setTimeout(() => {
      try {
        let direction: SwapDirection;
        let inputDecimals: number;

        if (!inputKey || !outputKey) {
          setQuote(null);
          return;
        }

        if (pool.coinMint.equals(inputKey) && pool.pcMint.equals(outputKey)) {
          direction = "coin_to_pc";
          inputDecimals = pool.coinDecimals;
        } else if (pool.pcMint.equals(inputKey) && pool.coinMint.equals(outputKey)) {
          direction = "pc_to_coin";
          inputDecimals = pool.pcDecimals;
        } else {
          setQuote(null);
          return;
        }

        const amountInRaw = parseHumanAmount(inputAmountHuman, inputDecimals);
        if (amountInRaw <= 0n) {
          setQuote(null);
          return;
        }

        const result = quoteSwapBaseIn(pool, amountInRaw, direction, slippageBps);
        setQuote(result);
      } catch {
        setQuote(null);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pool, inputKey, outputKey, inputAmountHuman, slippageBps]);

  return quote;
}
