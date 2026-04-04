"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { PoolRegistryEntry } from "@/types";
import { POOL_REGISTRY } from "@/constants";
import { isValidAmmPool } from "@/lib/amm/pool";
import { TokenLogo } from "./TokenLogo";

interface TokenSelectModalProps {
  onSelect: (entry: PoolRegistryEntry) => void;
  onClose: () => void;
  selectedPoolId: string | null;
}

/**
 * Pool/token selection modal.
 *
 * - Shows configured markets as a list (logo, symbol, name)
 * - Supports pasting a raw pool address to load any AMM pool
 * - Validates pasted addresses on-chain before allowing selection
 */
export function TokenSelectModal({
  onSelect,
  onClose,
  selectedPoolId,
}: TokenSelectModalProps) {
  const { connection } = useConnection();
  const [search, setSearch] = useState("");
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Filter registry entries by search
  const filteredEntries = POOL_REGISTRY.filter(
    (entry) =>
      entry.symbol.toLowerCase().includes(search.toLowerCase()) ||
      entry.name.toLowerCase().includes(search.toLowerCase()) ||
      entry.poolId.toLowerCase().includes(search.toLowerCase())
  );

  // Check if the search input looks like a pubkey
  const isPubkeySearch = search.length >= 32 && search.length <= 44;
  const isRegistryMatch = filteredEntries.some(
    (e) => e.poolId === search
  );

  // Handle pasting a pool address
  const handlePastedAddress = async () => {
    if (!isPubkeySearch || isRegistryMatch) return;

    setPasteLoading(true);
    setPasteError(null);

    try {
      const pubkey = new PublicKey(search);
      const valid = await isValidAmmPool(connection, pubkey);
      if (valid) {
        onSelect({
          poolId: search,
          symbol: "???",
          name: `Custom Pool`,
          coinMint: "",
        });
      } else {
        setPasteError("Not a valid AMM pool address");
      }
    } catch {
      setPasteError("Invalid address format");
    } finally {
      setPasteLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-surface border border-surface-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h3 className="text-lg font-semibold">Select market</h3>
            <p className="text-xs text-dark-500 mt-1">Choose a configured pool or paste a pool address from your AMM.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-raised transition-colors text-dark-400 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search / paste address */}
        <div className="px-5 pb-3">
          <div className="relative">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search market or paste pool address"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPasteError(null);
              }}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-raised border border-surface-border text-sm outline-none focus:border-accent/30 placeholder:text-dark-500 transition-colors"
            />
          </div>

          {/* Paste-address action */}
          {isPubkeySearch && !isRegistryMatch && (
            <div className="mt-2">
              <button
                onClick={handlePastedAddress}
                disabled={pasteLoading}
                className="w-full py-2 rounded-lg text-xs font-medium bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all duration-200 disabled:opacity-50"
              >
                {pasteLoading ? "Validating..." : "Load market from address"}
              </button>
              {pasteError && (
                <p className="mt-1.5 text-xs text-red-400">{pasteError}</p>
              )}
            </div>
          )}
        </div>

        {/* Popular chips */}
        <div className="px-5 pb-3 flex gap-2 flex-wrap">
          {POOL_REGISTRY.slice(0, 4).map((entry) => (
            <button
              key={entry.poolId}
              onClick={() => onSelect(entry)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-200
                ${entry.poolId === selectedPoolId
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-surface-raised border-surface-border text-dark-300 hover:border-accent/20 hover:text-white"
                }`}
            >
              {entry.logoURI && (
                <TokenLogo
                  src={entry.logoURI}
                  alt={entry.symbol}
                  size={18}
                  className="rounded-full"
                />
              )}
              {entry.symbol}
            </button>
          ))}
        </div>

        <div className="border-t border-surface-border/50" />

        {/* Pool list */}
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filteredEntries.length === 0 && !isPubkeySearch ? (
            <div className="py-12 text-center text-dark-500 text-sm">
              {POOL_REGISTRY.length === 0
                ? "No markets configured. Paste a devnet pool address above."
                : "No tokens found"}
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <button
                key={entry.poolId}
                onClick={() => onSelect(entry)}
                className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-raised/80 transition-all duration-150
                  ${entry.poolId === selectedPoolId ? "bg-accent/5" : ""}`}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-border flex-shrink-0">
                  {entry.logoURI ? (
                    <TokenLogo
                      src={entry.logoURI}
                      alt={entry.symbol}
                      size={36}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dark-500 text-xs font-bold">
                      ?
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">{entry.symbol}</div>
                  <div className="text-xs text-dark-500">{entry.name}</div>
                </div>
                <div className="text-xs text-dark-500 font-mono max-w-[80px] truncate">
                  {entry.poolId.slice(0, 4)}...{entry.poolId.slice(-4)}
                </div>
                {entry.poolId === selectedPoolId && (
                  <div className="w-2 h-2 rounded-full bg-accent" />
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
