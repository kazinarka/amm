/**
 * 01-create-tokens.ts
 *
 * Creates two SPL tokens on devnet for testing the AMM pool.
 * - Token A (BREAD): 6 decimals, 1,000,000 supply
 * - Token B (BUTTER): 6 decimals, 1,000,000 supply
 *
 * Saves mint addresses to state.json for subsequent scripts.
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import {
  createMint,
  mintTo,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import {
  getConnection,
  loadWallet,
  loadState,
  saveState,
  TOKEN_PROGRAM_ID,
  buildVersionedTx,
  sendAndConfirmTx,
} from "./utils";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Step 1: Create Devnet Test Tokens");
  console.log("═══════════════════════════════════════════\n");

  const connection = getConnection();
  const wallet = loadWallet();
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL\n`);

  if (balance < 0.1 * 1e9) {
    console.log("⚠️  Low balance. Requesting airdrop...");
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("  Airdrop received!\n");
  }

  // Create Token A (BREAD)
  console.log("Creating Token A (BREAD) — 6 decimals...");
  const mintA = await createMint(
    connection,
    wallet,
    wallet.publicKey,
    wallet.publicKey,
    6 // decimals
  );
  console.log(`  Mint A: ${mintA.toBase58()}`);

  // Create Token B (BUTTER)
  console.log("Creating Token B (BUTTER) — 6 decimals...");
  const mintB = await createMint(
    connection,
    wallet,
    wallet.publicKey,
    wallet.publicKey,
    6 // decimals
  );
  console.log(`  Mint B: ${mintB.toBase58()}`);

  // Create ATAs and mint supply
  const ataA = getAssociatedTokenAddressSync(mintA, wallet.publicKey);
  const ataB = getAssociatedTokenAddressSync(mintB, wallet.publicKey);

  // Create ATAs
  const instructions = [];
  try {
    await getAccount(connection, ataA);
  } catch {
    instructions.push(createAssociatedTokenAccountInstruction(wallet.publicKey, ataA, wallet.publicKey, mintA));
  }
  try {
    await getAccount(connection, ataB);
  } catch {
    instructions.push(createAssociatedTokenAccountInstruction(wallet.publicKey, ataB, wallet.publicKey, mintB));
  }

  if (instructions.length > 0) {
    console.log("\nCreating Associated Token Accounts...");
    const tx = await buildVersionedTx(connection, wallet.publicKey, instructions);
    await sendAndConfirmTx(connection, tx, [wallet], "Create ATAs");
  }

  // Mint 1,000,000 of each token
  const mintAmount = 1_000_000n * 1_000_000n; // 1M tokens with 6 decimals

  console.log("\nMinting 1,000,000 BREAD...");
  await mintTo(connection, wallet, mintA, ataA, wallet, BigInt(mintAmount.toString()));
  console.log("  ✅ Minted!");

  console.log("Minting 1,000,000 BUTTER...");
  await mintTo(connection, wallet, mintB, ataB, wallet, BigInt(mintAmount.toString()));
  console.log("  ✅ Minted!");

  // Save state
  const state = loadState();
  state.tokenA = { mint: mintA.toBase58(), decimals: 6, symbol: "BREAD" };
  state.tokenB = { mint: mintB.toBase58(), decimals: 6, symbol: "BUTTER" };
  saveState(state);

  console.log("\n═══════════════════════════════════════════");
  console.log("  Tokens Created Successfully!");
  console.log("═══════════════════════════════════════════");
  console.log(`  Token A (BREAD):  ${mintA.toBase58()}`);
  console.log(`  Token B (BUTTER): ${mintB.toBase58()}`);
  console.log(`  Supply: 1,000,000 each (6 decimals)`);
  console.log(`  State saved to state.json\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
