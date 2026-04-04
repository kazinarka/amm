"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { shortenAddress } from "@/constants";

interface WalletButtonProps {
  fullWidth?: boolean;
  className?: string;
}

export function WalletButton({ fullWidth = false, className = "" }: WalletButtonProps) {
  const {
    wallets,
    wallet,
    connected,
    connecting,
    disconnecting,
    publicKey,
    select,
    connect,
    disconnect,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const availableWallets = useMemo(() => {
    const seen = new Set<string>();

    return wallets.filter(({ adapter, readyState }) => {
      if (readyState === WalletReadyState.Unsupported) return false;
      if (seen.has(adapter.name)) return false;
      seen.add(adapter.name);
      return true;
    });
  }, [wallets]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!pendingWalletName || connected || connecting || wallet?.adapter.name !== pendingWalletName) {
      return;
    }

    void connect().finally(() => setPendingWalletName(null));
  }, [connect, connected, connecting, pendingWalletName, wallet]);

  const buttonClassName = [
    "inline-flex items-center justify-center rounded-xl border border-surface-border/60 bg-surface-raised/70 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-accent/40 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60",
    fullWidth ? "w-full min-h-14 text-base" : "min-w-[168px]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const statusLabel = connecting
    ? "Connecting..."
    : disconnecting
      ? "Disconnecting..."
      : connected && publicKey
        ? shortenAddress(publicKey.toBase58())
        : "Connect wallet";

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={() => {
          if (connected) {
            void disconnect();
            return;
          }
          setOpen((value) => !value);
        }}
        disabled={connecting || disconnecting}
        className={buttonClassName}
      >
        {statusLabel}
      </button>

      {!connected && open && (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-full min-w-[260px] overflow-hidden rounded-2xl border border-surface-border bg-surface/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="px-2 py-2 text-xs uppercase tracking-[0.18em] text-dark-500">
            Choose wallet
          </div>
          <div className="space-y-1">
            {availableWallets.map(({ adapter, readyState }) => (
              <button
                key={adapter.name}
                type="button"
                onClick={() => {
                  select(adapter.name);
                  setPendingWalletName(adapter.name);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-surface-raised"
              >
                <span>{adapter.name}</span>
                <span className="text-xs text-dark-500">
                  {readyState === WalletReadyState.Installed ? "Installed" : "Available"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}