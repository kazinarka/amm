/**
 * 06-withdraw.ts
 *
 * Withdraws liquidity from the AMM pool.
 * Mirrors the frontend buildWithdrawTransaction() exactly:
 *   1. Priority fee instructions
 *   2. Get-or-create user token accounts (lp, coin, pc)
 *   3. Withdraw instruction (tag 0x04, 11 accounts)
 *
 * Withdraws 50% of the user's LP tokens.
 */

import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import {
  getConnection,
  loadWallet,
  loadState,
  AMM_PROGRAM_ID,
  fetchAmmPool,
  buildWithdrawInstruction,
  buildVersionedTx,
  sendAndConfirmTx,
  getOrCreateATA,
  buildSpeedInstructions,
} from "./utils";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Step 6: Withdraw Liquidity");
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

  // Check user LP balance
  const userLpAta = getAssociatedTokenAddressSync(pool.lpMint, wallet.publicKey, true);
  const lpAccount = await getAccount(connection, userLpAta);
  const userLpBalance = lpAccount.amount;
  console.log(`  User LP Balance: ${userLpBalance}`);

  if (userLpBalance === 0n) {
    console.log("⚠️  No LP tokens to withdraw. Exiting.");
    return;
  }

  // Withdraw 50% of LP tokens
  const withdrawAmount = userLpBalance / 2n;
  const slippageBps = 50; // 0.5%

  // Calculate expected outputs — mirrors frontend LiquidityCard math
  const estimatedCoin = (withdrawAmount * effectiveCoin) / pool.lpAmount;
  const estimatedPc = (withdrawAmount * effectivePc) / pool.lpAmount;
  const minCoin = (estimatedCoin * BigInt(10000 - slippageBps)) / 10000n;
  const minPc = (estimatedPc * BigInt(10000 - slippageBps)) / 10000n;

  console.log("\nWithdraw Plan:");
  console.log(`  LP to burn: ${withdrawAmount} (50% of ${userLpBalance})`);
  console.log(`  Est. ${state.tokenA.symbol}: ~${Number(estimatedCoin) / 1e6}`);
  console.log(`  Est. ${state.tokenB.symbol}: ~${Number(estimatedPc) / 1e6}`);
  console.log(`  Min ${state.tokenA.symbol}:  ${Number(minCoin) / 1e6}`);
  console.log(`  Min ${state.tokenB.symbol}:  ${Number(minPc) / 1e6}`);
  console.log();

  // Build transaction — mirrors frontend buildWithdrawTransaction
  const instructions: TransactionInstruction[] = [...buildSpeedInstructions()];

  // Get-or-create user token accounts
  const { address: userTokenLp, instruction: createLpAta } = await getOrCreateATA(
    connection, wallet.publicKey, pool.lpMint, wallet.publicKey
  );
  if (createLpAta) instructions.push(createLpAta);

  const { address: userTokenCoin, instruction: createCoinAta } = await getOrCreateATA(
    connection, wallet.publicKey, pool.coinMint, wallet.publicKey
  );
  if (createCoinAta) instructions.push(createCoinAta);

  const { address: userTokenPc, instruction: createPcAta } = await getOrCreateATA(
    connection, wallet.publicKey, pool.pcMint, wallet.publicKey
  );
  if (createPcAta) instructions.push(createPcAta);

  // Build the withdraw instruction — exactly as frontend does it
  instructions.push(
    buildWithdrawInstruction({
      amm: pool.address,
      ammAuthority: pool.authority,
      ammTargetOrders: pool.targetOrders,
      ammLpMint: pool.lpMint,
      ammCoinVault: pool.coinVault,
      ammPcVault: pool.pcVault,
      userTokenLp,
      userTokenCoin,
      userTokenPc,
      userOwner: wallet.publicKey,
      amount: withdrawAmount,
      minCoinAmount: minCoin,
      minPcAmount: minPc,
    })
  );

  console.log("Building withdraw transaction...");
  const tx = await buildVersionedTx(connection, wallet.publicKey, instructions);
  await sendAndConfirmTx(connection, tx, [wallet], "Withdraw Liquidity");

  // Verify result
  console.log("\nVerifying post-withdraw state...");
  const poolAfter = await fetchAmmPool(connection, poolAddress);
  const lpAfter = await getAccount(connection, userLpAta);

  console.log(`  Coin Vault: ${poolAfter.coinVaultBalance} (was ${pool.coinVaultBalance})`);
  console.log(`  PC Vault:   ${poolAfter.pcVaultBalance} (was ${pool.pcVaultBalance})`);
  console.log(`  LP Supply:  ${poolAfter.lpAmount} (was ${pool.lpAmount})`);
  console.log(`  User LP:    ${lpAfter.amount} (was ${userLpBalance})`);

  console.log("\n═══════════════════════════════════════════");
  console.log("  Withdraw Completed Successfully!");
  console.log("═══════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
