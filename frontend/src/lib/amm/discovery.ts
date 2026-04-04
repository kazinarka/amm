import { Connection } from "@solana/web3.js";
import { AMM_PROGRAM_ID, POOL_REGISTRY, SOL_MINT, TOKEN_CATALOG } from "@/constants";
import { DiscoveredAmmPool, Token, TokenOption } from "@/types";
import { AMM_INFO_SIZE, decodeAmmInfo } from "./layout";

function shortMint(mint: string) {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function getRegistryMeta(mint: string, poolId?: string) {
  return POOL_REGISTRY.find(
    (entry) => entry.coinMint === mint || (poolId ? entry.poolId === poolId : false)
  );
}

function toTokenOption(token: Token): TokenOption {
  return {
    mint: token.mint,
    decimals: token.decimals,
    isNative: token.mint === SOL_MINT,
    symbol: token.symbol,
    name: token.name,
    logoURI: token.logoURI,
  };
}

export function getTokenOption(params: {
  mint: string;
  decimals: number;
  poolId?: string;
}): TokenOption {
  const { mint, decimals, poolId } = params;
  const known = TOKEN_CATALOG.find((token) => token.mint === mint);
  const registry = getRegistryMeta(mint, poolId);

  return {
    mint,
    decimals: known?.decimals ?? decimals,
    isNative: mint === SOL_MINT,
    symbol: known?.symbol ?? registry?.symbol ?? shortMint(mint),
    name: known?.name ?? registry?.name ?? `Token ${shortMint(mint)}`,
    logoURI:
      known?.logoURI
      ?? registry?.logoURI
      ?? "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  };
}

export function formatPoolLabel(pool: DiscoveredAmmPool): string {
  return `${pool.coinToken.symbol} / ${pool.pcToken.symbol}`;
}

export async function discoverAmmPools(
  connection: Connection
): Promise<DiscoveredAmmPool[]> {
  const accounts = await connection.getProgramAccounts(AMM_PROGRAM_ID, {
    filters: [{ dataSize: AMM_INFO_SIZE }],
  });

  return accounts
    .map(({ pubkey, account }) => {
      const decoded = decodeAmmInfo(account.data);
      const coinMint = decoded.coinMint.toBase58();
      const pcMint = decoded.pcMint.toBase58();

      const coinToken = getTokenOption({
        mint: coinMint,
        decimals: decoded.coinDecimals,
        poolId: pubkey.toBase58(),
      });
      const pcToken = getTokenOption({
        mint: pcMint,
        decimals: decoded.pcDecimals,
        poolId: pubkey.toBase58(),
      });

      return {
        address: pubkey,
        poolId: pubkey.toBase58(),
        nonce: decoded.nonce,
        coinMint,
        pcMint,
        lpMint: decoded.lpMint.toBase58(),
        marketId: decoded.marketId.toBase58(),
        targetOrders: decoded.targetOrders.toBase58(),
        lpAmount: decoded.lpAmount,
        coinDecimals: decoded.coinDecimals,
        pcDecimals: decoded.pcDecimals,
        coinToken,
        pcToken,
      } satisfies DiscoveredAmmPool;
    })
    .sort((left, right) => formatPoolLabel(left).localeCompare(formatPoolLabel(right)));
}

export function getUniqueTokenOptions(pools: DiscoveredAmmPool[]): TokenOption[] {
  const seen = new Map<string, TokenOption>(
    TOKEN_CATALOG.map((token) => [token.mint, toTokenOption(token)])
  );

  for (const pool of pools) {
    seen.set(pool.coinToken.mint, pool.coinToken);
    seen.set(pool.pcToken.mint, pool.pcToken);
  }

  return Array.from(seen.values()).sort((left, right) => {
    if (left.isNative) return -1;
    if (right.isNative) return 1;
    return left.symbol.localeCompare(right.symbol);
  });
}

export function findPoolsForPair(
  pools: DiscoveredAmmPool[],
  sellMint: string | null,
  buyMint: string | null
): DiscoveredAmmPool[] {
  if (!sellMint || !buyMint || sellMint === buyMint) return [];

  return pools.filter((pool) => {
    const matchesDirect = pool.coinMint === sellMint && pool.pcMint === buyMint;
    const matchesInverse = pool.coinMint === buyMint && pool.pcMint === sellMint;
    return matchesDirect || matchesInverse;
  });
}

export function getPoolTokenByMint(
  pool: DiscoveredAmmPool,
  mint: string
): TokenOption | null {
  if (pool.coinMint === mint) return pool.coinToken;
  if (pool.pcMint === mint) return pool.pcToken;
  return null;
}

export function getCounterpartyToken(
  pool: DiscoveredAmmPool,
  mint: string
): TokenOption | null {
  if (pool.coinMint === mint) return pool.pcToken;
  if (pool.pcMint === mint) return pool.coinToken;
  return null;
}

export function findPoolById(
  pools: DiscoveredAmmPool[],
  poolId: string | null
): DiscoveredAmmPool | null {
  if (!poolId) return null;
  return pools.find((pool) => pool.poolId === poolId) ?? null;
}

export function sortPoolsByPriority(pools: DiscoveredAmmPool[]) {
  return [...pools].sort((left, right) => {
    const leftHasRegistry = Boolean(getRegistryMeta(left.coinMint, left.poolId));
    const rightHasRegistry = Boolean(getRegistryMeta(right.coinMint, right.poolId));
    if (leftHasRegistry !== rightHasRegistry) return leftHasRegistry ? -1 : 1;
    return formatPoolLabel(left).localeCompare(formatPoolLabel(right));
  });
}
