"use client";

import { TokenLogo } from "./TokenLogo";

// Hoisted regex — avoids allocating a new RegExp on every keystroke.
const DECIMAL_PATTERN = /^[0-9]*\.?[0-9]*$/;

interface TokenInputProps {
  label: string;
  symbol: string;
  logoURI: string;
  balance: string;         // formatted balance string (e.g. "1.2345")
  amount: string;
  onAmountChange: (value: string) => void;
  onTokenClick?: () => void;
  readOnly?: boolean;
  showBalance?: boolean;
  tokenClickable?: boolean; // whether clicking the token opens a selector
}

/**
 * Token amount input field.
 *
 * Simplified from the original — accepts display strings directly instead
 * of a Token object, making it usable in the Buy/Sell tab model where
 * one side is always SOL and the other is the pool token.
 */
export function TokenInput({
  label,
  symbol,
  logoURI,
  balance,
  amount,
  onAmountChange,
  onTokenClick,
  readOnly = false,
  showBalance = false,
  tokenClickable = false,
}: TokenInputProps) {
  return (
    <div className="rounded-xl bg-surface-raised/80 border border-surface-border/50 p-4 transition-all duration-200 hover:border-surface-border focus-within:border-accent/30 focus-within:bg-surface-raised">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-dark-400 uppercase tracking-wide">
          {label}
        </span>
        {showBalance && (
          <button
            className="text-xs text-dark-400 hover:text-accent transition-colors flex items-center gap-1"
            onClick={() => {
              if (balance && balance !== "0" && !readOnly) {
                onAmountChange(balance);
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12V7H5a2 2 0 010-4h14v4" />
              <path d="M3 5v14a2 2 0 002 2h16v-5" />
              <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            {balance || "0.00"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;
            if (DECIMAL_PATTERN.test(val)) {
              onAmountChange(val);
            }
          }}
          readOnly={readOnly}
          className={`flex-1 bg-transparent text-2xl sm:text-3xl font-semibold outline-none placeholder:text-dark-600/50 min-w-0
            ${readOnly ? "text-dark-300 cursor-default" : "text-white"}`}
        />

        <button
          onClick={tokenClickable ? onTokenClick : undefined}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-all duration-200
            ${
              tokenClickable
                ? "bg-surface-overlay/80 border-surface-border hover:border-accent/40 hover:bg-surface-overlay cursor-pointer group"
                : "bg-surface-overlay/60 border-surface-border/50 cursor-default"
            }`}
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-surface-border flex-shrink-0">
            <TokenLogo
              src={logoURI}
              alt={symbol}
              size={24}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-semibold text-sm">{symbol}</span>
          {tokenClickable && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-dark-400 group-hover:text-accent transition-colors"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
