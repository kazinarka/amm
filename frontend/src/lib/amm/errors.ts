/**
 * Map AMM program error codes to user-friendly messages.
 *
 * Error codes are the enum discriminant of `AmmError` in the program.
 * On-chain these surface as `ProgramError::Custom(code)`.
 */

const AMM_ERROR_MAP: Record<number, string> = {
  0:  "Account already in use",
  1:  "Invalid program address",
  22: "Pool is currently disabled",
  29: "Invalid input amount — amount must be greater than zero",
  30: "Slippage exceeded — try increasing your slippage tolerance",
  31: "Exchange rate calculation failed",
  32: "Calculation underflow",
  33: "Calculation overflow",
  34: "Multiplication overflow",
  35: "Division overflow",
  36: "Pool has empty funds",
  40: "Insufficient funds — check your wallet balance",
  42: "Invalid user token account — token doesn't match pool",
  48: "Invalid fee configuration",
  50: "Cannot mint zero LP tokens — increase your deposit amount",
  57: "Initial LP amount is too small — increase initial token amounts",
};

/**
 * Try to extract a human-friendly error message from a transaction error.
 *
 * Handles:
 * - Solana `SendTransactionError` with `InstructionError` logs
 * - Custom program error codes from the AMM
 * - Generic fallback
 */
export function parseSwapError(err: unknown): string {
  if (!err) return "Unknown error";

  const message = err instanceof Error ? err.message : String(err);

  // Try to extract custom program error code
  // Pattern: "custom program error: 0x1e" or "Custom(30)"
  const hexMatch = message.match(/custom program error:\s*0x([0-9a-fA-F]+)/i);
  if (hexMatch) {
    const code = parseInt(hexMatch[1], 16);
    return AMM_ERROR_MAP[code] || `Program error (code ${code})`;
  }

  const decMatch = message.match(/Custom\((\d+)\)/);
  if (decMatch) {
    const code = parseInt(decMatch[1], 10);
    return AMM_ERROR_MAP[code] || `Program error (code ${code})`;
  }

  // Common wallet/RPC errors
  if (message.includes("User rejected")) {
    return "Transaction cancelled by user";
  }
  if (message.includes("Blockhash not found") || message.includes("block height exceeded")) {
    return "Transaction expired — please try again";
  }
  if (message.includes("insufficient lamports") || message.includes("Insufficient funds")) {
    return "Insufficient SOL balance for this transaction";
  }
  // SPL Token program error 0x1 = TokenError::InsufficientFunds
  if (/custom program error:\s*0x1\b/i.test(message)) {
    return "Insufficient token balance in your wallet";
  }

  // Truncate long messages
  if (message.length > 120) {
    return message.slice(0, 117) + "...";
  }

  return message;
}
