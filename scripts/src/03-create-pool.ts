/**
 * 03-create-pool.ts
 *
 * Creates an AMM pool on devnet (no OpenBook market required).
 *   1. Generate a random Keypair as marketId (seeds the pool PDAs)
 *   2. Call Initialize2 on the AMM program (single transaction)
 *
 * Reads token mints from state.json (created by 01-create-tokens.ts).
 */

import {
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  getConnection,
  loadWallet,
  loadState,
  saveState,
  AMM_PROGRAM_ID,
  CREATE_POOL_FEE_DESTINATION,
  findAmmAuthority,
  getAmmConfigAddress,
  derivePoolAddresses,
  buildInitialize2Instruction,
  buildVersionedTx,
  sendAndConfirmTx,
  getOrCreateATA,
} from "./utils";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Step 3: Create AMM Pool");
  console.log("═══════════════════════════════════════════\n");

  const connection = getConnection();
  const wallet = loadWallet();
  const state = loadState();

  if (!state.tokenA || !state.tokenB) {
    throw new Error("Token mints not found in state.json. Run 01-create-tokens.ts first.");
  }

  const baseMint = new PublicKey(state.tokenA.mint);
  const quoteMint = new PublicKey(state.tokenB.mint);

  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Base Token (${state.tokenA.symbol}): ${baseMint.toBase58()}`);
  console.log(`Quote Token (${state.tokenB.symbol}): ${quoteMint.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL\n`);

  if (balance < 1 * 1e9) {
    console.log("⚠️  Need ~1 SOL for pool creation. Requesting airdrop...");
    try {
      const sig = await connection.requestAirdrop(wallet.publicKey, 2 * 1e9);
      await connection.confirmTransaction(sig, "confirmed");
      console.log("  Airdrop received!\n");
    } catch (e) {
      console.log("  Airdrop failed (rate limited?), continuing anyway...\n");
    }
  }

  // Generate a random keypair as the marketId — seeds all pool PDAs
  const marketId = Keypair.generate();

  const { authority, nonce } = findAmmAuthority(AMM_PROGRAM_ID);
  const ammConfig = getAmmConfigAddress(AMM_PROGRAM_ID);
  const derived = derivePoolAddresses(AMM_PROGRAM_ID, marketId.publicKey);

  console.log(`Market ID:     ${marketId.publicKey.toBase58()}`);
  console.log(`AMM Authority: ${authority.toBase58()} (nonce: ${nonce})`);
  console.log(`AMM Config:    ${ammConfig.toBase58()}`);
  console.log(`AMM Pool:      ${derived.amm.toBase58()}`);
  console.log(`TargetOrders:  ${derived.targetOrders.toBase58()}`);
  console.log(`CoinVault:     ${derived.coinVault.toBase58()}`);
  console.log(`PcVault:       ${derived.pcVault.toBase58()}`);
  console.log(`LP Mint:       ${derived.lpMint.toBase58()}`);
  console.log();

  // Initial liquidity amounts: 100,000 of each token
  const initCoinAmount = 100_000n * 1_000_000n; // 100k BREAD (6 decimals)
  const initPcAmount = 100_000n * 1_000_000n;   // 100k BUTTER (6 decimals)
  const openTime = BigInt(0); // open immediately

  // Build instructions
  const poolInstructions: TransactionInstruction[] = [];

  // Get or create user token accounts
  const { address: userTokenCoin, instruction: createCoinAta } = await getOrCreateATA(
    connection, wallet.publicKey, baseMint, wallet.publicKey
  );
  if (createCoinAta) poolInstructions.push(createCoinAta);

  const { address: userTokenPc, instruction: createPcAta } = await getOrCreateATA(
    connection, wallet.publicKey, quoteMint, wallet.publicKey
  );
  if (createPcAta) poolInstructions.push(createPcAta);

  // LP token ATA — will be created by the program via ATA program CPI
  const userTokenLp = getAssociatedTokenAddressSync(derived.lpMint, wallet.publicKey, true);

  // Build Initialize2 instruction (19 accounts — no OpenBook)
  poolInstructions.push(
    buildInitialize2Instruction({
      amm: derived.amm,
      ammAuthority: authority,
      ammLpMint: derived.lpMint,
      ammCoinMint: baseMint,
      ammPcMint: quoteMint,
      ammCoinVault: derived.coinVault,
      ammPcVault: derived.pcVault,
      ammTargetOrders: derived.targetOrders,
      ammConfig,
      createFeeDestination: CREATE_POOL_FEE_DESTINATION,
      marketId: marketId.publicKey,
      userWallet: wallet.publicKey,
      userTokenCoin,
      userTokenPc,
      userTokenLp,
      nonce,
      openTime,
      initPcAmount,
      initCoinAmount,
    })
  );

  console.log("Building Initialize2 transaction...");
  const poolTx = await buildVersionedTx(connection, wallet.publicKey, poolInstructions);
  await sendAndConfirmTx(connection, poolTx, [wallet], "Initialize2 (Create Pool)");

  // Save pool state
  state.pool = {
    amm: derived.amm.toBase58(),
    marketId: marketId.publicKey.toBase58(),
    targetOrders: derived.targetOrders.toBase58(),
    coinVault: derived.coinVault.toBase58(),
    pcVault: derived.pcVault.toBase58(),
    lpMint: derived.lpMint.toBase58(),
  };
  saveState(state);

  console.log("\n═══════════════════════════════════════════");
  console.log("  Pool Created Successfully!");
  console.log("═══════════════════════════════════════════");
  console.log(`  Market ID: ${marketId.publicKey.toBase58()}`);
  console.log(`  Pool:      ${derived.amm.toBase58()}`);
  console.log(`  LP Mint:   ${derived.lpMint.toBase58()}`);
  console.log(`  Initial:   ${Number(initCoinAmount) / 1e6} ${state.tokenA.symbol} / ${Number(initPcAmount) / 1e6} ${state.tokenB.symbol}`);
  console.log(`  State saved to state.json\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
