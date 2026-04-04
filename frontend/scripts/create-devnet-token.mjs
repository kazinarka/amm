import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const registryPath = path.join(projectRoot, "src/constants/customTokens.json");
const DEVNET_RPC = "https://api.devnet.solana.com";

function printHelp() {
  console.log(`Create a devnet SPL token and optionally register it in the frontend.\n\nUsage:\n  npm run token:create:devnet -- --symbol BREAD --name \"Bread Devnet\" --decimals 6 --amount 1000000\n\nOptions:\n  --symbol <value>       Token symbol (required)\n  --name <value>         Token name (required)\n  --decimals <value>     Mint decimals, default 6\n  --amount <value>       Human-readable mint amount, default 1000000\n  --recipient <pubkey>   Mint recipient, defaults to payer wallet\n  --keypair <path>       Solana keypair file, defaults to ~/.config/solana/id.json\n  --rpc <url>            Devnet RPC URL, defaults to https://api.devnet.solana.com\n  --logo-uri <url>       Optional logo URI for the frontend token picker\n  --no-register          Skip adding the token to src/constants/customTokens.json\n  --help                 Show this message\n`);
}

function parseArgs(argv) {
  const options = {
    decimals: "6",
    amount: "1000000",
    rpc: DEVNET_RPC,
    register: true,
    logoUri: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--no-register") {
      options.register = false;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    options[key] = value;
    index += 1;
  }

  return options;
}

function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === "~") return os.homedir();
  if (inputPath.startsWith("~/")) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

async function loadKeypair(keypairPath) {
  const resolvedPath = expandHome(keypairPath || "~/.config/solana/id.json");
  const raw = await fs.readFile(resolvedPath, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(raw));
  return { keypair: Keypair.fromSecretKey(secretKey), resolvedPath };
}

function toBaseUnits(amount, decimals) {
  const normalized = String(amount).trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const paddedFraction = (fractionPart + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");
}

async function updateRegistry(entry) {
  const currentRaw = await fs.readFile(registryPath, "utf8");
  const current = JSON.parse(currentRaw);
  if (!Array.isArray(current)) {
    throw new Error("customTokens.json must contain an array");
  }

  const next = [
    ...current.filter((token) => token?.mint !== entry.mint),
    entry,
  ].sort((left, right) => String(left.symbol).localeCompare(String(right.symbol)));

  await fs.writeFile(registryPath, `${JSON.stringify(next, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.symbol || !options.name) {
    printHelp();
    throw new Error("--symbol and --name are required");
  }

  const decimals = Number.parseInt(options.decimals, 10);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error(`Invalid decimals: ${options.decimals}`);
  }

  const amount = toBaseUnits(options.amount, decimals);
  const connection = new Connection(options.rpc, "confirmed");
  const { keypair: payer, resolvedPath } = await loadKeypair(options.keypair);
  const recipient = new PublicKey(options.recipient || payer.publicKey);

  const mint = await createMint(connection, payer, payer.publicKey, null, decimals);
  const recipientAta = await getOrCreateAssociatedTokenAccount(connection, payer, mint, recipient, true);
  const signature = await mintTo(connection, payer, mint, recipientAta.address, payer.publicKey, amount);

  const entry = {
    symbol: options.symbol,
    name: options.name,
    mint: mint.toBase58(),
    decimals,
    logoURI: options.logoUri || "",
    network: "devnet",
  };

  if (options.register) {
    await updateRegistry(entry);
  }

  console.log(JSON.stringify({
    rpc: options.rpc,
    payer: payer.publicKey.toBase58(),
    keypairPath: resolvedPath,
    mint: mint.toBase58(),
    recipient: recipient.toBase58(),
    recipientAta: recipientAta.address.toBase58(),
    mintedAmountRaw: amount.toString(),
    mintedAmount: options.amount,
    register: options.register,
    registryPath: options.register ? registryPath : null,
    signature,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
