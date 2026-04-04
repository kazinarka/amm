/**
 * Shared utilities for devnet test scripts.
 *
 * Mirrors the frontend code exactly:
 *   - PDA derivation (pda.ts)
 *   - AmmInfo binary decoder (layout.ts)
 *   - Instruction builders (instruction.ts)
 *   - Transaction building helpers (transaction.ts)
 */

import fs from "fs";
import path from "path";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  AccountLayout,
  ACCOUNT_SIZE,
  createInitializeAccountInstruction,
} from "@solana/spl-token";

// ────────────────────────────────────────────────────────
// Constants — matching frontend/src/constants/index.ts
// ────────────────────────────────────────────────────────

export const AMM_PROGRAM_ID = new PublicKey("BPsxWiSAzFd3LoioiMCAtMCzs5Rj54Sr61krVqbpko4o");
export const CREATE_POOL_FEE_DESTINATION = new PublicKey("2fYQC1gCTuyNkEZgAUwWeYXrdhUJduWeJYsdDwQnqhdB");

export const AUTHORITY_AMM_SEED = "amm authority";
export const AMM_CONFIG_SEED = "amm_config_account_seed";
export const AMM_ASSOCIATED_SEED = "amm_associated_seed";
export const TARGET_ASSOCIATED_SEED = "target_associated_seed";
export const COIN_VAULT_ASSOCIATED_SEED = "coin_vault_associated_seed";
export const PC_VAULT_ASSOCIATED_SEED = "pc_vault_associated_seed";
export const LP_MINT_ASSOCIATED_SEED = "lp_mint_associated_seed";

export const DEVNET_RPC = "https://api.devnet.solana.com";

// State file to share addresses between scripts
const STATE_FILE = path.join(__dirname, "..", "state.json");

// ────────────────────────────────────────────────────────
// State persistence — share addresses between scripts
// ────────────────────────────────────────────────────────

export interface ScriptState {
  tokenA?: { mint: string; decimals: number; symbol: string };
  tokenB?: { mint: string; decimals: number; symbol: string };
  pool?: {
    amm: string;
    marketId: string;
    targetOrders: string;
    coinVault: string;
    pcVault: string;
    lpMint: string;
  };
}

export function loadState(): ScriptState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

export function saveState(state: ScriptState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ────────────────────────────────────────────────────────
// Connection & Wallet
// ────────────────────────────────────────────────────────

export function getConnection(): Connection {
  return new Connection(DEVNET_RPC, "confirmed");
}

export function loadWallet(keypairPath?: string): Keypair {
  const resolvedPath = keypairPath || path.join(
    process.env.HOME || process.env.USERPROFILE || "~",
    ".config",
    "solana",
    "id.json"
  );
  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function loadKeypairFromProjectKeys(name: string): Keypair {
  const filePath = path.join(__dirname, "..", "..", "keys", name);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ────────────────────────────────────────────────────────
// PDA Derivation — mirrors frontend/src/lib/amm/pda.ts
// ────────────────────────────────────────────────────────

export function getAmmAuthority(
  programId: PublicKey,
  nonce: number
): PublicKey {
  return PublicKey.createProgramAddressSync(
    [Buffer.from(AUTHORITY_AMM_SEED), Buffer.from([nonce])],
    programId
  );
}

export function findAmmAuthority(programId: PublicKey): { authority: PublicKey; nonce: number } {
  const [authority, nonce] = PublicKey.findProgramAddressSync(
    [Buffer.from(AUTHORITY_AMM_SEED)],
    programId
  );
  return { authority, nonce };
}

export function getAmmConfigAddress(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(AMM_CONFIG_SEED)],
    programId
  )[0];
}

export function deriveAssociatedAddress(
  programId: PublicKey,
  market: PublicKey,
  seed: string
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [programId.toBuffer(), market.toBuffer(), Buffer.from(seed)],
    programId
  )[0];
}

export function derivePoolAddresses(programId: PublicKey, marketId: PublicKey) {
  return {
    amm: deriveAssociatedAddress(programId, marketId, AMM_ASSOCIATED_SEED),
    targetOrders: deriveAssociatedAddress(programId, marketId, TARGET_ASSOCIATED_SEED),
    coinVault: deriveAssociatedAddress(programId, marketId, COIN_VAULT_ASSOCIATED_SEED),
    pcVault: deriveAssociatedAddress(programId, marketId, PC_VAULT_ASSOCIATED_SEED),
    lpMint: deriveAssociatedAddress(programId, marketId, LP_MINT_ASSOCIATED_SEED),
  };
}

// ────────────────────────────────────────────────────────
// AmmInfo Layout Decoder — mirrors frontend/src/lib/amm/layout.ts
// ────────────────────────────────────────────────────────

export const AMM_INFO_SIZE = 752;

export interface DecodedAmmInfo {
  status: number;
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
  marketId: PublicKey;
  targetOrders: PublicKey;
  ammOwner: PublicKey;
  lpAmount: bigint;
}

function readU64(dv: DataView, offset: number): bigint {
  return dv.getBigUint64(offset, true);
}

function readPubkey(buf: Uint8Array, offset: number): PublicKey {
  return new PublicKey(buf.slice(offset, offset + 32));
}

export function decodeAmmInfo(data: Buffer | Uint8Array): DecodedAmmInfo {
  if (data.length < AMM_INFO_SIZE) {
    throw new Error(`AmmInfo data too short: expected ${AMM_INFO_SIZE} bytes, got ${data.length}`);
  }
  const buf = new Uint8Array(data);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    status: Number(readU64(dv, 0)),
    nonce: Number(readU64(dv, 8)),
    coinDecimals: Number(readU64(dv, 32)),
    pcDecimals: Number(readU64(dv, 40)),
    swapFeeNumerator: readU64(dv, 176),
    swapFeeDenominator: readU64(dv, 184),
    needTakePnlCoin: readU64(dv, 192),
    needTakePnlPc: readU64(dv, 200),
    coinVault: readPubkey(buf, 336),
    pcVault: readPubkey(buf, 368),
    coinMint: readPubkey(buf, 400),
    pcMint: readPubkey(buf, 432),
    lpMint: readPubkey(buf, 464),
    marketId: readPubkey(buf, 528),
    targetOrders: readPubkey(buf, 592),
    ammOwner: readPubkey(buf, 688),
    lpAmount: readU64(dv, 720),
  };
}

// ────────────────────────────────────────────────────────
// Pool data fetcher — mirrors frontend/src/lib/amm/pool.ts
// ────────────────────────────────────────────────────────

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
  coinVaultBalance: bigint;
  pcVaultBalance: bigint;
}

export async function fetchAmmPool(
  connection: Connection,
  poolAddress: PublicKey
): Promise<AmmPoolData> {
  const ammAccountInfo = await connection.getAccountInfo(poolAddress);
  if (!ammAccountInfo) throw new Error(`AMM account not found: ${poolAddress.toBase58()}`);
  if (ammAccountInfo.data.length < AMM_INFO_SIZE) {
    throw new Error(`Invalid AMM account data size: ${ammAccountInfo.data.length}`);
  }
  const decoded = decodeAmmInfo(ammAccountInfo.data);

  const vaultAccounts = await connection.getMultipleAccountsInfo([decoded.coinVault, decoded.pcVault]);
  const coinVaultAccount = vaultAccounts[0];
  const pcVaultAccount = vaultAccounts[1];
  if (!coinVaultAccount || !pcVaultAccount) throw new Error("Failed to fetch vault token accounts");

  const coinVaultData = AccountLayout.decode(coinVaultAccount.data);
  const pcVaultData = AccountLayout.decode(pcVaultAccount.data);

  const authority = getAmmAuthority(AMM_PROGRAM_ID, decoded.nonce);

  return {
    address: poolAddress,
    nonce: decoded.nonce,
    coinDecimals: decoded.coinDecimals,
    pcDecimals: decoded.pcDecimals,
    swapFeeNumerator: decoded.swapFeeNumerator,
    swapFeeDenominator: decoded.swapFeeDenominator,
    needTakePnlCoin: decoded.needTakePnlCoin,
    needTakePnlPc: decoded.needTakePnlPc,
    coinVault: decoded.coinVault,
    pcVault: decoded.pcVault,
    coinMint: decoded.coinMint,
    pcMint: decoded.pcMint,
    lpMint: decoded.lpMint,
    authority,
    marketId: decoded.marketId,
    targetOrders: decoded.targetOrders,
    ammOwner: decoded.ammOwner,
    lpAmount: decoded.lpAmount,
    coinVaultBalance: coinVaultData.amount,
    pcVaultBalance: pcVaultData.amount,
  };
}

// ────────────────────────────────────────────────────────
// Instruction Builders — mirrors frontend/src/lib/amm/instruction.ts
// ────────────────────────────────────────────────────────

const SWAP_BASE_IN_V2_TAG = 0x10;
const INITIALIZE2_TAG = 0x01;
const DEPOSIT_TAG = 0x03;
const WITHDRAW_TAG = 0x04;
const CREATE_CONFIG_TAG = 0x0e;
const UPDATE_CONFIG_TAG = 0x0f;

export function buildSwapBaseInV2Instruction(params: {
  amm: PublicKey;
  ammAuthority: PublicKey;
  ammCoinVault: PublicKey;
  ammPcVault: PublicKey;
  userSource: PublicKey;
  userDestination: PublicKey;
  userSourceOwner: PublicKey;
  amountIn: bigint;
  minimumAmountOut: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(17);
  data.writeUInt8(SWAP_BASE_IN_V2_TAG, 0);
  data.writeBigUInt64LE(params.amountIn, 1);
  data.writeBigUInt64LE(params.minimumAmountOut, 9);

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    keys: [
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: params.amm, isSigner: false, isWritable: true },
      { pubkey: params.ammAuthority, isSigner: false, isWritable: false },
      { pubkey: params.ammCoinVault, isSigner: false, isWritable: true },
      { pubkey: params.ammPcVault, isSigner: false, isWritable: true },
      { pubkey: params.userSource, isSigner: false, isWritable: true },
      { pubkey: params.userDestination, isSigner: false, isWritable: true },
      { pubkey: params.userSourceOwner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

export function buildDepositInstruction(params: {
  amm: PublicKey;
  ammAuthority: PublicKey;
  ammTargetOrders: PublicKey;
  ammLpMint: PublicKey;
  ammCoinVault: PublicKey;
  ammPcVault: PublicKey;
  userTokenCoin: PublicKey;
  userTokenPc: PublicKey;
  userTokenLp: PublicKey;
  userOwner: PublicKey;
  maxCoinAmount: bigint;
  maxPcAmount: bigint;
  baseSide: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(1 + 8 + 8 + 8);
  data.writeUInt8(DEPOSIT_TAG, 0);
  data.writeBigUInt64LE(params.maxCoinAmount, 1);
  data.writeBigUInt64LE(params.maxPcAmount, 9);
  data.writeBigUInt64LE(params.baseSide, 17);

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    data,
    keys: [
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: params.amm, isSigner: false, isWritable: true },
      { pubkey: params.ammAuthority, isSigner: false, isWritable: false },
      { pubkey: params.ammTargetOrders, isSigner: false, isWritable: true },
      { pubkey: params.ammLpMint, isSigner: false, isWritable: true },
      { pubkey: params.ammCoinVault, isSigner: false, isWritable: true },
      { pubkey: params.ammPcVault, isSigner: false, isWritable: true },
      { pubkey: params.userTokenCoin, isSigner: false, isWritable: true },
      { pubkey: params.userTokenPc, isSigner: false, isWritable: true },
      { pubkey: params.userTokenLp, isSigner: false, isWritable: true },
      { pubkey: params.userOwner, isSigner: true, isWritable: false },
    ],
  });
}

export function buildWithdrawInstruction(params: {
  amm: PublicKey;
  ammAuthority: PublicKey;
  ammTargetOrders: PublicKey;
  ammLpMint: PublicKey;
  ammCoinVault: PublicKey;
  ammPcVault: PublicKey;
  userTokenLp: PublicKey;
  userTokenCoin: PublicKey;
  userTokenPc: PublicKey;
  userOwner: PublicKey;
  amount: bigint;
  minCoinAmount?: bigint;
  minPcAmount?: bigint;
}): TransactionInstruction {
  const hasMinimums = params.minCoinAmount !== undefined && params.minPcAmount !== undefined;
  const data = Buffer.alloc(hasMinimums ? 25 : 9);
  data.writeUInt8(WITHDRAW_TAG, 0);
  data.writeBigUInt64LE(params.amount, 1);
  if (hasMinimums) {
    data.writeBigUInt64LE(params.minCoinAmount!, 9);
    data.writeBigUInt64LE(params.minPcAmount!, 17);
  }

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    data,
    keys: [
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: params.amm, isSigner: false, isWritable: true },
      { pubkey: params.ammAuthority, isSigner: false, isWritable: false },
      { pubkey: params.ammTargetOrders, isSigner: false, isWritable: true },
      { pubkey: params.ammLpMint, isSigner: false, isWritable: true },
      { pubkey: params.ammCoinVault, isSigner: false, isWritable: true },
      { pubkey: params.ammPcVault, isSigner: false, isWritable: true },
      { pubkey: params.userTokenLp, isSigner: false, isWritable: true },
      { pubkey: params.userTokenCoin, isSigner: false, isWritable: true },
      { pubkey: params.userTokenPc, isSigner: false, isWritable: true },
      { pubkey: params.userOwner, isSigner: true, isWritable: false },
    ],
  });
}

export function buildInitialize2Instruction(params: {
  amm: PublicKey;
  ammAuthority: PublicKey;
  ammLpMint: PublicKey;
  ammCoinMint: PublicKey;
  ammPcMint: PublicKey;
  ammCoinVault: PublicKey;
  ammPcVault: PublicKey;
  ammTargetOrders: PublicKey;
  ammConfig: PublicKey;
  createFeeDestination: PublicKey;
  marketId: PublicKey;
  userWallet: PublicKey;
  userTokenCoin: PublicKey;
  userTokenPc: PublicKey;
  userTokenLp: PublicKey;
  nonce: number;
  openTime: bigint;
  initPcAmount: bigint;
  initCoinAmount: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(1 + 1 + 8 + 8 + 8);
  data.writeUInt8(INITIALIZE2_TAG, 0);
  data.writeUInt8(params.nonce, 1);
  data.writeBigUInt64LE(params.openTime, 2);
  data.writeBigUInt64LE(params.initPcAmount, 10);
  data.writeBigUInt64LE(params.initCoinAmount, 18);

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    data,
    keys: [
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
      { pubkey: params.amm, isSigner: false, isWritable: true },
      { pubkey: params.ammAuthority, isSigner: false, isWritable: false },
      { pubkey: params.ammLpMint, isSigner: false, isWritable: true },
      { pubkey: params.ammCoinMint, isSigner: false, isWritable: false },
      { pubkey: params.ammPcMint, isSigner: false, isWritable: false },
      { pubkey: params.ammCoinVault, isSigner: false, isWritable: true },
      { pubkey: params.ammPcVault, isSigner: false, isWritable: true },
      { pubkey: params.ammTargetOrders, isSigner: false, isWritable: true },
      { pubkey: params.ammConfig, isSigner: false, isWritable: false },
      { pubkey: params.createFeeDestination, isSigner: false, isWritable: true },
      { pubkey: params.marketId, isSigner: false, isWritable: false },
      { pubkey: params.userWallet, isSigner: true, isWritable: true },
      { pubkey: params.userTokenCoin, isSigner: false, isWritable: true },
      { pubkey: params.userTokenPc, isSigner: false, isWritable: true },
      { pubkey: params.userTokenLp, isSigner: false, isWritable: true },
    ],
  });
}

export function buildCreateConfigInstruction(params: {
  admin: PublicKey;
  ammConfig: PublicKey;
  pnlOwner: PublicKey;
}): TransactionInstruction {
  const data = Buffer.alloc(1);
  data.writeUInt8(CREATE_CONFIG_TAG, 0);

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    data,
    keys: [
      { pubkey: params.admin, isSigner: true, isWritable: true },
      { pubkey: params.ammConfig, isSigner: false, isWritable: true },
      { pubkey: params.pnlOwner, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
    ],
  });
}

// ────────────────────────────────────────────────────────
// Transaction helpers
// ────────────────────────────────────────────────────────

export async function sendAndConfirmTx(
  connection: Connection,
  tx: VersionedTransaction,
  signers: Keypair[],
  label: string
): Promise<string> {
  tx.sign(signers);
  const raw = tx.serialize();
  console.log(`  Sending ${label}...`);

  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 5,
  });
  console.log(`  Signature: ${signature}`);
  console.log(`  Confirming...`);

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed"
  );

  console.log(`  ✅ ${label} confirmed!`);
  console.log(`  https://solscan.io/tx/${signature}?cluster=devnet`);
  return signature;
}

export async function buildVersionedTx(
  connection: Connection,
  payer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<VersionedTransaction> {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  return new VersionedTransaction(messageV0);
}

export async function getOrCreateATA(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey
): Promise<{ address: PublicKey; instruction: TransactionInstruction | null }> {
  const address = getAssociatedTokenAddressSync(mint, owner, true);
  try {
    await getAccount(connection, address);
    return { address, instruction: null };
  } catch {
    return {
      address,
      instruction: createAssociatedTokenAccountInstruction(payer, address, owner, mint),
    };
  }
}

export function buildSpeedInstructions(microLamports: number = 100_000): TransactionInstruction[] {
  if (microLamports <= 0) return [];
  return [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
  ];
}

export function appendNativeFunding(
  instructions: TransactionInstruction[],
  wallet: PublicKey,
  wsolAta: PublicKey,
  amountLamports: bigint
): void {
  if (amountLamports <= 0n) return;
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: wsolAta,
      lamports: Number(amountLamports),
    })
  );
  instructions.push(createSyncNativeInstruction(wsolAta));
}

export function buildCloseNativeAtaInstruction(wallet: PublicKey): TransactionInstruction {
  const address = getAssociatedTokenAddressSync(NATIVE_MINT, wallet, true);
  return createCloseAccountInstruction(address, wallet, wallet);
}

// ────────────────────────────────────────────────────────
// Swap quote — mirrors frontend/src/lib/amm/quote.ts
// ────────────────────────────────────────────────────────

export type SwapDirection = "coin_to_pc" | "pc_to_coin";

function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("Division by zero");
  return (a + b - 1n) / b;
}

export function quoteSwapBaseIn(
  pool: AmmPoolData,
  amountInRaw: bigint,
  direction: SwapDirection,
  slippageBps: number
) {
  if (amountInRaw <= 0n) {
    return { amountIn: 0n, amountOut: 0n, minimumAmountOut: 0n, fee: 0n };
  }
  const effectiveCoin = pool.coinVaultBalance - pool.needTakePnlCoin;
  const effectivePc = pool.pcVaultBalance - pool.needTakePnlPc;

  const fee = ceilDiv(amountInRaw * pool.swapFeeNumerator, pool.swapFeeDenominator);
  const amountInAfterFee = amountInRaw - fee;

  let amountOut: bigint;
  if (direction === "coin_to_pc") {
    amountOut = (effectivePc * amountInAfterFee) / (effectiveCoin + amountInAfterFee);
  } else {
    amountOut = (effectiveCoin * amountInAfterFee) / (effectivePc + amountInAfterFee);
  }

  const minimumAmountOut = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

  return { amountIn: amountInRaw, amountOut, minimumAmountOut, fee };
}

export { ACCOUNT_SIZE, NATIVE_MINT, TOKEN_PROGRAM_ID };
export { createInitializeAccountInstruction };
