/**
 * 05-deposit.ts
 *
 * Deposits additional liquidity into the AMM pool.
 * Mirrors the frontend buildDepositTransaction() exactly:
 *   1. Priority fee instructions
 *   2. Get-or-create user token accounts (coin, pc, lp)
 *   3. Deposit instruction (tag 0x03, 11 accounts)
 *
 * Deposits 10,000 BREAD + proportional BUTTER into the pool.
 */

import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  getConnection,
  loadWallet,
  loadState,
  AMM_PROGRAM_ID,
  fetchAmmPool,
  buildDepositInstruction,
  buildVersionedTx,
  sendAndConfirmTx,
  getOrCreateATA,
  buildSpeedInstructions,
} from "./utils";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Step 5: Deposit Liquidity");
  console.log("═══════════════════════════════════════════\n");

  const connection = getConnection();
  const wallet = loadWallet();
  const state = loadState();

  if (!state.pool || !state.tokenA || !state.tokenB) {
    throw new Error("Pool not found in state.json. Run previous scripts first.");
  }

  const poolAddress = new PublicKey(state.pool.amm);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Pool: ${poolAddress.toBase58()}\n`);

  // Fetch current pool state
  console.log("Fetching pool data...");
  const pool = await fetchAmmPool(connection, poolAddress);

  const effectiveCoin = pool.coinVaultBalance - pool.needTakePnlCoin;
  const effectivePc = pool.pcVaultBalance - pool.needTakePnlPc;

  console.log(`  Coin Vault: ${pool.coinVaultBalance} (effective: ${effectiveCoin})`);
  console.log(`  PC Vault:   ${pool.pcVaultBalance} (effective: ${effectivePc})`);
  console.log(`  LP Supply:  ${pool.lpAmount}`);
  console.log();

  // Deposit 10,000 BREAD as base side, calculate proportional BUTTER
  const coinAmount = 10_000n * 1_000_000n; // 10,000 BREAD (6 decimals)
  const baseSide = 0n; // coin is base

  // Calculate proportional pc amount — mirrors frontend LiquidityCard math
  // pcAmount = ceil(coinAmount * effectivePc / effectiveCoin)
  const pcAmount = effectiveCoin > 0n
    ? (coinAmount * effectivePc + effectiveCoin - 1n) / effectiveCoin
    : coinAmount;

  const expectedLp = effectiveCoin > 0n
    ? (coinAmount * pool.lpAmount) / effectiveCoin
    : coinAmount;

  console.log("Deposit Plan:");
  console.log(`  Coin (${state.tokenA.symbol}): ${Number(coinAmount) / 1e6}`);
  console.log(`  PC (${state.tokenB.symbol}):   ${Number(pcAmount) / 1e6}`);
  console.log(`  Expected LP:  ~${Number(expectedLp) / 1e6}`);
  console.log(`  Base Side: coin (0)`);
  console.log();

  // Build transaction — mirrors frontend buildDepositTransaction
  const instructions: TransactionInstruction[] = [...buildSpeedInstructions()];

  // Get-or-create user token accounts
  const { address: userTokenCoin, instruction: createCoinAta } = await getOrCreateATA(
    connection, wallet.publicKey, pool.coinMint, wallet.publicKey
  );
  if (createCoinAta) instructions.push(createCoinAta);

  const { address: userTokenPc, instruction: createPcAta } = await getOrCreateATA(
    connection, wallet.publicKey, pool.pcMint, wallet.publicKey
  );
  if (createPcAta) instructions.push(createPcAta);

  const { address: userTokenLp, instruction: createLpAta } = await getOrCreateATA(
    connection, wallet.publicKey, pool.lpMint, wallet.publicKey
  );
  if (createLpAta) instructions.push(createLpAta);

  // Build the deposit instruction — exactly as frontend does it
  instructions.push(
    buildDepositInstruction({
      amm: pool.address,
      ammAuthority: pool.authority,
      ammTargetOrders: pool.targetOrders,
      ammLpMint: pool.lpMint,
      ammCoinVault: pool.coinVault,
      ammPcVault: pool.pcVault,
      userTokenCoin,
      userTokenPc,
      userTokenLp,
      userOwner: wallet.publicKey,
      maxCoinAmount: coinAmount,
      maxPcAmount: pcAmount,
      baseSide,
    })
  );

  console.log("Building deposit transaction...");
  const tx = await buildVersionedTx(connection, wallet.publicKey, instructions);
  await sendAndConfirmTx(connection, tx, [wallet], "Deposit Liquidity");

  // Verify result
  console.log("\nVerifying post-deposit state...");
  const poolAfter = await fetchAmmPool(connection, poolAddress);
  console.log(`  Coin Vault: ${poolAfter.coinVaultBalance} (was ${pool.coinVaultBalance})`);
  console.log(`  PC Vault:   ${poolAfter.pcVaultBalance} (was ${pool.pcVaultBalance})`);
  console.log(`  LP Supply:  ${poolAfter.lpAmount} (was ${pool.lpAmount})`);

  console.log("\n═══════════════════════════════════════════");
  console.log("  Deposit Completed Successfully!");
  console.log("═══════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
