"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
  DEFAULT_SLIPPAGE_BPS,
} from "@/constants";
import { SwapSettings } from "@/types";
import { useProgramPools } from "@/hooks/useProgramPools";
import { SwapCard } from "./SwapCard";
import { LiquidityCard } from "./LiquidityCard";
import { PositionsCard } from "./PositionsCard";

type AppTab = "swap" | "liquidity" | "positions";

const TAB_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: "swap", label: "Swap" },
  { id: "liquidity", label: "Deposit/Create" },
  { id: "positions", label: "Positions" },
];

function loadSettings(): SwapSettings {
  if (typeof window === "undefined") {
    return {
      slippageBps: DEFAULT_SLIPPAGE_BPS,
      speedMicroLamports: DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
      frontRunningProtection: false,
    };
  }

  try {
    const raw = localStorage.getItem("swap-settings");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SwapSettings>;
      return {
        slippageBps: parsed.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
        speedMicroLamports: parsed.speedMicroLamports ?? DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
        frontRunningProtection: parsed.frontRunningProtection ?? false,
      };
    }
  } catch {
    return {
      slippageBps: DEFAULT_SLIPPAGE_BPS,
      speedMicroLamports: DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
      frontRunningProtection: false,
    };
  }

  return {
    slippageBps: DEFAULT_SLIPPAGE_BPS,
    speedMicroLamports: DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
    frontRunningProtection: false,
  };
}

export function TradingTerminal() {
  const [activeTab, setActiveTab] = useState<AppTab>("swap");
  const [settings, setSettings] = useState<SwapSettings>(loadSettings);
  const { pools, tokens, loading, error, refetch } = useProgramPools();

  useEffect(() => {
    try {
      localStorage.setItem("swap-settings", JSON.stringify(settings));
    } catch {
      // ignore localStorage write failures
    }
  }, [settings]);

  return (
    <div className="w-full max-w-[540px] animate-slide-up">
      <div className="mb-4 flex rounded-2xl border border-surface-border/50 bg-surface/60 p-1.5 backdrop-blur-xl">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.id ? "text-white" : "text-dark-400 hover:text-white"
            }`}
          >
            {activeTab === tab.id && (
              <motion.span
                layoutId="terminal-tab"
                className="absolute inset-0 rounded-xl bg-surface-raised/90"
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "swap" && (
        <SwapCard
          pools={pools}
          tokens={tokens}
          loading={loading}
          error={error}
          settings={settings}
          onSettingsChange={setSettings}
        />
      )}

      {activeTab === "liquidity" && (
        <LiquidityCard
          pools={pools}
          tokens={tokens}
          loading={loading}
          error={error}
          settings={settings}
          onSettingsChange={setSettings}
          onPoolsRefresh={refetch}
        />
      )}

      {activeTab === "positions" && (
        <PositionsCard pools={pools} loading={loading} />
      )}
    </div>
  );
}
