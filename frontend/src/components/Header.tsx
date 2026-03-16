"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";

export function Header() {
  const { connected } = useWallet();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-surface-border/50 backdrop-blur-xl bg-dark-950/80"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16V4m0 0L3 8m4-4l4 4" />
              <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">
            AMM<span className="text-accent">Swap</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink active>Swap</NavLink>
          <NavLink>Pools</NavLink>
          <NavLink>Portfolio</NavLink>
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          {connected && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-dim border border-accent/20">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-medium text-accent">Connected</span>
            </div>
          )}
          <WalletMultiButton />
        </div>
      </div>
    </motion.header>
  );
}

function NavLink({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${active
          ? "text-white bg-surface-raised"
          : "text-dark-400 hover:text-white hover:bg-surface-raised/50"
        }`}
    >
      {children}
    </button>
  );
}
