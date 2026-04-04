"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { DiscoveredAmmPool, SwapSettings, TokenOption } from "@/types";
import { getSolscanUrl, shortenAddress } from "@/constants";
import {
  findPoolById,
  findPoolsForPair,
  formatPoolLabel,
  sortPoolsByPriority,
} from "@/lib/amm/discovery";
import { formatTokenAmount } from "@/lib/amm/quote";
import { useAmmPool } from "@/hooks/useAmmPool";
import { useMintBalance } from "@/hooks/useMintBalance";
import { useSwapQuote } from "@/hooks/useSwapQuote";
import { useSwapTransaction } from "@/hooks/useSwapTransaction";
import { SettingsPanel } from "./SettingsPanel";
import { TokenInput } from "./TokenInput";
import { SwapDetails } from "./SwapDetails";
import { TokenPickerModal } from "./TokenPickerModal";
import { PoolPickerModal } from "./PoolPickerModal";
import { WalletButton } from "./WalletButton";

interface SwapCardProps {
  pools: DiscoveredAmmPool[];
  tokens: TokenOption[];
  loading: boolean;
  error: string | null;
  settings: SwapSettings;
  onSettingsChange: (settings: SwapSettings) => void;
}

type PickerMode = "sell" | "buy" | null;
type QuickPreset = { label: string; value?: string; percent?: number };

function quickAmountPresets(token: TokenOption | null) {
  if (!token) return [] as QuickPreset[];
  if (token.isNative) {
    return [
      { label: "0.1", value: "0.1" },
      { label: "0.5", value: "0.5" },
      { label: "1", value: "1" },
      { label: "2", value: "2" },
    ];
  }

  return [
    { label: "25%", percent: 25 },
    { label: "50%", percent: 50 },
    { label: "75%", percent: 75 },
    { label: "100%", percent: 100 },
  ];
}

const FALLBACK_LOGO = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

const STATUS_LABELS: Record<string, string> = {
  building: "Building transaction...",
  signing: "Waiting for signature...",
  sending: "Sending transaction...",
  confirming: "Confirming...",
};

// Stable no-op so the read-only Buy input doesn't get a new function reference
// on every render (which would defeat React.memo on TokenInput).
const NOOP = () => {};

// ─── Callbacks passed from the outer shell into the memoised body ───
interface SwapCardBodyProps {
  pools: DiscoveredAmmPool[];
  tokens: TokenOption[];
  loading: boolean;
  error: string | null;
  settings: SwapSettings;
  onSettingsChange: (settings: SwapSettings) => void;
  onOpenSellPicker: () => void;
  onOpenBuyPicker: () => void;
  onOpenPoolPicker: () => void;
  onSwitchTokens: () => void;
  // Expose state the outer shell needs for modals
  onSellMintChange: (mint: string | null) => void;
  onBuyMintChange: (mint: string | null) => void;
  sellMint: string | null;
  buyMint: string | null;
  matchingPools: DiscoveredAmmPool[];
  selectedPoolId: string | null;
  onSelectedPoolIdChange: (id: string | null) => void;
}

/**
 * The heavy inner body of SwapCard.
 * Wrapped in React.memo so it does NOT re-render when pickerMode /
 * showPoolPicker change in the outer shell — those only affect modals.
 */
const SwapCardBody = memo(function SwapCardBody({
  pools,
  tokens,
  loading,
  error,
  settings,
  onSettingsChange,
  onOpenSellPicker,
  onOpenBuyPicker,
  onOpenPoolPicker,
  onSwitchTokens,
  sellMint,
  buyMint,
  matchingPools,
  selectedPoolId,
}: SwapCardBodyProps) {
  const { connected } = useWallet();
  const [inputAmount, setInputAmount] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const selectedPool = useMemo(() => findPoolById(pools, selectedPoolId), [pools, selectedPoolId]);
  const sellToken = useMemo(
    () => tokens.find((token) => token.mint === sellMint) ?? null,
    [sellMint, tokens]
  );
  const buyToken = useMemo(
    () => tokens.find((token) => token.mint === buyMint) ?? null,
    [buyMint, tokens]
  );

  const { pool, loading: poolLoading, error: poolError } = useAmmPool(selectedPoolId);
  const quote = useSwapQuote({
    pool,
    inputMint: sellMint,
    outputMint: buyMint,
    inputAmountHuman: inputAmount,
    slippageBps: settings.slippageBps,
  });

  const { balance: sellBalance } = useMintBalance(sellMint, refreshTick);
  const { balance: buyBalance } = useMintBalance(buyMint, refreshTick);

  const onSwapSuccess = useCallback(() => {
    setInputAmount("");
    setRefreshTick((tick) => tick + 1);
  }, []);

  const { swapStatus, executeSwap, resetStatus } = useSwapTransaction({
    pool,
    quote,
    inputMint: sellMint,
    outputMint: buyMint,
    settings,
    onSuccess: onSwapSuccess,
  });

  const hasAmount = inputAmount !== "" && inputAmount !== "." && inputAmount !== "0";
  const outputAmount = quote && buyToken ? formatTokenAmount(quote.amountOut, buyToken.decimals) : "";
  const sellBalanceFormatted = sellToken ? formatTokenAmount(sellBalance, sellToken.decimals) : "0";
  const buyBalanceFormatted = buyToken ? formatTokenAmount(buyBalance, buyToken.decimals) : "0";
  const unavailablePair = Boolean(sellMint && buyMint && sellMint !== buyMint && matchingPools.length === 0);
  const processing = ["building", "signing", "sending", "confirming"].includes(swapStatus.status);

  const handleSwitchTokens = useCallback(() => {
    setInputAmount("");
    resetStatus();
    onSwitchTokens();
  }, [onSwitchTokens, resetStatus]);

  const handleAmountChange = useCallback(
    (value: string) => {
      setInputAmount(value);
      resetStatus();
    },
    [resetStatus]
  );

  const handleCloseSettings = useCallback(() => setShowSettings(false), []);

  const presets = useMemo(() => quickAmountPresets(sellToken), [sellToken]);

  const applyQuickAmount = useCallback(
    (preset: { value?: string; percent?: number }) => {
      if (preset.value) {
        setInputAmount(preset.value);
        return;
      }

      if (!sellToken || preset.percent === undefined) return;
      const amount = (sellBalance * BigInt(preset.percent)) / 100n;
      setInputAmount(formatTokenAmount(amount, sellToken.decimals));
    },
    [sellToken, sellBalance]
  );

  return (
    <div
      className="overflow-hidden rounded-2xl border border-surface-border bg-surface/90 shadow-2xl shadow-black/20 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <div>
          <h2 className="text-lg font-semibold">Swap</h2>
          <p className="mt-1 text-xs text-dark-500">Choose the token pair first, then the matching liquidity pool.</p>
        </div>
        <button
          onClick={() => setShowSettings((value) => !value)}
          className="rounded-xl p-2 transition-colors hover:bg-surface-raised"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-dark-400">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onSettingsChange={onSettingsChange}
            onClose={handleCloseSettings}
          />
        )}
      </AnimatePresence>

      <div className="space-y-4 px-4 pb-4">
        <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Selected pool</div>
              <div className="mt-1 text-sm font-semibold">{selectedPool ? formatPoolLabel(selectedPool) : "Choose a tradable pair"}</div>
            </div>
            <button
              disabled={matchingPools.length <= 1}
              onClick={onOpenPoolPicker}
              className="rounded-lg border border-surface-border/60 px-3 py-1.5 text-xs font-medium text-dark-300 transition-colors hover:border-accent/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {matchingPools.length > 1 ? `${matchingPools.length} pools` : "1 pool"}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-dark-500">
            <span>{selectedPool ? `AMM ${shortenAddress(selectedPool.poolId)}` : "No pool chosen"}</span>
            {selectedPool && <span>Market ID {shortenAddress(selectedPool.marketId)}</span>}
          </div>
        </div>

        <div className="space-y-2">
          <TokenInput
            label="Sell"
            symbol={sellToken?.symbol ?? "Select"}
            logoURI={sellToken?.logoURI ?? FALLBACK_LOGO}
            balance={sellBalanceFormatted}
            amount={inputAmount}
            onAmountChange={handleAmountChange}
            onTokenClick={onOpenSellPicker}
            tokenClickable
            showBalance
          />

          <div className="flex items-center justify-center">
            <button
              onClick={handleSwitchTokens}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface-raised text-dark-300 transition-colors hover:border-accent/40 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M8 7h12" />
                <path d="M16 3l4 4-4 4" />
                <path d="M16 17H4" />
                <path d="M8 21l-4-4 4-4" />
              </svg>
            </button>
          </div>

          <TokenInput
            label="Buy"
            symbol={buyToken?.symbol ?? "Select"}
            logoURI={buyToken?.logoURI ?? FALLBACK_LOGO}
            balance={buyBalanceFormatted}
            amount={outputAmount}
            onAmountChange={NOOP}
            onTokenClick={onOpenBuyPicker}
            tokenClickable
            readOnly
            showBalance
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyQuickAmount(preset)}
              className="rounded-lg border border-surface-border/50 bg-surface-raised px-3 py-2 text-xs font-medium text-dark-300 transition-colors hover:border-accent/40 hover:text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {quote && hasAmount && sellToken && buyToken && (
            <SwapDetails
              quote={quote}
              inputSymbol={sellToken.symbol}
              outputSymbol={buyToken.symbol}
              outputDecimals={buyToken.decimals}
              feeDecimals={sellToken.decimals}
              slippageBps={settings.slippageBps}
            />
          )}
        </AnimatePresence>

        {(loading || poolLoading) && (
          <div className="rounded-xl bg-surface-raised/50 px-3 py-3 text-center text-xs text-dark-500">Loading available pools...</div>
        )}

        {(error || poolError) && (
          <div className="rounded-xl bg-red-dim px-3 py-3 text-center text-xs text-red-300">{error || poolError}</div>
        )}

        {unavailablePair && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-3 text-xs text-yellow-200">
            No liquidity pool currently supports this token pair. Pick a different pair or create a new pool.
          </div>
        )}

        {swapStatus.status === "error" && (
          <div className="rounded-xl bg-red-dim px-3 py-3 text-center text-xs text-red-300">{swapStatus.error}</div>
        )}

        <div>
          {!connected ? (
            <WalletButton fullWidth />
          ) : swapStatus.status === "confirmed" ? (
            <div className="space-y-2">
              <button
                onClick={resetStatus}
                className="flex h-14 w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-base font-semibold text-accent"
              >
                ✓ Trade placed
              </button>
              <a
                href={getSolscanUrl(swapStatus.signature)}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-accent hover:underline"
              >
                View on Solscan →
              </a>
            </div>
          ) : (
            <button
              onClick={executeSwap}
              disabled={!hasAmount || processing || unavailablePair || !pool || !sellToken || !buyToken}
              className={`flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold transition-all ${
                !hasAmount || processing || unavailablePair || !pool || !sellToken || !buyToken
                  ? "cursor-not-allowed bg-surface-raised text-dark-500"
                  : "bg-gradient-to-r from-accent to-amber-500 text-black hover:shadow-lg hover:shadow-accent/20"
              }`}
            >
              {processing
                ? STATUS_LABELS[swapStatus.status] || "Processing..."
                : !hasAmount
                  ? "Enter an amount"
                  : unavailablePair
                    ? "No pool for pair"
                    : !pool
                      ? "Loading pool"
                      : `Swap ${sellToken?.symbol ?? "token"} for ${buyToken?.symbol ?? "token"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Outer shell: owns ONLY modal state ─────────────────────────────
export function SwapCard({
  pools,
  tokens,
  loading,
  error,
  settings,
  onSettingsChange,
}: SwapCardProps) {
  const [sellMint, setSellMint] = useState<string | null>(null);
  const [buyMint, setBuyMint] = useState<string | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const pickerModeRef = useRef<PickerMode>(null);
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const pairInitializedRef = useRef(false);

  useEffect(() => {
    if (pairInitializedRef.current) return;
    if (!sellMint && !buyMint && pools[0]) {
      setSellMint(pools[0].coinMint);
      setBuyMint(pools[0].pcMint);
      setSelectedPoolId(pools[0].poolId);
      pairInitializedRef.current = true;
    }
  }, [buyMint, pools, sellMint]);

  const matchingPools = useMemo(
    () => sortPoolsByPriority(findPoolsForPair(pools, sellMint, buyMint)),
    [buyMint, pools, sellMint]
  );

  useEffect(() => {
    if (!matchingPools.length) {
      setSelectedPoolId(null);
      return;
    }
    if (!selectedPoolId || !matchingPools.some((pool) => pool.poolId === selectedPoolId)) {
      setSelectedPoolId(matchingPools[0].poolId);
    }
  }, [matchingPools, selectedPoolId]);

  // Stable callbacks for the memoised body — these never change.
  const onOpenSellPicker = useCallback(() => {
    pickerModeRef.current = "sell";
    setPickerMode("sell");
  }, []);
  const onOpenBuyPicker = useCallback(() => {
    pickerModeRef.current = "buy";
    setPickerMode("buy");
  }, []);
  const onOpenPoolPicker = useCallback(() => setShowPoolPicker(true), []);
  // Use refs to read current mints so the callback identity is stable.
  const sellMintRef = useRef(sellMint);
  sellMintRef.current = sellMint;
  const buyMintRef = useRef(buyMint);
  buyMintRef.current = buyMint;
  const onSwitchTokens = useCallback(() => {
    const prevSell = sellMintRef.current;
    const prevBuy = buyMintRef.current;
    setSellMint(prevBuy);
    setBuyMint(prevSell);
  }, []);

  const handleSelectToken = useCallback((token: TokenOption) => {
    // Close the modal immediately so the CSS transition starts.
    const currentMode = pickerModeRef.current;
    setPickerMode(null);
    // Defer the mint update to the next frame so it doesn't block
    // the modal close animation with a heavy SwapCardBody re-render.
    requestAnimationFrame(() => {
      if (currentMode === "sell") setSellMint(token.mint);
      if (currentMode === "buy") setBuyMint(token.mint);
    });
  }, []);

  return (
    <>
      <SwapCardBody
        pools={pools}
        tokens={tokens}
        loading={loading}
        error={error}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onOpenSellPicker={onOpenSellPicker}
        onOpenBuyPicker={onOpenBuyPicker}
        onOpenPoolPicker={onOpenPoolPicker}
        onSwitchTokens={onSwitchTokens}
        onSellMintChange={setSellMint}
        onBuyMintChange={setBuyMint}
        sellMint={sellMint}
        buyMint={buyMint}
        matchingPools={matchingPools}
        selectedPoolId={selectedPoolId}
        onSelectedPoolIdChange={setSelectedPoolId}
      />

      <TokenPickerModal
        title={pickerMode === "sell" ? "Select sell token" : "Select buy token"}
        tokens={tokens}
        selectedMint={pickerMode === "sell" ? sellMint : buyMint}
        open={pickerMode !== null}
        onSelect={handleSelectToken}
        onClose={() => setPickerMode(null)}
      />

      <AnimatePresence>
        {showPoolPicker && (
          <PoolPickerModal
            pools={matchingPools}
            selectedPoolId={selectedPoolId}
            onSelect={(poolOption) => {
              setSelectedPoolId(poolOption.poolId);
              setShowPoolPicker(false);
            }}
            onClose={() => setShowPoolPicker(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
