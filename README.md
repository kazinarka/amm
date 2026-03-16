<div align="center">
  <h1>solana-amm</h1>
</div>

## Overview

- **An on-chain AMM smart contract based on the "constant product" model in a permissionless and decentralized manner built on the Solana blockchain. It also shares its liquidity according to the Fibonacci sequence in the form of limit orders on [OpenBook](https://github.com/openbook-dex/program), the primary central limit order book (CLOB) of Solana**

## Environment Setup
1. Install [Rust](https://www.rust-lang.org/tools/install).
2. Install [Solana](https://docs.solana.com/cli/install-solana-cli-tools) and then run `solana-keygen new` to create a keypair at the default location.

## Build

Clone the repository and enter the source code directory.
```bash
git clone https://github.com/kazinarka/amm
cd amm/program
```

### Mainnet Build
```bash
cargo build-sbf
```
### Devnet Build
```bash
cargo build-sbf --features devnet
```

After building, the smart contract files are all located in the target directory.

## Deploy
```bash
solana deploy
```
Attention, check your configuration and confirm the environment you want to deploy.
