"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Token } from "@/types";
import { POPULAR_TOKENS, DEFAULT_SLIPPAGE } from "@/constants";
import { TokenInput } from "./TokenInput";
import { SwapDetails } from "./SwapDetails";
import { SettingsPanel } from "./SettingsPanel";
import { TokenSelectModal } from "./TokenSelectModal";
import toast from "react-hot-toast";

export function SwapCard() {
  const { connected } = useWallet();
  const [tokenFrom, setTokenFrom] = useState<Token>(POPULAR_TOKENS[0]);
  const [tokenTo, setTokenTo] = useState<Token>(POPULAR_TOKENS[1]);
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [showSettings, setShowSettings] = useState(false);
  const [selectingFor, setSelectingFor] = useState<"from" | "to" | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // Simulated price calculation
  const estimateOutput = useCallback(
    (value: string) => {
      if (!value || parseFloat(value) === 0) {
        setAmountTo("");
        return;
      }
      // Simulated rate — replace with real AMM quote
      const rate = tokenFrom.symbol === "SOL" ? 138.42 : 1 / 138.42;
      const output = parseFloat(value) * rate;
      setAmountTo(output.toFixed(tokenTo.decimals > 6 ? 6 : tokenTo.decimals));
    },
    [tokenFrom, tokenTo]
  );

  const handleAmountFromChange = (value: string) => {
    setAmountFrom(value);
    estimateOutput(value);
  };

  const handleFlip = () => {
    setTokenFrom(tokenTo);
    setTokenTo(tokenFrom);
    setAmountFrom(amountTo);
    setAmountTo(amountFrom);
  };

  const handleTokenSelect = (token: Token) => {
    if (selectingFor === "from") {
      if (token.mint === tokenTo.mint) {
        handleFlip();
      } else {
        setTokenFrom(token);
        estimateOutput(amountFrom);
      }
    } else {
      if (token.mint === tokenFrom.mint) {
        handleFlip();
      } else {
        setTokenTo(token);
        estimateOutput(amountFrom);
      }
    }
    setSelectingFor(null);
  };

  const handleSwap = async () => {
    if (!connected) return;
    setIsSwapping(true);
    try {
      // Simulate transaction — replace with real swap TX
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success(
        `Swapped ${amountFrom} ${tokenFrom.symbol} for ${amountTo} ${tokenTo.symbol}`,
        { icon: "✅" }
      );
      setAmountFrom("");
      setAmountTo("");
    } catch {
      toast.error("Swap failed. Please try again.");
    } finally {
      setIsSwapping(false);
    }
  };

  const hasAmount = amountFrom && parseFloat(amountFrom) > 0;

  return (
    <>
      <motion.div
        layout
        className="relative w-full rounded-2xl border border-surface-border bg-surface/90 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold">Swap</h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-xl hover:bg-surface-raised transition-colors group"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-dark-400 group-hover:text-white transition-colors"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <SettingsPanel
              slippage={slippage}
              onSlippageChange={setSlippage}
              onClose={() => setShowSettings(false)}
            />
          )}
        </AnimatePresence>

        {/* Token inputs */}
        <div className="px-4 pb-4 space-y-1.5 relative">
          <TokenInput
            label="You pay"
            token={tokenFrom}
            amount={amountFrom}
            onAmountChange={handleAmountFromChange}
            onTokenSelect={() => setSelectingFor("from")}
            showBalance
          />

          {/* Flip button */}
          <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: "calc(50% - 36px)" }}>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              onClick={handleFlip}
              className="w-10 h-10 rounded-xl bg-surface border-4 border-dark-950 flex items-center justify-center hover:bg-surface-raised transition-colors group"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-dark-400 group-hover:text-accent transition-colors"
              >
                <path d="M7 4v16m0 0l-4-4m4 4l4-4" />
                <path d="M17 20V4m0 0l4 4m-4-4l-4 4" />
              </svg>
            </motion.button>
          </div>

          <TokenInput
            label="You receive"
            token={tokenTo}
            amount={amountTo}
            onAmountChange={() => {}}
            onTokenSelect={() => setSelectingFor("to")}
            readOnly
          />
        </div>

        {/* Swap Details */}
        <AnimatePresence>
          {hasAmount && (
            <SwapDetails
              tokenFrom={tokenFrom}
              tokenTo={tokenTo}
              amountFrom={amountFrom}
              amountTo={amountTo}
              slippage={slippage}
            />
          )}
        </AnimatePresence>

        {/* Action button */}
        <div className="px-4 pb-5">
          {!connected ? (
            <div className="w-full [&>button]:!w-full [&>button]:!justify-center [&>button]:!h-14 [&>button]:!rounded-xl [&>button]:!text-base">
              <WalletMultiButton />
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleSwap}
              disabled={!hasAmount || isSwapping}
              className={`w-full h-14 rounded-xl font-semibold text-base transition-all duration-300 flex items-center justify-center gap-2
                ${
                  hasAmount && !isSwapping
                    ? "bg-gradient-to-r from-accent to-emerald-500 text-black hover:shadow-lg hover:shadow-accent/20"
                    : "bg-surface-raised text-dark-500 cursor-not-allowed"
                }`}
            >
              {isSwapping ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Swapping...
                </>
              ) : !hasAmount ? (
                "Enter an amount"
              ) : (
                "Swap"
              )}
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Token select modal */}
      <AnimatePresence>
        {selectingFor && (
          <TokenSelectModal
            onSelect={handleTokenSelect}
            onClose={() => setSelectingFor(null)}
            selectedMint={selectingFor === "from" ? tokenFrom.mint : tokenTo.mint}
          />
        )}
      </AnimatePresence>
    </>
  );
}
