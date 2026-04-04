/**
 * 04-swap.ts
 *
 * Performs a SwapBaseInV2 on the created pool.
 * Mirrors the frontend buildSwapTransaction() exactly:
 *   1. Priority fee instructions
 *   2. Get-or-create source & destination ATAs
 *   3. SwapBaseInV2 instruction (tag 0x10, 8 accounts)
 *
 * Swaps 1,000 BREAD → BUTTER using the pool from state.json.
 */

import { PublicKey } from "@solana/web3.js";
import {
  getConnection,
  loadWallet,
  loadState,
  AMM_PROGRAM_ID,
  fetchAmmPool,
  buildSwapBaseInV2Instruction,
  buildVersionedTx,
  sendAndConfirmTx,
  getOrCreateATA,
  buildSpeedInstructions,
  quoteSwapBaseIn,
} from "./utils";
import { TransactionInstruction } from "@solana/web3.js";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Step 4: Swap (SwapBaseInV2)");
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

  // Fetch pool data from chain
  console.log("Fetching pool data...");
  const pool = await fetchAmmPool(connection, poolAddress);

  console.log(`  Coin Vault Balance: ${pool.coinVaultBalance} (${state.tokenA.symbol})`);
  console.log(`  PC Vault Balance:   ${pool.pcVaultBalance} (${state.tokenB.symbol})`);
  console.log(`  Fee: ${pool.swapFeeNumerator}/${pool.swapFeeDenominator}`);
  console.log();

  // Swap 1,000 BREAD → BUTTER
  const swapAmountRaw = 1_000n * 1_000_000n; // 1,000 tokens with 6 decimals
  const slippageBps = 50; // 0.5%

  // Compute quote — mirrors frontend quoteSwapBaseIn
  const quote = quoteSwapBaseIn(pool, swapAmountRaw, "coin_to_pc", slippageBps);

  console.log("Swap Quote:");
  console.log(`  Input:  ${Number(swapAmountRaw) / 1e6} ${state.tokenA.symbol}`);
  console.log(`  Output: ~${Number(quote.amountOut) / 1e6} ${state.tokenB.symbol}`);
  console.log(`  Min Out: ${Number(quote.minimumAmountOut) / 1e6} ${state.tokenB.symbol}`);
  console.log(`  Fee:    ${Number(quote.fee) / 1e6} ${state.tokenA.symbol}`);
  console.log();

  // Build transaction — mirrors frontend buildSwapTransaction
  const instructions: TransactionInstruction[] = [...buildSpeedInstructions()];

  // Get-or-create source ATA (BREAD)
  const { address: userSource, instruction: createSrcAta } = await getOrCreateATA(
    connection, wallet.publicKey, pool.coinMint, wallet.publicKey
  );
  if (createSrcAta) instructions.push(createSrcAta);

  // Get-or-create destination ATA (BUTTER)
  const { address: userDestination, instruction: createDstAta } = await getOrCreateATA(
    connection, wallet.publicKey, pool.pcMint, wallet.publicKey
  );
  if (createDstAta) instructions.push(createDstAta);

  // Build the swap instruction — exactly as frontend does it
  instructions.push(
    buildSwapBaseInV2Instruction({
      amm: pool.address,
      ammAuthority: pool.authority,
      ammCoinVault: pool.coinVault,
      ammPcVault: pool.pcVault,
      userSource,
      userDestination,
      userSourceOwner: wallet.publicKey,
      amountIn: swapAmountRaw,
      minimumAmountOut: quote.minimumAmountOut,
    })
  );

  console.log("Building swap transaction...");
  const tx = await buildVersionedTx(connection, wallet.publicKey, instructions);
  await sendAndConfirmTx(connection, tx, [wallet], "SwapBaseInV2");

  // Verify result
  console.log("\nVerifying post-swap state...");
  const poolAfter = await fetchAmmPool(connection, poolAddress);
  console.log(`  Coin Vault: ${poolAfter.coinVaultBalance} (was ${pool.coinVaultBalance})`);
  console.log(`  PC Vault:   ${poolAfter.pcVaultBalance} (was ${pool.pcVaultBalance})`);

  console.log("\n═══════════════════════════════════════════");
  console.log("  Swap Completed Successfully!");
  console.log("═══════════════════════════════════════════");
  console.log(`  Swapped ${Number(swapAmountRaw) / 1e6} ${state.tokenA.symbol} → ~${Number(quote.amountOut) / 1e6} ${state.tokenB.symbol}\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
