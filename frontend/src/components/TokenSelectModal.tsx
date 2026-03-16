"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Token } from "@/types";
import { POPULAR_TOKENS } from "@/constants";

interface TokenSelectModalProps {
  onSelect: (token: Token) => void;
  onClose: () => void;
  selectedMint: string;
}

export function TokenSelectModal({ onSelect, onClose, selectedMint }: TokenSelectModalProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredTokens = POPULAR_TOKENS.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.mint.toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

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
          <h3 className="text-lg font-semibold">Select Token</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-raised transition-colors text-dark-400 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
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
              placeholder="Search by name or paste address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-raised border border-surface-border text-sm outline-none focus:border-accent/30 placeholder:text-dark-500 transition-colors"
            />
          </div>
        </div>

        {/* Popular chips */}
        <div className="px-5 pb-3 flex gap-2 flex-wrap">
          {POPULAR_TOKENS.slice(0, 4).map((token) => (
            <button
              key={token.mint}
              onClick={() => onSelect(token)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-200
                ${token.mint === selectedMint
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-surface-raised border-surface-border text-dark-300 hover:border-accent/20 hover:text-white"
                }`}
            >
              <Image
                src={token.logoURI}
                alt={token.symbol}
                width={18}
                height={18}
                className="rounded-full"
              />
              {token.symbol}
            </button>
          ))}
        </div>

        <div className="border-t border-surface-border/50" />

        {/* Token List */}
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filteredTokens.length === 0 ? (
            <div className="py-12 text-center text-dark-500 text-sm">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token, i) => (
              <motion.button
                key={token.mint}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onSelect(token)}
                className={`w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-raised/80 transition-all duration-150
                  ${token.mint === selectedMint ? "bg-accent/5" : ""}`}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-border flex-shrink-0">
                  <Image
                    src={token.logoURI}
                    alt={token.symbol}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">{token.symbol}</div>
                  <div className="text-xs text-dark-500">{token.name}</div>
                </div>
                {token.balance !== undefined && (
                  <div className="text-right">
                    <div className="text-sm font-mono">{token.balance.toFixed(4)}</div>
                    {token.usdPrice && (
                      <div className="text-xs text-dark-500">
                        ${(token.balance * token.usdPrice).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
                {token.mint === selectedMint && (
                  <div className="w-2 h-2 rounded-full bg-accent" />
                )}
              </motion.button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
