import {
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

/**
 * Get the ATA address for a given mint and owner, and return a create
 * instruction if the account doesn't exist yet.
 */
export async function getOrCreateATA(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey
): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
  const address = getAssociatedTokenAddressSync(
    mint,
    owner,
    true, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const account = await connection.getAccountInfo(address);

  if (account) {
    return { address };
  }

  const instruction = createAssociatedTokenAccountInstruction(
    payer,
    address,
    owner,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return { address, instruction };
}
