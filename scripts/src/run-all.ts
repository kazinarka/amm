/**
 * run-all.ts
 *
 * Runs all devnet test scripts in sequence:
 *   1. Create tokens
 *   2. Create config account
 *   3. Create OpenBook market + AMM pool
 *   4. Swap
 *   5. Deposit liquidity
 *   6. Withdraw liquidity
 */

import { execSync } from "child_process";
import path from "path";

const scripts = [
  { file: "01-create-tokens.ts", label: "Create Tokens" },
  { file: "02-create-config.ts", label: "Create Config" },
  { file: "03-create-pool.ts", label: "Create Pool" },
  { file: "04-swap.ts", label: "Swap" },
  { file: "05-deposit.ts", label: "Deposit" },
  { file: "06-withdraw.ts", label: "Withdraw" },
];

async function main() {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║  AMM Devnet E2E Test Suite                ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  const start = Date.now();

  for (const script of scripts) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`  Running: ${script.label}`);
    console.log(`${"=".repeat(50)}\n`);

    try {
      execSync(`npx ts-node ${path.join(__dirname, script.file)}`, {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
      });
    } catch (err) {
      console.error(`\n❌ FAILED: ${script.label}`);
      process.exit(1);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║  ✅ All Tests Passed!                     ║");
  console.log(`║  Total time: ${elapsed}s${" ".repeat(Math.max(0, 28 - elapsed.length))}║`);
  console.log("╚═══════════════════════════════════════════╝\n");
}

main();
