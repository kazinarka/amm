import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AMM_PROGRAM_ID } from "@/constants";

/**
 * Portable instruction data encoder.
 *
 * Uses Uint8Array + DataView instead of Buffer so it works in every
 * environment (Node, browser, Edge, Turbopack) without relying on a
 * Buffer polyfill that may lack BigInt methods.
 */
class InstructionData {
  private readonly buf: Uint8Array;
  private readonly view: DataView;

  constructor(size: number) {
    this.buf = new Uint8Array(size);
    this.view = new DataView(this.buf.buffer);
  }

  writeU8(value: number, offset: number): void {
    this.view.setUint8(offset, value);
  }

  writeU64LE(value: bigint, offset: number): void {
    this.view.setBigUint64(offset, value, true);
  }

  toBytes(): Buffer {
    return Buffer.from(this.buf);
  }
}

/**
 * SwapBaseInV2 instruction tag = 0x10 (decimal 16).
 *
 * Data layout (17 bytes total):
 *   [0]     u8   instruction tag (0x10)
 *   [1..9]  u64  amount_in (LE)
 *   [9..17] u64  minimum_amount_out (LE)
 *
 * Accounts (8 total, no market/orderbook accounts):
 *   0. token_program       (read)
 *   1. amm                 (write)
 *   2. amm_authority       (read)
 *   3. amm_coin_vault      (write)
 *   4. amm_pc_vault        (write)
 *   5. user_source         (write)
 *   6. user_destination    (write)
 *   7. user_source_owner   (read, signer)
 */

const SWAP_BASE_IN_V2_TAG = 0x10;
const INITIALIZE2_TAG = 0x01;
const DEPOSIT_TAG = 0x03;
const WITHDRAW_TAG = 0x04;

export interface SwapBaseInV2Params {
  amm: PublicKey;
  ammAuthority: PublicKey;
  ammCoinVault: PublicKey;
  ammPcVault: PublicKey;
  userSource: PublicKey;
  userDestination: PublicKey;
  userSourceOwner: PublicKey;
  amountIn: bigint;
  minimumAmountOut: bigint;
}

export interface DepositParams {
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
}

export interface WithdrawParams {
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
}

export interface Initialize2Params {
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
}

/**
 * Build a SwapBaseInV2 transaction instruction.
 */
export function buildSwapBaseInV2Instruction(
  params: SwapBaseInV2Params
): TransactionInstruction {
  const data = new InstructionData(17);
  data.writeU8(SWAP_BASE_IN_V2_TAG, 0);
  data.writeU64LE(params.amountIn, 1);
  data.writeU64LE(params.minimumAmountOut, 9);

  const keys = [
    { pubkey: TOKEN_PROGRAM_ID,       isSigner: false, isWritable: false },
    { pubkey: params.amm,             isSigner: false, isWritable: true  },
    { pubkey: params.ammAuthority,    isSigner: false, isWritable: false },
    { pubkey: params.ammCoinVault,    isSigner: false, isWritable: true  },
    { pubkey: params.ammPcVault,      isSigner: false, isWritable: true  },
    { pubkey: params.userSource,      isSigner: false, isWritable: true  },
    { pubkey: params.userDestination, isSigner: false, isWritable: true  },
    { pubkey: params.userSourceOwner, isSigner: true,  isWritable: false },
  ];

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    keys,
    data: data.toBytes(),
  });
}

export function buildDepositInstruction(params: DepositParams): TransactionInstruction {
  const data = new InstructionData(1 + 8 + 8 + 8);
  data.writeU8(DEPOSIT_TAG, 0);
  data.writeU64LE(params.maxCoinAmount, 1);
  data.writeU64LE(params.maxPcAmount, 9);
  data.writeU64LE(params.baseSide, 17);

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    data: data.toBytes(),
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

export function buildWithdrawInstruction(params: WithdrawParams): TransactionInstruction {
  const hasMinimums = params.minCoinAmount !== undefined && params.minPcAmount !== undefined;
  const data = new InstructionData(hasMinimums ? 25 : 9);
  data.writeU8(WITHDRAW_TAG, 0);
  data.writeU64LE(params.amount, 1);
  if (hasMinimums) {
    data.writeU64LE(params.minCoinAmount!, 9);
    data.writeU64LE(params.minPcAmount!, 17);
  }

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    data: data.toBytes(),
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

export function buildInitialize2Instruction(params: Initialize2Params): TransactionInstruction {
  const data = new InstructionData(1 + 1 + 8 + 8 + 8);
  data.writeU8(INITIALIZE2_TAG, 0);
  data.writeU8(params.nonce, 1);
  data.writeU64LE(params.openTime, 2);
  data.writeU64LE(params.initPcAmount, 10);
  data.writeU64LE(params.initCoinAmount, 18);

  return new TransactionInstruction({
    programId: AMM_PROGRAM_ID,
    data: data.toBytes(),
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
