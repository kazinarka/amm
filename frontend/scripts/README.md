# Devnet token tools

## Create and register a devnet token

This script creates a new SPL token mint on devnet, mints supply to a recipient account, and optionally adds the token to `src/constants/customTokens.json` so it appears in the frontend token picker.

### Usage

```bash
npm run token:create:devnet -- \
  --symbol BREAD \
  --name "Bread Devnet" \
  --decimals 6 \
  --amount 1000000
```

### Optional flags

- `--recipient <pubkey>`: recipient of the minted supply; defaults to the payer wallet
- `--keypair <path>`: payer keypair file; defaults to `~/.config/solana/id.json`
- `--rpc <url>`: custom devnet RPC; defaults to `https://api.devnet.solana.com`
- `--logo-uri <url>`: token logo for the frontend picker
- `--no-register`: create and mint the token without writing it into the frontend registry

### Notes

- Use a wallet/keypair funded on devnet.
- Restart `npm run dev` after registering a new token if the picker is already open.
- Registered tokens are stored in `src/constants/customTokens.json`.
