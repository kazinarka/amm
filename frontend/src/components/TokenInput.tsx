"use client";

import { Token } from "@/types";
import Image from "next/image";

interface TokenInputProps {
  label: string;
  token: Token;
  amount: string;
  onAmountChange: (value: string) => void;
  onTokenSelect: () => void;
  readOnly?: boolean;
  showBalance?: boolean;
}

export function TokenInput({
  label,
  token,
  amount,
  onAmountChange,
  onTokenSelect,
  readOnly = false,
  showBalance = false,
}: TokenInputProps) {
  const usdValue = amount && token.usdPrice
    ? (parseFloat(amount) * token.usdPrice).toFixed(2)
    : null;

  return (
    <div className="rounded-xl bg-surface-raised/80 border border-surface-border/50 p-4 transition-all duration-200 hover:border-surface-border focus-within:border-accent/30 focus-within:bg-surface-raised">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-dark-400 uppercase tracking-wide">
          {label}
        </span>
        {showBalance && (
          <button
            className="text-xs text-dark-400 hover:text-accent transition-colors flex items-center gap-1"
            onClick={() => token.balance && onAmountChange(token.balance.toString())}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12V7H5a2 2 0 010-4h14v4" />
              <path d="M3 5v14a2 2 0 002 2h16v-5" />
              <path d="M18 12a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            {token.balance?.toFixed(4) ?? "0.00"}
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
            if (/^[0-9]*\.?[0-9]*$/.test(val)) {
              onAmountChange(val);
            }
          }}
          readOnly={readOnly}
          className={`flex-1 bg-transparent text-2xl sm:text-3xl font-semibold outline-none placeholder:text-dark-600/50 min-w-0
            ${readOnly ? "text-dark-300 cursor-default" : "text-white"}`}
        />

        <button
          onClick={onTokenSelect}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-overlay/80 border border-surface-border hover:border-accent/40 hover:bg-surface-overlay transition-all duration-200 shrink-0 group"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-surface-border flex-shrink-0">
            <Image
              src={token.logoURI}
              alt={token.symbol}
              width={24}
              height={24}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-semibold text-sm">{token.symbol}</span>
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
        </button>
      </div>

      {usdValue && (
        <div className="mt-1.5 text-xs text-dark-500">
          ≈ ${usdValue}
        </div>
      )}
    </div>
  );
}
