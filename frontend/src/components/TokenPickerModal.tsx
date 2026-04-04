"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { TokenOption } from "@/types";
import { NETWORK, SOL_MINT } from "@/constants";
import { TokenLogo } from "./TokenLogo";

interface TokenPickerModalProps {
  title: string;
  tokens: TokenOption[];
  selectedMint: string | null;
  open: boolean;
  onSelect: (token: TokenOption) => void;
  onClose: () => void;
}

/** Memoised token row — only re-renders when its own props change. */
const TokenRow = memo(function TokenRow({
  token,
  selected,
  onSelect,
}: {
  token: TokenOption;
  selected: boolean;
  onSelect: (token: TokenOption) => void;
}) {
  return (
    <button
      onClick={() => onSelect(token)}
      className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-raised/80 ${
        selected ? "bg-accent/5" : ""
      }`}
    >
      <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-border">
        <TokenLogo src={token.logoURI} alt={token.symbol} size={40} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{token.symbol}</div>
        <div className="truncate text-xs text-dark-500">{token.name}</div>
      </div>
      <div className="text-xs font-mono text-dark-500">
        {token.mint.slice(0, 4)}...{token.mint.slice(-4)}
      </div>
    </button>
  );
});

export function TokenPickerModal({
  title,
  tokens,
  selectedMint,
  open,
  onSelect,
  onClose,
}: TokenPickerModalProps) {
  const { connection } = useConnection();
  const [search, setSearch] = useState("");
  const [customMintError, setCustomMintError] = useState<string | null>(null);
  const [resolvingCustomMint, setResolvingCustomMint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track whether the modal has ever been opened so we don't render the
  // token list until the first open (lazy mount).
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    if (open) {
      setEverOpened(true);
      setSearch("");
      setCustomMintError(null);
      // Delay focus slightly so the CSS transition can start first.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return tokens;
    return tokens.filter((token) =>
      [token.symbol, token.name, token.mint].some((part) => part.toLowerCase().includes(value))
    );
  }, [search, tokens]);

  const trimmedSearch = useMemo(() => search.trim(), [search]);

  const canResolveCustomMint = useMemo(() => {
    if (!trimmedSearch || trimmedSearch === SOL_MINT) return false;
    try {
      const mint = new PublicKey(trimmedSearch).toBase58();
      return !tokens.some((token) => token.mint === mint);
    } catch {
      return false;
    }
  }, [tokens, trimmedSearch]);

  function shortMint(mint: string) {
    return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  }

  async function handleUseCustomMint() {
    try {
      setResolvingCustomMint(true);
      setCustomMintError(null);

      const mintAddress = new PublicKey(trimmedSearch);
      const mintInfo = await getMint(connection, mintAddress, "confirmed");

      onSelect({
        mint: mintAddress.toBase58(),
        decimals: mintInfo.decimals,
        isNative: mintAddress.toBase58() === SOL_MINT,
        symbol: shortMint(mintAddress.toBase58()),
        name: `Custom token (${NETWORK})`,
        logoURI: "",
      });
    } catch {
      setCustomMintError(`This mint is not a valid SPL token on ${NETWORK}. Paste a real ${NETWORK} mint address.`);
    } finally {
      setResolvingCustomMint(false);
    }
  }

  // Don't render anything until the modal has been opened at least once.
  if (!everOpened) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-150 ${
        open
          ? "visible opacity-100"
          : "invisible opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        onClick={(event) => event.stopPropagation()}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-2xl shadow-black/40 transition-all duration-150 ${
          open
            ? "scale-100 translate-y-0 opacity-100"
            : "scale-[0.96] translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-xs text-dark-500">Choose from discovered pool tokens and a broader curated Solana token catalog.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-dark-400 transition-colors hover:bg-surface-raised hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search symbol, name, or mint"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-sm outline-none transition-colors placeholder:text-dark-500 focus:border-accent/40"
          />
          {canResolveCustomMint && (
            <button
              onClick={handleUseCustomMint}
              disabled={resolvingCustomMint}
              className="mt-3 w-full rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-left text-sm text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resolvingCustomMint ? "Resolving mint..." : `Use custom ${NETWORK} mint ${shortMint(trimmedSearch)}`}
            </button>
          )}
          {customMintError && (
            <div className="mt-3 rounded-xl bg-red-dim px-3 py-2 text-xs text-red-300">
              {customMintError}
            </div>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-dark-500">No tokens match your search.</div>
          ) : (
            filtered.map((token) => (
              <TokenRow
                key={token.mint}
                token={token}
                selected={token.mint === selectedMint}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
