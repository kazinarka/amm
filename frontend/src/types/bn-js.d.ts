declare module "bn.js" {
  class BN {
    constructor(value?: number | string | number[] | Uint8Array, base?: number | "hex", endian?: "le" | "be");
    toArray(endian?: "le" | "be", length?: number): number[];
    pow(exponent: BN): BN;
  }

  export default BN;
}