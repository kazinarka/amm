export interface Token {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI: string;
  balance?: number;
  usdPrice?: number;
}

export interface SwapQuote {
  inAmount: number;
  outAmount: number;
  priceImpact: number;
  fee: number;
  route: string;
  minimumReceived: number;
}

export interface SwapSettings {
  slippage: number;       // basis points (50 = 0.5%)
  priorityFee: number;    // in SOL
}
