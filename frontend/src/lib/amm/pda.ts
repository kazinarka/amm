import { PublicKey } from "@solana/web3.js";
import {
  AMM_ASSOCIATED_SEED,
  AMM_CONFIG_SEED,
  AUTHORITY_AMM_SEED,
  COIN_VAULT_ASSOCIATED_SEED,
  LP_MINT_ASSOCIATED_SEED,
  PC_VAULT_ASSOCIATED_SEED,
  TARGET_ASSOCIATED_SEED,
} from "@/constants";

/**
 * Derive the AMM authority PDA from the nonce stored in AmmInfo.
 *
 * The program uses:
 *   `create_program_address(&[b"amm authority", &[nonce]], program_id)`
 */
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
  return PublicKey.findProgramAddressSync([Buffer.from(AMM_CONFIG_SEED)], programId)[0];
}

export function deriveAssociatedAddress(
  programId: PublicKey,
  marketId: PublicKey,
  seed: string
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [programId.toBuffer(), marketId.toBuffer(), Buffer.from(seed)],
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
