"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import toast from "react-hot-toast";
import {
  AMM_PROGRAM_ID,
  CREATE_POOL_FEE_DESTINATION,
  getSolscanUrl,
  shortenAddress,
} from "@/constants";
import {
  DiscoveredAmmPool,
  SwapSettings,
  TokenOption,
  TxStatus,
} from "@/types";
import {
  findPoolById,
  findPoolsForPair,
  formatPoolLabel,
  sortPoolsByPriority,
} from "@/lib/amm/discovery";
import { formatTokenAmount, parseHumanAmount } from "@/lib/amm/quote";
import { useAmmPool } from "@/hooks/useAmmPool";
import { useMintBalance } from "@/hooks/useMintBalance";
import {
  buildCreatePoolTransaction,
  buildDepositTransaction,
  buildWithdrawTransaction,
  getExecutionConnection,
  signSendAndConfirmTransaction,
} from "@/lib/transaction";
import { derivePoolAddresses, getAmmConfigAddress } from "@/lib/amm/pda";
import { parseSwapError } from "@/lib/amm/errors";
import { SettingsPanel } from "./SettingsPanel";
import { TokenPickerModal } from "./TokenPickerModal";
import { PoolPickerModal } from "./PoolPickerModal";
import { WalletButton } from "./WalletButton";

type LiquidityTab = "deposit" | "withdraw" | "create";
type PairPickerMode = "first" | "second" | "createFirst" | "createSecond" | null;

type DepositPreview = {
  coinAmount: bigint;
  pcAmount: bigint;
  mintedLp: bigint;
  baseSide: bigint;
};

type WithdrawPreview = {
  amount: bigint;
  coinAmount: bigint;
  pcAmount: bigint;
};

interface LiquidityCardProps {
  pools: DiscoveredAmmPool[];
  tokens: TokenOption[];
  loading: boolean;
  error: string | null;
  settings: SwapSettings;
  onSettingsChange: (settings: SwapSettings) => void;
  onPoolsRefresh: () => void;
}

function ceilDiv(a: bigint, b: bigint) {
  return (a + b - 1n) / b;
}

function nestedTabClass(active: boolean) {
  return `rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
    active ? "bg-surface-raised text-white" : "text-dark-400 hover:text-white"
  }`;
}

function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultOpenTimeValue() {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  date.setSeconds(0, 0);
  return formatDateTimeLocal(date);
}

function parseOpenTimeValue(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error("Choose a valid pool open date and time");
  }

  return BigInt(Math.floor(parsed / 1000));
}

export function LiquidityCard({
  pools,
  tokens,
  loading,
  error,
  settings,
  onSettingsChange,
  onPoolsRefresh,
}: LiquidityCardProps) {
  const { connection } = useConnection();
  const { connected, publicKey, signTransaction } = useWallet();

  const [activeTab, setActiveTab] = useState("deposit" as LiquidityTab);
  const [showSettings, setShowSettings] = useState(false);
  const [pickerMode, setPickerMode] = useState(null as PairPickerMode);
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  // useTransition marks modal-open state updates as non-urgent so React
  // can paint the current frame before re-rendering the heavy component body.
  const [, startTransition] = useTransition();
  const [firstMint, setFirstMint] = useState(null as string | null);
  const [secondMint, setSecondMint] = useState(null as string | null);
  const [selectedPoolId, setSelectedPoolId] = useState(null as string | null);
  const [baseMint, setBaseMint] = useState(null as string | null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [txStatus, setTxStatus] = useState({ status: "idle" } as TxStatus);
  const [refreshTick, setRefreshTick] = useState(0);

  const [createFirstMint, setCreateFirstMint] = useState(null as string | null);
  const [createSecondMint, setCreateSecondMint] = useState(null as string | null);
  const [createCoinAmount, setCreateCoinAmount] = useState("");
  const [createPcAmount, setCreatePcAmount] = useState("");
  const [openTimeInput, setOpenTimeInput] = useState(defaultOpenTimeValue);
  const pairInitializedRef = useRef(false);
  const createPairInitializedRef = useRef(false);

  useEffect(() => {
    if (pairInitializedRef.current) return;
    if (!firstMint && !secondMint && pools[0]) {
      setFirstMint(pools[0].coinMint);
      setSecondMint(pools[0].pcMint);
      setBaseMint(pools[0].coinMint);
      setSelectedPoolId(pools[0].poolId);
      pairInitializedRef.current = true;
    }
  }, [firstMint, pools, secondMint]);

  useEffect(() => {
    if (createPairInitializedRef.current) return;
    if (!createFirstMint && !createSecondMint && tokens[0] && tokens[1]) {
      setCreateFirstMint(tokens[0].mint);
      setCreateSecondMint(tokens[1].mint);
      createPairInitializedRef.current = true;
    }
  }, [createFirstMint, createSecondMint, tokens]);

  const matchingPools = useMemo(() => {
    return sortPoolsByPriority(findPoolsForPair(pools, firstMint, secondMint));
  }, [firstMint, secondMint, pools]);

  useEffect(() => {
    if (!matchingPools.length) {
      setSelectedPoolId(null);
      return;
    }

    if (!selectedPoolId || !matchingPools.some((poolItem) => poolItem.poolId === selectedPoolId)) {
      setSelectedPoolId(matchingPools[0].poolId);
    }
  }, [matchingPools, selectedPoolId]);

  const selectedPool = useMemo(() => {
    return findPoolById(pools, selectedPoolId);
  }, [pools, selectedPoolId]);

  const firstToken = useMemo(() => {
    return tokens.find((token) => token.mint === firstMint) ?? null;
  }, [firstMint, tokens]);

  const secondToken = useMemo(() => {
    return tokens.find((token) => token.mint === secondMint) ?? null;
  }, [secondMint, tokens]);

  const { pool, loading: poolLoading, error: poolError } = useAmmPool(selectedPoolId);
  const { balance: firstBalance } = useMintBalance(firstMint, refreshTick);
  const { balance: secondBalance } = useMintBalance(secondMint, refreshTick);
  const { balance: lpBalance } = useMintBalance(selectedPool?.lpMint ?? null, refreshTick);

  // Memoize toBase58() so it's not recalculated on every render.
  const poolCoinBase58 = useMemo(() => pool?.coinMint.toBase58() ?? null, [pool]);
  const poolPcBase58 = useMemo(() => pool?.pcMint.toBase58() ?? null, [pool]);

  const depositPreview: DepositPreview | null = useMemo(() => {
    if (!pool || !baseMint || !depositAmount) return null;

    const effectiveCoin = pool.coinVaultBalance - pool.needTakePnlCoin;
    const effectivePc = pool.pcVaultBalance - pool.needTakePnlPc;
    if (effectiveCoin <= 0n || effectivePc <= 0n || pool.lpAmount <= 0n) return null;

    if (poolCoinBase58 === baseMint) {
      const coinAmount = parseHumanAmount(depositAmount, pool.coinDecimals);
      if (coinAmount <= 0n) return null;
      return {
        coinAmount,
        pcAmount: ceilDiv(coinAmount * effectivePc, effectiveCoin),
        mintedLp: (coinAmount * pool.lpAmount) / effectiveCoin,
        baseSide: 0n,
      };
    }

    const pcAmount = parseHumanAmount(depositAmount, pool.pcDecimals);
    if (pcAmount <= 0n) return null;
    return {
      coinAmount: ceilDiv(pcAmount * effectiveCoin, effectivePc),
      pcAmount,
      mintedLp: (pcAmount * pool.lpAmount) / effectivePc,
      baseSide: 1n,
    };
  }, [baseMint, depositAmount, pool, poolCoinBase58]);

  const withdrawPreview: WithdrawPreview | null = useMemo(() => {
    if (!pool || !withdrawAmount || pool.lpAmount <= 0n) return null;
    const amount = parseHumanAmount(withdrawAmount, pool.coinDecimals);
    if (amount <= 0n) return null;

    const effectiveCoin = pool.coinVaultBalance - pool.needTakePnlCoin;
    const effectivePc = pool.pcVaultBalance - pool.needTakePnlPc;
    return {
      amount,
      coinAmount: (amount * effectiveCoin) / pool.lpAmount,
      pcAmount: (amount * effectivePc) / pool.lpAmount,
    };
  }, [pool, withdrawAmount]);

  const createCoinToken = useMemo(() => {
    return tokens.find((token) => token.mint === createFirstMint) ?? null;
  }, [createFirstMint, tokens]);

  const createPcToken = useMemo(() => {
    return tokens.find((token) => token.mint === createSecondMint) ?? null;
  }, [createSecondMint, tokens]);

  async function runTransaction(action: () => Promise<string>, successMessage: string) {
    if (!connected || !signTransaction) return;

    try {
      setTxStatus({ status: "building" });
      const signature = await action();
      setTxStatus({ status: "confirmed", signature });
      toast.success(successMessage);
      setRefreshTick((tick) => tick + 1);
      onPoolsRefresh();
    } catch (err) {
      const message = parseSwapError(err);
      setTxStatus({ status: "error", error: message });
      toast.error(message);
    }
  }

  async function handleDeposit() {
    if (!pool || !publicKey || !signTransaction || !depositPreview) return;

    await runTransaction(async () => {
      const executionConnection = getExecutionConnection(connection, settings);
      const tx = await buildDepositTransaction({
        connection: executionConnection,
        pool,
        wallet: publicKey,
        settings,
        maxCoinAmount: depositPreview.coinAmount,
        maxPcAmount: depositPreview.pcAmount,
        baseSide: depositPreview.baseSide,
      });
      return signSendAndConfirmTransaction(signTransaction, tx, executionConnection);
    }, "Liquidity deposited");
  }

  async function handleWithdraw() {
    if (!pool || !publicKey || !signTransaction || !withdrawPreview) return;

    await runTransaction(async () => {
      const executionConnection = getExecutionConnection(connection, settings);
      const tx = await buildWithdrawTransaction({
        connection: executionConnection,
        pool,
        wallet: publicKey,
        settings,
        amount: withdrawPreview.amount,
        minCoinAmount: (withdrawPreview.coinAmount * BigInt(10_000 - settings.slippageBps)) / 10_000n,
        minPcAmount: (withdrawPreview.pcAmount * BigInt(10_000 - settings.slippageBps)) / 10_000n,
      });
      return signSendAndConfirmTransaction(signTransaction, tx, executionConnection);
    }, "Liquidity withdrawn");
  }

  async function handleCreatePool() {
    if (!createCoinToken || !createPcToken || !publicKey || !signTransaction) return;

    await runTransaction(async () => {
      const executionConnection = getExecutionConnection(connection, settings);
      const { Keypair, PublicKey: PK } = await import("@solana/web3.js");
      const coinMint = new PK(createCoinToken.mint);
      const pcMint = new PK(createPcToken.mint);

      // Generate the marketId keypair first so we can derive PDAs correctly
      const marketIdKeypair = Keypair.generate();
      const { transaction } = await buildCreatePoolTransaction({
        connection: executionConnection,
        wallet: publicKey,
        coinMint,
        pcMint,
        settings,
        initCoinAmount: parseHumanAmount(createCoinAmount, createCoinToken.decimals),
        initPcAmount: parseHumanAmount(createPcAmount, createPcToken.decimals),
        openTime: parseOpenTimeValue(openTimeInput),
        marketId: marketIdKeypair.publicKey,
        derivedAddresses: {
          ...derivePoolAddresses(AMM_PROGRAM_ID, marketIdKeypair.publicKey),
          ammConfig: getAmmConfigAddress(AMM_PROGRAM_ID),
          createFeeDestination: CREATE_POOL_FEE_DESTINATION,
        },
      });
      return signSendAndConfirmTransaction(signTransaction, transaction, executionConnection);
    }, "Pool created");
  }

  function selectPairToken(token: TokenOption) {
    const mode = pickerMode;
    // Close the modal immediately so the CSS transition starts.
    setPickerMode(null);
    // Defer the heavy state updates to the next frame so they don't
    // block the modal close animation.
    requestAnimationFrame(() => {
      if (mode === "first") {
        setFirstMint(token.mint);
        if (!baseMint) setBaseMint(token.mint);
      }
      if (mode === "second") {
        setSecondMint(token.mint);
      }
      if (mode === "createFirst") {
        setCreateFirstMint(token.mint);
      }
      if (mode === "createSecond") {
        setCreateSecondMint(token.mint);
      }
      setDepositAmount("");
      setWithdrawAmount("");
      setTxStatus({ status: "idle" });
    });
  }

  const createPairInvalid = !createFirstMint || !createSecondMint || createFirstMint === createSecondMint;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface/90 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <h2 className="text-lg font-semibold">Deposit / Create</h2>
            <p className="mt-1 text-xs text-dark-500">Deposit liquidity, withdraw LP positions, or initialize a fresh pool.</p>
          </div>
          <button onClick={() => setShowSettings((value) => !value)} className="rounded-xl p-2 transition-colors hover:bg-surface-raised">
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
              onClose={() => setShowSettings(false)}
            />
          )}
        </AnimatePresence>

        <div className="px-4 pb-4">
          <div className="mb-4 flex rounded-2xl border border-surface-border/50 bg-surface/50 p-1.5">
            <button onClick={() => setActiveTab("deposit")} className={nestedTabClass(activeTab === "deposit")}>Deposit</button>
            <button onClick={() => setActiveTab("withdraw")} className={nestedTabClass(activeTab === "withdraw")}>Withdraw</button>
            <button onClick={() => setActiveTab("create")} className={nestedTabClass(activeTab === "create")}>Create</button>
          </div>

          {(loading || poolLoading) && (
            <div className="mb-4 rounded-xl bg-surface-raised/50 px-3 py-3 text-center text-xs text-dark-500">Loading AMM data...</div>
          )}

          {(error || poolError) && (
            <div className="mb-4 rounded-xl bg-red-dim px-3 py-3 text-center text-xs text-red-300">{error || poolError}</div>
          )}

          {activeTab !== "create" && (
            <div className="mb-4 rounded-2xl border border-surface-border/50 bg-surface-raised/50 p-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <button onClick={() => startTransition(() => setPickerMode("first"))} className="rounded-xl border border-surface-border/50 bg-surface px-3 py-3 text-left">
                  <div className="text-xs text-dark-500">Token A</div>
                  <div className="mt-1 font-semibold">{firstToken?.symbol ?? "Select"}</div>
                </button>
                <button onClick={() => startTransition(() => setShowPoolPicker(true))} className="rounded-xl border border-surface-border/50 bg-surface px-3 py-3 text-xs text-dark-400">Pool</button>
                <button onClick={() => startTransition(() => setPickerMode("second"))} className="rounded-xl border border-surface-border/50 bg-surface px-3 py-3 text-left">
                  <div className="text-xs text-dark-500">Token B</div>
                  <div className="mt-1 font-semibold">{secondToken?.symbol ?? "Select"}</div>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-dark-500">
                <span>{selectedPool ? formatPoolLabel(selectedPool) : "No pool selected"}</span>
                {selectedPool && <span>{shortenAddress(selectedPool.poolId)}</span>}
              </div>
            </div>
          )}

          {activeTab === "deposit" && (
            <div className="space-y-4">
              <div className="flex rounded-xl border border-surface-border/50 bg-surface/50 p-1">
                <button
                  onClick={() => setBaseMint(poolCoinBase58 ?? firstMint)}
                  className={nestedTabClass(baseMint === poolCoinBase58)}
                >
                  Base token A
                </button>
                <button
                  onClick={() => setBaseMint(poolPcBase58 ?? secondMint)}
                  className={nestedTabClass(baseMint === poolPcBase58)}
                >
                  Base token B
                </button>
              </div>

              <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-dark-500">
                  <span>Deposit amount</span>
                  <span>
                    Balance {baseMint === firstMint
                      ? (firstToken ? formatTokenAmount(firstBalance, firstToken.decimals) : "0")
                      : (secondToken ? formatTokenAmount(secondBalance, secondToken.decimals) : "0")}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={depositAmount}
                  onChange={(event) => {
                    setDepositAmount(event.target.value);
                    setTxStatus({ status: "idle" });
                  }}
                  placeholder="0"
                  className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-dark-600"
                />
              </div>

              <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-dark-500">Required counterpart</span>
                  <span className="font-semibold">
                    {depositPreview && pool
                      ? baseMint === poolCoinBase58
                        ? formatTokenAmount(depositPreview.pcAmount, pool.pcDecimals)
                        : formatTokenAmount(depositPreview.coinAmount, pool.coinDecimals)
                      : "—"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-dark-500">Estimated LP minted</span>
                  <span className="font-semibold">{depositPreview && pool ? formatTokenAmount(depositPreview.mintedLp, pool.coinDecimals) : "—"}</span>
                </div>
              </div>

              {!connected ? (
                <WalletButton fullWidth />
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={!depositPreview || !pool}
                  className={`flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold transition-all ${
                    !depositPreview || !pool
                      ? "cursor-not-allowed bg-surface-raised text-dark-500"
                      : "bg-gradient-to-r from-accent to-amber-500 text-black hover:shadow-lg hover:shadow-accent/20"
                  }`}
                >
                  Deposit liquidity
                </button>
              )}
            </div>
          )}

          {activeTab === "withdraw" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-dark-500">
                  <span>LP amount</span>
                  <span>Balance {selectedPool ? formatTokenAmount(lpBalance, selectedPool.coinDecimals) : "0"}</span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={withdrawAmount}
                  onChange={(event) => {
                    setWithdrawAmount(event.target.value);
                    setTxStatus({ status: "idle" });
                  }}
                  placeholder="0"
                  className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-dark-600"
                />
              </div>

              <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-dark-500">Estimated token A</span>
                  <span className="font-semibold">{withdrawPreview && pool ? formatTokenAmount(withdrawPreview.coinAmount, pool.coinDecimals) : "—"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-dark-500">Estimated token B</span>
                  <span className="font-semibold">{withdrawPreview && pool ? formatTokenAmount(withdrawPreview.pcAmount, pool.pcDecimals) : "—"}</span>
                </div>
              </div>

              {!connected ? (
                <WalletButton fullWidth />
              ) : (
                <button
                  onClick={handleWithdraw}
                  disabled={!withdrawPreview || !pool || lpBalance <= 0n}
                  className={`flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold transition-all ${
                    !withdrawPreview || !pool || lpBalance <= 0n
                      ? "cursor-not-allowed bg-surface-raised text-dark-500"
                      : "bg-gradient-to-r from-accent to-amber-500 text-black hover:shadow-lg hover:shadow-accent/20"
                  }`}
                >
                  Withdraw liquidity
                </button>
              )}
            </div>
          )}

          {activeTab === "create" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <button onClick={() => startTransition(() => setPickerMode("createFirst"))} className="rounded-xl border border-surface-border/50 bg-surface px-3 py-3 text-left">
                    <div className="text-xs text-dark-500">Token A</div>
                    <div className="mt-1 font-semibold">{createCoinToken?.symbol ?? "Select"}</div>
                  </button>
                  <div className="rounded-xl border border-surface-border/50 bg-surface px-3 py-3 text-center text-xs text-dark-400">
                    Auto market
                  </div>
                  <button onClick={() => startTransition(() => setPickerMode("createSecond"))} className="rounded-xl border border-surface-border/50 bg-surface px-3 py-3 text-left">
                    <div className="text-xs text-dark-500">Token B</div>
                    <div className="mt-1 font-semibold">{createPcToken?.symbol ?? "Select"}</div>
                  </button>
                </div>
                <p className="mt-3 text-xs text-dark-500">
                  A random market ID is generated automatically when you create the pool.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4">
                  <div className="mb-2 text-xs text-dark-500">Initial {createCoinToken?.symbol ?? "token A"} amount</div>
                  <input type="text" inputMode="decimal" value={createCoinAmount} onChange={(event) => setCreateCoinAmount(event.target.value)} placeholder="0" className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-dark-600" />
                </div>
                <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4">
                  <div className="mb-2 text-xs text-dark-500">Initial {createPcToken?.symbol ?? "token B"} amount</div>
                  <input type="text" inputMode="decimal" value={createPcAmount} onChange={(event) => setCreatePcAmount(event.target.value)} placeholder="0" className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-dark-600" />
                </div>
              </div>

              <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4">
                <div className="mb-2 text-xs text-dark-500">Pool open date &amp; time</div>
                <input type="datetime-local" value={openTimeInput} onChange={(event) => setOpenTimeInput(event.target.value)} className="w-full bg-transparent text-sm font-medium outline-none" />
              </div>

              <div className="rounded-2xl border border-surface-border/50 bg-surface-raised/60 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-dark-500">Market ID</span>
                  <span className="text-xs">Generated automatically</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-dark-500">Pair</span>
                  <span className="text-xs">{createCoinToken?.symbol ?? "—"} / {createPcToken?.symbol ?? "—"}</span>
                </div>
                {createPairInvalid && (
                  <div className="mt-3 text-xs text-red-300">Choose two different tokens for the new pool.</div>
                )}
              </div>

              {!connected ? (
                <WalletButton fullWidth />
              ) : (
                <button
                  onClick={handleCreatePool}
                  disabled={createPairInvalid || !createCoinAmount || !createPcAmount}
                  className={`flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold transition-all ${
                    createPairInvalid || !createCoinAmount || !createPcAmount
                      ? "cursor-not-allowed bg-surface-raised text-dark-500"
                      : "bg-gradient-to-r from-accent to-amber-500 text-black hover:shadow-lg hover:shadow-accent/20"
                  }`}
                >
                  Create pool
                </button>
              )}
            </div>
          )}

          {txStatus.status === "error" && (
            <div className="mt-4 rounded-xl bg-red-dim px-3 py-3 text-center text-xs text-red-300">{txStatus.error}</div>
          )}

          {txStatus.status === "confirmed" && (
            <a href={getSolscanUrl(txStatus.signature)} target="_blank" rel="noopener noreferrer" className="mt-4 block text-center text-xs text-accent hover:underline">
              View last transaction on Solscan →
            </a>
          )}
        </div>
      </div>

      <TokenPickerModal
        title={pickerMode === "first" || pickerMode === "createFirst" ? "Select token A" : "Select token B"}
        tokens={tokens}
        selectedMint={pickerMode === "first"
          ? firstMint
          : pickerMode === "second"
            ? secondMint
            : pickerMode === "createFirst"
              ? createFirstMint
              : createSecondMint}
        open={pickerMode !== null}
        onSelect={selectPairToken}
        onClose={() => setPickerMode(null)}
      />

      <AnimatePresence>
        {showPoolPicker && (
          <PoolPickerModal
            pools={matchingPools}
            selectedPoolId={selectedPoolId}
            onSelect={(poolItem) => {
              setSelectedPoolId(poolItem.poolId);
              setShowPoolPicker(false);
            }}
            onClose={() => setShowPoolPicker(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
