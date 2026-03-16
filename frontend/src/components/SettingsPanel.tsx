"use client";

import { motion } from "framer-motion";

interface SettingsPanelProps {
  slippage: number;
  onSlippageChange: (value: number) => void;
  onClose: () => void;
}

const SLIPPAGE_PRESETS = [
  { label: "0.1%", value: 10 },
  { label: "0.5%", value: 50 },
  { label: "1.0%", value: 100 },
];

export function SettingsPanel({ slippage, onSlippageChange, onClose }: SettingsPanelProps) {
  const customValue = SLIPPAGE_PRESETS.some((p) => p.value === slippage)
    ? ""
    : (slippage / 100).toString();

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="mx-4 mb-3 rounded-xl bg-surface-raised/60 border border-surface-border/40 p-4">
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
              onClick={() => onSlippageChange(preset.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
                ${slippage === preset.value
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
              value={customValue}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0 && val <= 50) {
                  onSlippageChange(Math.round(val * 100));
                }
              }}
              className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-surface-overlay/50 border border-surface-border/50 text-white outline-none focus:border-accent/30 transition-colors text-center placeholder:text-dark-500"
            />
            {customValue && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dark-500">%</span>
            )}
          </div>
        </div>

        {slippage > 100 && (
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
    </motion.div>
  );
}
