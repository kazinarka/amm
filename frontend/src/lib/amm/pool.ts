import { Connection, PublicKey } from "@solana/web3.js";
import { AccountLayout } from "@solana/spl-token";
import { AmmPoolData } from "@/types";
import { AMM_PROGRAM_ID } from "@/constants";
import { decodeAmmInfo, AMM_INFO_SIZE } from "./layout";
import { getAmmAuthority } from "./pda";

/**
 * Fetch and decode an AMM pool from on-chain data.
 *
 * 1. Reads the AmmInfo account and decodes the binary layout
 * 2. Reads both vault token accounts for current balances
 * 3. Derives the authority PDA
 * 4. Returns a combined AmmPoolData object
 */
export async function fetchAmmPool(
  connection: Connection,
  poolAddress: PublicKey
): Promise<AmmPoolData> {
  // 1. Fetch the AMM account
  const ammAccountInfo = await connection.getAccountInfo(poolAddress);
  if (!ammAccountInfo) {
    throw new Error(`AMM account not found: ${poolAddress.toBase58()}`);
  }
  if (ammAccountInfo.data.length < AMM_INFO_SIZE) {
    throw new Error(
      `Invalid AMM account data size: ${ammAccountInfo.data.length} (expected ${AMM_INFO_SIZE})`
    );
  }

  const decoded = decodeAmmInfo(ammAccountInfo.data);

  // Validate the account is owned by the AMM program
  if (!ammAccountInfo.owner.equals(AMM_PROGRAM_ID)) {
    throw new Error(
      `Account ${poolAddress.toBase58()} is not owned by AMM program ${AMM_PROGRAM_ID.toBase58()}`
    );
  }

  // 2. Fetch both vault token accounts in a single RPC call
  const vaultAccounts = await connection.getMultipleAccountsInfo([
    decoded.coinVault,
    decoded.pcVault,
  ]);

  const coinVaultAccount = vaultAccounts[0];
  const pcVaultAccount = vaultAccounts[1];

  if (!coinVaultAccount || !pcVaultAccount) {
    throw new Error("Failed to fetch vault token accounts");
  }

  const coinVaultData = AccountLayout.decode(coinVaultAccount.data);
  const pcVaultData = AccountLayout.decode(pcVaultAccount.data);

  const coinVaultBalance = coinVaultData.amount;
  const pcVaultBalance = pcVaultData.amount;

  // 3. Derive authority PDA
  const authority = getAmmAuthority(AMM_PROGRAM_ID, decoded.nonce);

  // 4. Assemble the complete pool data
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
    coinVaultBalance,
    pcVaultBalance,
  };
}

/**
 * Quick validation: check if a pubkey is a valid AMM pool account.
 * Returns true if the account exists, is owned by the program, and has the right size.
 */
export async function isValidAmmPool(
  connection: Connection,
  address: PublicKey
): Promise<boolean> {
  try {
    const info = await connection.getAccountInfo(address);
    return (
      !!info &&
      info.data.length >= AMM_INFO_SIZE &&
      info.owner.equals(AMM_PROGRAM_ID)
    );
  } catch {
    return false;
  }
}
