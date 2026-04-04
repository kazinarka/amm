/**
 * 02-create-config.ts
 *
 * Creates the AMM config account (PDA) if it doesn't already exist.
 * This is a one-time operation required before any pools can be created.
 *
 * The CreateConfigAccount instruction (tag 0x0E) must be called by the
 * admin (amm_owner). The admin keypair is loaded from keys/amm_owner.json.
 */

import { SystemProgram } from "@solana/web3.js";
import {
  getConnection,
  loadWallet,
  loadKeypairFromProjectKeys,
  AMM_PROGRAM_ID,
  getAmmConfigAddress,
  buildCreateConfigInstruction,
  buildVersionedTx,
  sendAndConfirmTx,
} from "./utils";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Step 2: Create AMM Config Account");
  console.log("═══════════════════════════════════════════\n");

  const connection = getConnection();
  const wallet = loadWallet();
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // Load admin keypair
  let admin;
  try {
    admin = loadKeypairFromProjectKeys("amm_owner.json");
    console.log(`Admin (amm_owner): ${admin.publicKey.toBase58()}`);
  } catch (err) {
    console.log("⚠️  Could not load keys/amm_owner.json, using wallet as admin");
    admin = wallet;
  }

  // Derive config PDA
  const ammConfig = getAmmConfigAddress(AMM_PROGRAM_ID);
  console.log(`Config PDA: ${ammConfig.toBase58()}\n`);

  // Check if already exists
  const existing = await connection.getAccountInfo(ammConfig);
  if (existing) {
    console.log("✅ Config account already exists! Skipping creation.");
    console.log(`   Owner: ${existing.owner.toBase58()}`);
    console.log(`   Size: ${existing.data.length} bytes\n`);
    return;
  }

  // Ensure admin has enough SOL
  const adminBalance = await connection.getBalance(admin.publicKey);
  console.log(`Admin balance: ${adminBalance / 1e9} SOL`);

  if (adminBalance < 0.01 * 1e9) {
    console.log("⚠️  Admin balance low. Transferring 0.05 SOL from wallet...");
    const transferAmount = 0.05 * 1e9;
    const transferIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: admin.publicKey,
      lamports: transferAmount,
    });
    const transferTx = await buildVersionedTx(connection, wallet.publicKey, [transferIx]);
    await sendAndConfirmTx(connection, transferTx, [wallet], "Fund Admin");
    console.log("  Admin funded!\n");
  }

  // Build and send CreateConfigAccount transaction
  console.log("Building CreateConfigAccount transaction...");
  const instruction = buildCreateConfigInstruction({
    admin: admin.publicKey,
    ammConfig,
    pnlOwner: admin.publicKey,
  });

  const tx = await buildVersionedTx(connection, admin.publicKey, [instruction]);
  await sendAndConfirmTx(connection, tx, [admin], "CreateConfigAccount");

  console.log("\n═══════════════════════════════════════════");
  console.log("  Config Account Created Successfully!");
  console.log("═══════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
