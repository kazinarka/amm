import { PublicKey } from "@solana/web3.js";
import { Token, PoolRegistryEntry } from "@/types";
import customTokensRaw from "./customTokens.json";

const DEFAULT_DEVNET_PROGRAM_ID = "BPsxWiSAzFd3LoioiMCAtMCzs5Rj54Sr61krVqbpko4o";
const DEFAULT_MAINNET_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";

function parsePoolRegistry(rawValue?: string): PoolRegistryEntry[] | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return null;

    return parsed.filter((entry): entry is PoolRegistryEntry => {
      if (!entry || typeof entry !== "object") return false;

      return typeof entry.poolId === "string"
        && typeof entry.symbol === "string"
        && typeof entry.name === "string"
        && typeof entry.coinMint === "string"
        && (entry.logoURI === undefined || typeof entry.logoURI === "string");
    });
  } catch {
    return null;
  }
}

type RegisteredToken = Token & {
  network?: "devnet" | "mainnet";
};

function parseCustomTokens(rawValue: unknown): RegisteredToken[] {
  if (!Array.isArray(rawValue)) return [];

  return rawValue.filter((entry): entry is RegisteredToken => {
    if (!entry || typeof entry !== "object") return false;

    const token = entry as Partial<RegisteredToken>;
    return typeof token.symbol === "string"
      && typeof token.name === "string"
      && typeof token.mint === "string"
      && typeof token.decimals === "number"
      && typeof token.logoURI === "string"
      && (token.network === undefined || token.network === "devnet" || token.network === "mainnet");
  });
}

function dedupeTokens(tokens: Token[]) {
  const byMint = new Map<string, Token>();
  for (const token of tokens) {
    byMint.set(token.mint, token);
  }
  return Array.from(byMint.values());
}

/* ── Network ── */
export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "devnet") as "devnet" | "mainnet";

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (NETWORK === "devnet"
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com");

export const PROTECTED_RPC_ENDPOINT = process.env.NEXT_PUBLIC_PROTECTED_RPC_URL || null;
export const READ_RPC_ENDPOINT = PROTECTED_RPC_ENDPOINT || RPC_ENDPOINT;

/* ── Program IDs ── */
export const AMM_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_AMM_PROGRAM_ID
    || (NETWORK === "devnet" ? DEFAULT_DEVNET_PROGRAM_ID : DEFAULT_MAINNET_PROGRAM_ID)
);

/* ── PDA seed used by the program ── */
export const AUTHORITY_AMM_SEED = "amm authority";
export const AMM_CONFIG_SEED = "amm_config_account_seed";
export const AMM_ASSOCIATED_SEED = "amm_associated_seed";
export const TARGET_ASSOCIATED_SEED = "target_associated_seed";
export const COIN_VAULT_ASSOCIATED_SEED = "coin_vault_associated_seed";
export const PC_VAULT_ASSOCIATED_SEED = "pc_vault_associated_seed";
export const LP_MINT_ASSOCIATED_SEED = "lp_mint_associated_seed";

export const CREATE_POOL_FEE_DESTINATION = new PublicKey(
  "2fYQC1gCTuyNkEZgAUwWeYXrdhUJduWeJYsdDwQnqhdB"
);

/* ── Well-known mints ── */
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export const NATIVE_SOL_MINT = new PublicKey(SOL_MINT);

/* ── Defaults ── */
export const DEFAULT_SLIPPAGE_BPS = 50;           // 0.5%
export const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 100_000;

/* ── Pool registry ── */
const MAINNET_POOL_REGISTRY: PoolRegistryEntry[] = [
  {
    poolId: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
    symbol: "USDC",
    name: "USD Coin",
    coinMint: USDC_MINT,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  {
    poolId: "7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX",
    symbol: "USDT",
    name: "Tether USD",
    coinMint: USDT_MINT,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
  },
];

const configuredPoolRegistry = parsePoolRegistry(process.env.NEXT_PUBLIC_POOL_REGISTRY_JSON);

export const POOL_REGISTRY: PoolRegistryEntry[] = configuredPoolRegistry
  ?? (NETWORK === "devnet" ? [] : MAINNET_POOL_REGISTRY);

/* ── Legacy: POPULAR_TOKENS (kept for backwards-compat in modal) ── */
export const POPULAR_TOKENS: Token[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: SOL_MINT,
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: USDC_MINT,
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    mint: USDT_MINT,
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    logoURI: "https://static.jup.ag/jup/icon.png",
  },
  {
    symbol: "PYTH",
    name: "Pyth Network",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    decimals: 6,
    logoURI: "https://pyth.network/token.svg",
  },
  {
    symbol: "JTO",
    name: "Jito",
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    decimals: 9,
    logoURI: "https://metadata.jito.network/token/jto/image",
  },
  {
    symbol: "WIF",
    name: "dogwifhat",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    decimals: 6,
    logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link",
  },
  {
    symbol: "KMNO",
    name: "Kamino",
    mint: "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS",
    decimals: 6,
    logoURI: "https://cdn.kamino.finance/kamino.svg",
  },
  {
    symbol: "DRIFT",
    name: "Drift",
    mint: "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7",
    decimals: 6,
    logoURI: "https://metadata.drift.foundation/drift.png",
  },
  {
    symbol: "TNSR",
    name: "Tensor",
    mint: "TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6",
    decimals: 9,
    logoURI: "https://arweave.net/beGAyeIzjV_UkyjFtxbkZyi_YqfOBWayiQ0B6wqWygY",
  },
  {
    symbol: "PRCL",
    name: "Parcl",
    mint: "4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs",
    decimals: 6,
    logoURI: "https://ipfs.filebase.io/ipfs/QmVDpnYjKMCBdmqGddQNyW8cc3tBU5cKZFiSV5y18J5YnK",
  },
  {
    symbol: "ZEX",
    name: "Zeta",
    mint: "ZEXy1pqteRu3n13kdyh4LwPQknkFk3GzmMYMuNadWPo",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/zetamarkets/brand/master/assets/zeta.png",
  },
  {
    symbol: "W",
    name: "Wormhole Token",
    mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ",
    decimals: 6,
    logoURI: "https://wormhole.com/token.png",
  },
  {
    symbol: "WEN",
    name: "Wen",
    mint: "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk",
    decimals: 5,
    logoURI: "https://shdw-drive.genesysgo.net/GwJapVHVvfM4Mw4sWszkzywncUWuxxPd6s9VuFfXRgie/wen_logo.png",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I?ext=png",
  },
  {
    symbol: "POPCAT",
    name: "Popcat",
    mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    decimals: 9,
    logoURI: "https://bafkreidvkvuzyslw5jh5z242lgzwzhbi2kxxnpkic5wsvyno5ikvpr7reu.ipfs.nftstorage.link",
  },
  {
    symbol: "BOME",
    name: "BOOK OF MEME",
    mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",
    decimals: 6,
    logoURI: "https://bafybeidov7gddabmqke3fozpuvlllp3q2c537f2vfyyf6or4spbbao6cee.ipfs.nftstorage.link/",
  },
  {
    symbol: "MEW",
    name: "cat in a dogs world",
    mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",
    decimals: 5,
    logoURI: "https://bafkreidlwyr565dxtao2ipsze6bmzpszqzybz7sqi2zaet5fs7k53henju.ipfs.nftstorage.link/",
  },
  {
    symbol: "CLOUD",
    name: "Cloud",
    mint: "CLoUDKc4Ane7HeQcPpE3YHnznRxhMimJ4MyaUqyHFzAu",
    decimals: 9,
    logoURI: "https://arweave.net/N7vCgQdgQ-fab28zEB4m8QRLMwI91_KcXI-Gtr151gg",
  },
  {
    symbol: "IO",
    name: "IO",
    mint: "BZLbGTNCSFfoth2GYDtwr7e4imWzpR5jqcUuGEwr646K",
    decimals: 8,
    logoURI: "https://bafkreicnqsbhpzxiasdm5esr7fqi3vcjvcbfefo4sq4y3ff747rfqf7w7i.ipfs.nftstorage.link",
  },
  {
    symbol: "RENDER",
    name: "Render Token",
    mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    decimals: 8,
    logoURI: "https://shdw-drive.genesysgo.net/5zseP54TGrcz9C8HdjZwJJsZ6f3VbP11p1abwKWGykZH/rndr.png",
  },
  {
    symbol: "HNT",
    name: "Helium Network Token",
    mint: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux",
    decimals: 8,
    logoURI: "https://shdw-drive.genesysgo.net/CsDkETHRRR1EcueeN346MJoqzymkkr7RFjMqGpZMzAib/hnt.png",
  },
  {
    symbol: "MOBILE",
    name: "Helium Mobile",
    mint: "mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6",
    decimals: 6,
    logoURI: "https://shdw-drive.genesysgo.net/CsDkETHRRR1EcueeN346MJoqzymkkr7RFjMqGpZMzAib/mobile.png",
  },
  {
    symbol: "IOT",
    name: "Helium IOT",
    mint: "iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns",
    decimals: 6,
    logoURI: "https://shdw-drive.genesysgo.net/CsDkETHRRR1EcueeN346MJoqzymkkr7RFjMqGpZMzAib/iot.png",
  },
  {
    symbol: "mSOL",
    name: "Marinade staked SOL",
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
  },
  {
    symbol: "bSOL",
    name: "BlazeStake Staked SOL",
    mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1/logo.png",
  },
  {
    symbol: "stSOL",
    name: "Lido Staked SOL",
    mint: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj/logo.png",
  },
  {
    symbol: "JitoSOL",
    name: "Jito Staked SOL",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    decimals: 9,
    logoURI: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png",
  },
  {
    symbol: "JupSOL",
    name: "Jupiter Staked SOL",
    mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
    decimals: 9,
    logoURI: "https://static.jup.ag/jupSOL/icon.png",
  },
  {
    symbol: "MNDE",
    name: "Marinade",
    mint: "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png",
  },
  {
    symbol: "RAY",
    name: "Raydium",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
  },
  {
    symbol: "ORCA",
    name: "Orca",
    mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png",
  },
  {
    symbol: "FIDA",
    name: "Bonfida",
    mint: "EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp/logo.svg",
  },
  {
    symbol: "SBR",
    name: "Saber",
    mint: "Saber2gLauYim4Mvftnrasomsv6NvAuncvMEZwcLpD1",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Saber2gLauYim4Mvftnrasomsv6NvAuncvMEZwcLpD1/logo.svg",
  },
  {
    symbol: "PORT",
    name: "Port Finance",
    mint: "PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y/PORT.png",
  },
  {
    symbol: "JET",
    name: "Jet Protocol",
    mint: "JET6zMJWkCN9tpRT2v2jfAmm5VnQFDpUBCyaKojmGtz",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JET6zMJWkCN9tpRT2v2jfAmm5VnQFDpUBCyaKojmGtz/logo.png",
  },
  {
    symbol: "MNGO",
    name: "Mango",
    mint: "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac/token.png",
  },
  {
    symbol: "SLND",
    name: "Solend",
    mint: "SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xHGtPwp",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xHGtPwp/logo.png",
  },
  {
    symbol: "MEDIA",
    name: "Media Network",
    mint: "ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs/logo.png",
  },
  {
    symbol: "MPLX",
    name: "Metaplex",
    mint: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m",
    decimals: 6,
    logoURI: "https://arweave.net/VRKOcXIvCxqp35RZ9I0-bDGk5qNfT46OTho-2oP9iGc",
  },
  {
    symbol: "AURY",
    name: "Aurory",
    mint: "AURYydfxJib1ZkTir1Jn1J9ECYUtjb6rKQVmtYaixWPP",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/AURYydfxJib1ZkTir1Jn1J9ECYUtjb6rKQVmtYaixWPP/logo.png",
  },
  {
    symbol: "GMT",
    name: "GMT",
    mint: "7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx/logo.png",
  },
  {
    symbol: "GST",
    name: "GST",
    mint: "AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB/logo.png",
  },
  {
    symbol: "SHDW",
    name: "Shadow",
    mint: "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y",
    decimals: 9,
    logoURI:
      "https://shdw-drive.genesysgo.net/FDcC9gn12fFkSU2KuQYH4TUjihrZxiTodFRWNF4ns9Kt/250x250_with_padding.png",
  },
  {
    symbol: "ACS",
    name: "Access Protocol",
    mint: "5MAYDfq5yxtudAhtfyuMBuHZjgAbaS9tbEyEQYAhDS5y",
    decimals: 6,
    logoURI: "https://ap-staging.fra1.digitaloceanspaces.com/1663691449945",
  },
  {
    symbol: "PYUSD",
    name: "PayPal USD",
    mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    decimals: 6,
    logoURI: "https://424565.fs1.hubspotusercontent-na1.net/hubfs/424565/PYUSDLOGO.png",
  },
  {
    symbol: "EURC",
    name: "EURC",
    mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
    decimals: 6,
    logoURI: "https://www.circle.com/hubfs/Brand/EURC/EURC-icon_128x128.png",
  },
  {
    symbol: "ETH",
    name: "Ether",
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    decimals: 8,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png",
  },
  {
    symbol: "WBTC",
    name: "Wrapped BTC",
    mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
    decimals: 8,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png",
  },
  {
    symbol: "SAMO",
    name: "Samoyed Coin",
    mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/logo.png",
  },
];

const DEVNET_BASE_TOKENS = POPULAR_TOKENS.filter((token) => token.mint === SOL_MINT);

export const CUSTOM_TOKENS: Token[] = parseCustomTokens(customTokensRaw)
  .filter((token) => token.network === undefined || token.network === NETWORK)
  .map(({ network: _network, ...token }) => token);

export const TOKEN_CATALOG: Token[] = dedupeTokens([
  ...(NETWORK === "devnet" ? DEVNET_BASE_TOKENS : POPULAR_TOKENS),
  ...CUSTOM_TOKENS,
]);

/* ── Explorer URL helper ── */
export function getSolscanUrl(signature: string): string {
  const cluster = NETWORK === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/tx/${signature}${cluster}`;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
