"use client";

import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { WalletButton } from "./WalletButton";

// Hoisted — avoids creating new objects on every render.
const HEADER_INITIAL = { y: -20, opacity: 0 } as const;
const HEADER_ANIMATE = { y: 0, opacity: 1 } as const;
const HEADER_TRANSITION = { duration: 0.4, ease: "easeOut" } as const;

export function Header() {
  const { connected } = useWallet();

  return (
    <motion.header
      initial={HEADER_INITIAL}
      animate={HEADER_ANIMATE}
      transition={HEADER_TRANSITION}
      className="sticky top-0 z-50 border-b border-surface-border/40 backdrop-blur-xl bg-dark-950/75"
    >
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 sm:h-16 sm:px-6 xl:px-8">
        {/* Logo */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6D94B] p-1 shadow-[0_10px_30px_rgba(246,217,75,0.22)] sm:h-11 sm:w-11 sm:p-1.5">
            <Image
              src="/bread-loaf-cutout.png"
              alt="bread.fun"
              width={579}
              height={328}
              priority
              className="h-auto w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">bread.fun</div>
          </div>
        </div>

        {/* Wallet */}
        <div className="flex items-center gap-2 sm:gap-3">
          {connected && (
            <div className="hidden items-center gap-2 rounded-lg border border-surface-border/50 bg-surface-raised/70 px-3 py-1.5 text-xs text-dark-400 sm:flex">
              <span className="text-accent">• wallet ready</span>
            </div>
          )}
          <WalletButton />
        </div>
      </div>
    </motion.header>
  );
}
