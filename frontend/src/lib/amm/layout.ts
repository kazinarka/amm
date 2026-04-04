import { PublicKey } from "@solana/web3.js";

/**
 * AmmInfo binary layout — 752 bytes, packed C layout, all LE.
 *
 * Offsets derived from the Rust `#[repr(C, packed)]` struct:
 *   status(0), nonce(8), order_num(16), depth(24),
 *   coin_decimals(32), pc_decimals(40), state(48), reset_flag(56),
 *   min_size(64), vol_max_cut_ratio(72), amount_wave(80),
 *   coin_lot_size(88), pc_lot_size(96), min_price_multiplier(104),
 *   max_price_multiplier(112), sys_decimal_value(120),
 *   fees(128..192), state_data(192..336), pubkeys(336..624),
 *   padding1(624..688), amm_owner(688), lp_amount(720), ...
 */

export const AMM_INFO_SIZE = 752;

/** Decoded subset of AmmInfo — only the fields we need for quoting + instruction building. */
export interface DecodedAmmInfo {
  status: number;
  nonce: number;
  coinDecimals: number;
  pcDecimals: number;
  swapFeeNumerator: bigint;
  swapFeeDenominator: bigint;
  needTakePnlCoin: bigint;
  needTakePnlPc: bigint;
  coinVault: PublicKey;
  pcVault: PublicKey;
  coinMint: PublicKey;
  pcMint: PublicKey;
  lpMint: PublicKey;
  paddingOpenOrders: PublicKey;
  marketId: PublicKey;
  paddingMarketProgram: PublicKey;
  targetOrders: PublicKey;
  ammOwner: PublicKey;
  lpAmount: bigint;
}

/* ── Helpers ── */

function readU64(dv: DataView, offset: number): bigint {
  return dv.getBigUint64(offset, true); // little-endian
}

function readPubkey(buf: Uint8Array, offset: number): PublicKey {
  return new PublicKey(buf.slice(offset, offset + 32));
}

/**
 * Decode raw AmmInfo account data into a typed JS object.
 * Throws if the data is shorter than 752 bytes.
 */
export function decodeAmmInfo(data: Buffer | Uint8Array): DecodedAmmInfo {
  if (data.length < AMM_INFO_SIZE) {
    throw new Error(
      `AmmInfo data too short: expected ${AMM_INFO_SIZE} bytes, got ${data.length}`
    );
  }

  const buf = new Uint8Array(data);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  return {
    status: Number(readU64(dv, 0)),
    nonce: Number(readU64(dv, 8)),
    coinDecimals: Number(readU64(dv, 32)),
    pcDecimals: Number(readU64(dv, 40)),

    // Fees block starts at byte 128
    swapFeeNumerator: readU64(dv, 176),
    swapFeeDenominator: readU64(dv, 184),

    // State data block starts at byte 192
    needTakePnlCoin: readU64(dv, 192),
    needTakePnlPc: readU64(dv, 200),

    // Pubkeys start at byte 336
    coinVault: readPubkey(buf, 336),
    pcVault: readPubkey(buf, 368),
    coinMint: readPubkey(buf, 400),
    pcMint: readPubkey(buf, 432),
    lpMint: readPubkey(buf, 464),
    paddingOpenOrders: readPubkey(buf, 496),
    marketId: readPubkey(buf, 528),
    paddingMarketProgram: readPubkey(buf, 560),
    targetOrders: readPubkey(buf, 592),
    ammOwner: readPubkey(buf, 688),
    lpAmount: readU64(dv, 720),
  };
}
