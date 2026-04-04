import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
} from "@solana/spl-token";

/**
 * Build instructions to wrap SOL into a wSOL ATA.
 *
 * Strategy: create wSOL ATA if needed → transfer SOL → syncNative.
 * After the swap, the caller should add a closeAccount instruction to unwrap.
 */
export function buildWrapSolInstructions(
  owner: PublicKey,
  amountLamports: bigint
): {
  wsolAta: PublicKey;
  instructions: TransactionInstruction[];
} {
  const wsolAta = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    owner,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const instructions: TransactionInstruction[] = [];

  // Create the wSOL ATA if it doesn't exist (idempotent — the create instruction
  // will be a no-op at runtime if the account already exists, but we include it
  // to be safe; the caller should check existence beforehand for gas savings)
  instructions.push(
    createAssociatedTokenAccountInstruction(
      owner,
      wsolAta,
      owner,
      NATIVE_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // Transfer SOL into the wSOL ATA
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: wsolAta,
      lamports: amountLamports,
    })
  );

  // Sync the native balance so SPL Token recognizes the deposited SOL
  instructions.push(createSyncNativeInstruction(wsolAta, TOKEN_PROGRAM_ID));

  return { wsolAta, instructions };
}

/**
 * Build an instruction to close the wSOL ATA back to SOL.
 * This unwraps any remaining wSOL and returns the rent + balance as SOL.
 */
export function buildUnwrapSolInstruction(
  owner: PublicKey
): TransactionInstruction {
  const wsolAta = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    owner,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return createCloseAccountInstruction(
    wsolAta,
    owner, // destination for remaining lamports
    owner, // authority
    [],
    TOKEN_PROGRAM_ID
  );
}
