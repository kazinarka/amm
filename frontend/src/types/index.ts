import { PublicKey } from "@solana/web3.js";

/* ── Legacy types (kept for backwards compat) ── */

export interface Token {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI: string;
  balance?: number;
  usdPrice?: number;
}

export interface TokenOption {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI: string;
  isNative?: boolean;
}

/* ── AMM Pool types ── */

export type TradeSide = "buy" | "sell";

export interface AmmPoolData {
  address: PublicKey;
  nonce: number;
  coinDecimals: number;
  pcDecimals: number;
  swapFeeNumerator: bigint;
  swapFeeDenominator: bigint;
  needTakePnlCoin: bigint;
  needTakePnlPc: bigint;
  coinVault: PublicKey;
  pcVault: PublicKey;
  coinMint: PublicKey;
  pcMint: PublicKey;
  lpMint: PublicKey;
  authority: PublicKey;
  marketId: PublicKey;
  targetOrders: PublicKey;
  ammOwner: PublicKey;
  lpAmount: bigint;
  /* Vault balances (fetched separately from token accounts) */
  coinVaultBalance: bigint;
  pcVaultBalance: bigint;
}

export interface DiscoveredAmmPool {
  address: PublicKey;
  poolId: string;
  nonce: number;
  coinMint: string;
  pcMint: string;
  lpMint: string;
  marketId: string;
  targetOrders: string;
  lpAmount: bigint;
  coinDecimals: number;
  pcDecimals: number;
  coinToken: TokenOption;
  pcToken: TokenOption;
}

export interface LiquidityPosition {
  pool: DiscoveredAmmPool;
  lpBalance: bigint;
  shareBps: number;
  estimatedCoinAmount: bigint;
  estimatedPcAmount: bigint;
}

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  minimumAmountOut: bigint;
  fee: bigint;
  priceImpactBps: number;
  rate: number; // human-readable: how many output tokens per 1 input token
}

export interface PoolRegistryEntry {
  poolId: string;      // base58 AMM account address
  symbol: string;      // e.g. "USDC"
  name: string;        // e.g. "USD Coin"
  coinMint: string;    // the non-SOL mint
  logoURI?: string;
}

export type TxStatus =
  | { status: "idle" }
  | { status: "building" }
  | { status: "signing" }
  | { status: "sending" }
  | { status: "confirming" }
  | { status: "confirmed"; signature: string }
  | { status: "error"; error: string };

export type SwapStatus = TxStatus;

export interface SwapSettings {
  slippageBps: number;
  speedMicroLamports: number;
  frontRunningProtection: boolean;
}
