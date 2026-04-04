"use client";

import { useMemo, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { READ_RPC_ENDPOINT } from "@/constants";

import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  // Stable config object — without this, ConnectionProvider's default
  // `{ commitment: 'confirmed' }` creates a new reference every render,
  // causing a new Connection to be created and cascading re-renders to
  // every hook that reads useConnection().
  const connectionConfig = useMemo(
    () => ({ commitment: "confirmed" as const }),
    []
  );

  return (
    <ConnectionProvider endpoint={READ_RPC_ENDPOINT} config={connectionConfig}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
