import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "AMM Swap",
  description: "Fast & decentralized token swaps on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-dark-950 antialiased">
        <Providers>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#1e1e23",
                color: "#f5f5f6",
                border: "1px solid #2a2a30",
                borderRadius: "12px",
                fontSize: "14px",
              },
            }}
          />
          {/* Background gradient orbs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/5 rounded-full blur-[120px]" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-start justify-center pt-8 md:pt-16 px-4 pb-20">
              {children}
            </main>
            <footer className="text-center py-6 text-sm text-dark-500">
              Built on Solana
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
