"use client";

import { motion } from "framer-motion";
import { SwapSettings } from "@/types";

// Hoisted — avoids creating new objects on every render.
const COLLAPSE_INITIAL = { height: 0, opacity: 0 } as const;
const COLLAPSE_ANIMATE = { height: "auto", opacity: 1 } as const;
const COLLAPSE_EXIT = { height: 0, opacity: 0 } as const;
const COLLAPSE_TRANSITION = { duration: 0.2, ease: "easeOut" } as const;

interface SettingsPanelProps {
  settings: SwapSettings;
  onSettingsChange: (settings: SwapSettings) => void;
  onClose: () => void;
}

const SLIPPAGE_PRESETS = [
  { label: "0.1%", value: 10 },
  { label: "0.5%", value: 50 },
  { label: "1.0%", value: 100 },
];

const PRIORITY_FEE_PRESETS = [
  { label: "Normal", value: 100_000 },
  { label: "Fast", value: 500_000 },
  { label: "Turbo", value: 1_000_000 },
];

/**
 * Settings panel with slippage tolerance, speed presets, and protection controls.
 * Settings are passed as a SwapSettings object.
 */
export function SettingsPanel({ settings, onSettingsChange, onClose }: SettingsPanelProps) {
  const customSlippage = SLIPPAGE_PRESETS.some((p) => p.value === settings.slippageBps)
    ? ""
    : (settings.slippageBps / 100).toString();

  const microToSol = (micro: number) => (micro / 1_000_000_000).toFixed(6);

  return (
    <motion.div
      initial={COLLAPSE_INITIAL}
      animate={COLLAPSE_ANIMATE}
      exit={COLLAPSE_EXIT}
      transition={COLLAPSE_TRANSITION}
      className="overflow-hidden"
    >
      <div className="mx-4 mb-3 rounded-xl bg-surface-raised/60 border border-surface-border/40 p-4 space-y-4">
        {/* Slippage Tolerance */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Slippage Tolerance</span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-surface-overlay transition-colors text-dark-400 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex gap-2">
            {SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => onSettingsChange({ ...settings, slippageBps: preset.value })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
                  ${settings.slippageBps === preset.value
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-surface-overlay/50 border-surface-border/50 text-dark-400 hover:text-white hover:border-surface-border"
                  }`}
              >
                {preset.label}
              </button>
            ))}
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Custom"
                value={customSlippage}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0 && val <= 50) {
                    onSettingsChange({ ...settings, slippageBps: Math.round(val * 100) });
                  }
                }}
                className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-surface-overlay/50 border border-surface-border/50 text-white outline-none focus:border-accent/30 transition-colors text-center placeholder:text-dark-500"
              />
              {customSlippage && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-500">%</span>
              )}
            </div>
          </div>

          {settings.slippageBps > 100 && (
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-yellow-400">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              High slippage may result in an unfavorable trade
            </div>
          )}
        </div>

        {/* Speed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Speed</span>
            <span className="text-xs text-dark-500 font-mono">
              ≈ {microToSol(settings.speedMicroLamports)} SOL
            </span>
          </div>

          <div className="flex gap-2">
            {PRIORITY_FEE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() =>
                  onSettingsChange({ ...settings, speedMicroLamports: preset.value })
                }
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
                  ${settings.speedMicroLamports === preset.value
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-surface-overlay/50 border-surface-border/50 text-dark-400 hover:text-white hover:border-surface-border"
                  }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-surface-border/40 bg-surface-overlay/40 p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Front-running protection</div>
              <div className="mt-1 text-xs text-dark-500">
                Routes signing and submission through your protected RPC when configured.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onSettingsChange({
                  ...settings,
                  frontRunningProtection: !settings.frontRunningProtection,
                })
              }
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                settings.frontRunningProtection ? "bg-accent" : "bg-surface-border"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  settings.frontRunningProtection ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
