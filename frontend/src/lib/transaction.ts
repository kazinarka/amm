import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AmmPoolData, SwapQuote, SwapSettings } from "@/types";
import {
  buildDepositInstruction,
  buildInitialize2Instruction,
  buildSwapBaseInV2Instruction,
  buildWithdrawInstruction,
} from "./amm/instruction";
import { getOrCreateATA } from "./token/ata";
import { AMM_PROGRAM_ID, PROTECTED_RPC_ENDPOINT } from "@/constants";
import { findAmmAuthority } from "./amm/pda";

export interface BuildSwapParams {
  connection: Connection;
  pool: AmmPoolData;
  quote: SwapQuote;
  inputMint: PublicKey;
  outputMint: PublicKey;
  wallet: PublicKey;
  settings: SwapSettings;
}

export interface BuildDepositParams {
  connection: Connection;
  pool: AmmPoolData;
  wallet: PublicKey;
  settings: SwapSettings;
  maxCoinAmount: bigint;
  maxPcAmount: bigint;
  baseSide: bigint;
}

export interface BuildWithdrawParams {
  connection: Connection;
  pool: AmmPoolData;
  wallet: PublicKey;
  settings: SwapSettings;
  amount: bigint;
  minCoinAmount: bigint;
  minPcAmount: bigint;
}

export interface BuildCreatePoolParams {
  connection: Connection;
  wallet: PublicKey;
  coinMint: PublicKey;
  pcMint: PublicKey;
  settings: SwapSettings;
  initCoinAmount: bigint;
  initPcAmount: bigint;
  openTime: bigint;
  marketId: PublicKey;
  derivedAddresses: {
    amm: PublicKey;
    targetOrders: PublicKey;
    coinVault: PublicKey;
    pcVault: PublicKey;
    lpMint: PublicKey;
    ammConfig: PublicKey;
    createFeeDestination: PublicKey;
  };
}

function buildSpeedInstructions(settings: SwapSettings): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];

  if (settings.speedMicroLamports > 0) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: settings.speedMicroLamports,
      })
    );
    instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
  }

  return instructions;
}

async function resolveUserTokenAccount(params: {
  connection: Connection;
  wallet: PublicKey;
  mint: PublicKey;
  instructions: TransactionInstruction[];
}) {
  const { connection, wallet, mint, instructions } = params;

  if (mint.equals(NATIVE_MINT)) {
    const { address, instruction } = await getOrCreateATA(connection, wallet, NATIVE_MINT, wallet);
    if (instruction) instructions.push(instruction);
    return address;
  }

  const { address, instruction } = await getOrCreateATA(connection, wallet, mint, wallet);
  if (instruction) instructions.push(instruction);
  return address;
}

function appendNativeFunding(
  instructions: TransactionInstruction[],
  wallet: PublicKey,
  wsolAta: PublicKey,
  amountLamports: bigint
) {
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

function buildCloseNativeAtaInstruction(wallet: PublicKey) {
  const address = getAssociatedTokenAddressSync(NATIVE_MINT, wallet, true);
  return createCloseAccountInstruction(address, wallet, wallet);
}

export function getExecutionConnection(connection: Connection, settings: SwapSettings): Connection {
  if (!settings.frontRunningProtection) return connection;
  if (!PROTECTED_RPC_ENDPOINT) {
    throw new Error("Front-running protection is enabled, but `NEXT_PUBLIC_PROTECTED_RPC_URL` is not configured");
  }
  return new Connection(PROTECTED_RPC_ENDPOINT, "confirmed");
}

/**
 * Assemble a complete swap transaction:
 *  1. Priority fee (ComputeBudgetProgram)
 *  2. wSOL wrap instructions (if SOL is the input)
 *  3. Get-or-create destination ATA
 *  4. SwapBaseInV2 instruction
 *  5. wSOL unwrap (if SOL is the output)
 *  6. Set recent blockhash + create VersionedTransaction
 */
export async function buildSwapTransaction(
  params: BuildSwapParams
): Promise<VersionedTransaction> {
  const { connection, pool, quote, wallet, settings, inputMint, outputMint } = params;

  const instructions: TransactionInstruction[] = [...buildSpeedInstructions(settings)];
  let userSource: PublicKey;

  if (!pool.coinMint.equals(inputMint) && !pool.pcMint.equals(inputMint)) {
    throw new Error("Input token does not belong to the selected pool");
  }
  if (!pool.coinMint.equals(outputMint) && !pool.pcMint.equals(outputMint)) {
    throw new Error("Output token does not belong to the selected pool");
  }

  if (inputMint.equals(NATIVE_MINT)) {
    const { address, instruction } = await getOrCreateATA(connection, wallet, NATIVE_MINT, wallet);
    if (instruction) instructions.push(instruction);
    appendNativeFunding(instructions, wallet, address, quote.amountIn);
    userSource = address;
  } else {
    userSource = await resolveUserTokenAccount({
      connection,
      wallet,
      mint: inputMint,
      instructions,
    });
  }

  const userDestination = await resolveUserTokenAccount({
    connection,
    wallet,
    mint: outputMint,
    instructions,
  });

  // Build the swap instruction
  instructions.push(
    buildSwapBaseInV2Instruction({
      amm: pool.address,
      ammAuthority: pool.authority,
      ammCoinVault: pool.coinVault,
      ammPcVault: pool.pcVault,
      userSource,
      userDestination,
      userSourceOwner: wallet,
      amountIn: quote.amountIn,
      minimumAmountOut: quote.minimumAmountOut,
    })
  );

  if (inputMint.equals(NATIVE_MINT) || outputMint.equals(NATIVE_MINT)) {
    instructions.push(buildCloseNativeAtaInstruction(wallet));
  }

  // Build the versioned transaction
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: wallet,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
}

export async function buildDepositTransaction(
  params: BuildDepositParams
): Promise<VersionedTransaction> {
  const { connection, pool, wallet, settings, maxCoinAmount, maxPcAmount, baseSide } = params;
  const instructions: TransactionInstruction[] = [...buildSpeedInstructions(settings)];

  const userTokenCoin = await resolveUserTokenAccount({
    connection,
    wallet,
    mint: pool.coinMint,
    instructions,
  });
  if (pool.coinMint.equals(NATIVE_MINT)) appendNativeFunding(instructions, wallet, userTokenCoin, maxCoinAmount);

  const userTokenPc = await resolveUserTokenAccount({
    connection,
    wallet,
    mint: pool.pcMint,
    instructions,
  });
  if (pool.pcMint.equals(NATIVE_MINT)) appendNativeFunding(instructions, wallet, userTokenPc, maxPcAmount);

  const userTokenLp = await resolveUserTokenAccount({
    connection,
    wallet,
    mint: pool.lpMint,
    instructions,
  });

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
      userOwner: wallet,
      maxCoinAmount,
      maxPcAmount,
      baseSide,
    })
  );

  if (pool.coinMint.equals(NATIVE_MINT) || pool.pcMint.equals(NATIVE_MINT)) {
    instructions.push(buildCloseNativeAtaInstruction(wallet));
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  return new VersionedTransaction(
    new TransactionMessage({ payerKey: wallet, recentBlockhash: blockhash, instructions }).compileToV0Message()
  );
}

export async function buildWithdrawTransaction(
  params: BuildWithdrawParams
): Promise<VersionedTransaction> {
  const { connection, pool, wallet, settings, amount, minCoinAmount, minPcAmount } = params;
  const instructions: TransactionInstruction[] = [...buildSpeedInstructions(settings)];

  const userTokenLp = await resolveUserTokenAccount({ connection, wallet, mint: pool.lpMint, instructions });
  const userTokenCoin = await resolveUserTokenAccount({ connection, wallet, mint: pool.coinMint, instructions });
  const userTokenPc = await resolveUserTokenAccount({ connection, wallet, mint: pool.pcMint, instructions });

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
      userOwner: wallet,
      amount,
      minCoinAmount,
      minPcAmount,
    })
  );

  if (pool.coinMint.equals(NATIVE_MINT) || pool.pcMint.equals(NATIVE_MINT)) {
    instructions.push(buildCloseNativeAtaInstruction(wallet));
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  return new VersionedTransaction(
    new TransactionMessage({ payerKey: wallet, recentBlockhash: blockhash, instructions }).compileToV0Message()
  );
}

export async function buildCreatePoolTransaction(
  params: BuildCreatePoolParams
): Promise<{ transaction: VersionedTransaction }> {
  const { connection, wallet, coinMint, pcMint, settings, initCoinAmount, initPcAmount, openTime, marketId, derivedAddresses } = params;
  const instructions: TransactionInstruction[] = [...buildSpeedInstructions(settings)];

  const { authority, nonce } = findAmmAuthority(AMM_PROGRAM_ID);
  const userTokenCoin = await resolveUserTokenAccount({
    connection,
    wallet,
    mint: coinMint,
    instructions,
  });
  const userTokenPc = await resolveUserTokenAccount({
    connection,
    wallet,
    mint: pcMint,
    instructions,
  });

  if (coinMint.equals(NATIVE_MINT)) appendNativeFunding(instructions, wallet, userTokenCoin, initCoinAmount);
  if (pcMint.equals(NATIVE_MINT)) appendNativeFunding(instructions, wallet, userTokenPc, initPcAmount);

  const userTokenLp = getAssociatedTokenAddressSync(derivedAddresses.lpMint, wallet, true);

  instructions.push(
    buildInitialize2Instruction({
      amm: derivedAddresses.amm,
      ammAuthority: authority,
      ammLpMint: derivedAddresses.lpMint,
      ammCoinMint: coinMint,
      ammPcMint: pcMint,
      ammCoinVault: derivedAddresses.coinVault,
      ammPcVault: derivedAddresses.pcVault,
      ammTargetOrders: derivedAddresses.targetOrders,
      ammConfig: derivedAddresses.ammConfig,
      createFeeDestination: derivedAddresses.createFeeDestination,
      marketId,
      userWallet: wallet,
      userTokenCoin,
      userTokenPc,
      userTokenLp,
      nonce,
      openTime,
      initPcAmount,
      initCoinAmount,
    })
  );

  if (coinMint.equals(NATIVE_MINT) || pcMint.equals(NATIVE_MINT)) {
    instructions.push(buildCloseNativeAtaInstruction(wallet));
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const transaction = new VersionedTransaction(
    new TransactionMessage({ payerKey: wallet, recentBlockhash: blockhash, instructions }).compileToV0Message()
  );

  return { transaction };
}

/**
 * Sign, send, and confirm a swap transaction.
 * Returns the transaction signature.
 */
export async function sendAndConfirmSwap(
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  transaction: VersionedTransaction,
  connection: Connection
): Promise<string> {
  const signed = await signTransaction(transaction);
  const rawTransaction = signed.serialize();

  const signature = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function signSendAndConfirmTransaction(
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  transaction: VersionedTransaction,
  connection: Connection,
  partialSigners: Keypair[] = []
): Promise<string> {
  if (partialSigners.length > 0) {
    transaction.sign(partialSigners);
  }

  return sendAndConfirmSwap(signTransaction, transaction, connection);
}
