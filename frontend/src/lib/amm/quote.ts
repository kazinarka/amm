import { AmmPoolData, SwapQuote } from "@/types";

/**
 * Direction of the swap relative to the pool's coin/pc pair.
 * - coin_to_pc: user sends coin, receives pc
 * - pc_to_coin: user sends pc, receives coin
 */
export type SwapDirection = "coin_to_pc" | "pc_to_coin";

/* ── Helpers ── */

/** Ceiling division for bigints: ceil(a / b) */
function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("Division by zero");
  return (a + b - 1n) / b;
}

/**
 * Parse a human-readable amount string (e.g. "1.5") to raw token units (bigint).
 * Uses string splitting to avoid floating-point precision loss.
 */
export function parseHumanAmount(input: string, decimals: number): bigint {
  if (!input || input === "." || input === "") return 0n;

  const [whole = "0", frac = ""] = input.split(".");
  const trimmedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(trimmedFrac);
}

/**
 * Format a raw bigint token amount to a human-readable string.
 */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  if (raw === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  if (frac === 0n) return whole.toString();

  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Compute a swap quote using the constant-product formula, matching
 * the on-chain logic exactly (bigint arithmetic, ceiling fee).
 *
 * @param pool         Decoded pool data with vault balances
 * @param amountInRaw  Raw input amount in smallest token units
 * @param direction    coin_to_pc or pc_to_coin
 * @param slippageBps  Slippage tolerance in basis points (e.g. 50 = 0.5%)
 */
export function quoteSwapBaseIn(
  pool: AmmPoolData,
  amountInRaw: bigint,
  direction: SwapDirection,
  slippageBps: number
): SwapQuote {
  if (amountInRaw <= 0n) {
    return {
      amountIn: 0n,
      amountOut: 0n,
      minimumAmountOut: 0n,
      fee: 0n,
      priceImpactBps: 0,
      rate: 0,
    };
  }

  // Effective reserves (vault balance minus pending PnL)
  const effectiveCoin = pool.coinVaultBalance - pool.needTakePnlCoin;
  const effectivePc = pool.pcVaultBalance - pool.needTakePnlPc;

  // 1. Compute swap fee (ceiling division)
  const fee = ceilDiv(
    amountInRaw * pool.swapFeeNumerator,
    pool.swapFeeDenominator
  );

  // 2. Amount after fee deduction
  const amountInAfterFee = amountInRaw - fee;

  // 3. Constant-product: x * y = k  →  dy = y * dx / (x + dx)
  let amountOut: bigint;
  let spotRateNum: bigint;
  let spotRateDen: bigint;

  if (direction === "coin_to_pc") {
    amountOut = (effectivePc * amountInAfterFee) / (effectiveCoin + amountInAfterFee);
    spotRateNum = effectivePc;
    spotRateDen = effectiveCoin;
  } else {
    amountOut = (effectiveCoin * amountInAfterFee) / (effectivePc + amountInAfterFee);
    spotRateNum = effectiveCoin;
    spotRateDen = effectivePc;
  }

  // 4. Minimum amount out (slippage)
  const minimumAmountOut = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

  // 5. Price impact: compare execution price vs spot price
  // execution_rate = amountOut / amountInAfterFee
  // spot_rate = spotRateNum / spotRateDen
  // impact = 1 - (execution_rate / spot_rate)
  //        = 1 - (amountOut * spotRateDen) / (amountInAfterFee * spotRateNum)
  let priceImpactBps = 0;
  if (amountInAfterFee > 0n && spotRateNum > 0n) {
    const executionScaled = amountOut * spotRateDen * 10000n;
    const spotScaled = amountInAfterFee * spotRateNum;
    if (spotScaled > 0n) {
      const ratioBps = Number(executionScaled / spotScaled);
      priceImpactBps = Math.max(0, 10000 - ratioBps);
    }
  }

  // 6. Human-readable rate
  let rate = 0;
  if (amountInRaw > 0n) {
    const inDecimals = direction === "coin_to_pc" ? pool.coinDecimals : pool.pcDecimals;
    const outDecimals = direction === "coin_to_pc" ? pool.pcDecimals : pool.coinDecimals;
    const inFloat = Number(amountInRaw) / 10 ** inDecimals;
    const outFloat = Number(amountOut) / 10 ** outDecimals;
    rate = inFloat > 0 ? outFloat / inFloat : 0;
  }

  return {
    amountIn: amountInRaw,
    amountOut,
    minimumAmountOut,
    fee,
    priceImpactBps,
    rate,
  };
}
