import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "bread.fun",
  description: "bread.fun — fast & decentralized token swaps on Solana",
  applicationName: "bread.fun",
  icons: {
    icon: [
      { url: "/bread-icon.png", type: "image/png", sizes: "420x420" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "420x420", type: "image/png" }],
    shortcut: ["/bread-icon.png"],
  },
  openGraph: {
    title: "bread.fun",
    description: "Fast & decentralized token swaps on Solana.",
    images: [
      {
        url: "/bread-brand.png",
        width: 1500,
        height: 420,
        alt: "bread.fun",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "bread.fun",
    description: "Fast & decentralized token swaps on Solana.",
    images: ["/bread-brand.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetBrainsMono.variable} min-h-screen bg-dark-950 antialiased`}>
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
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/5 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 flex min-h-screen flex-col">
            <Header />
            <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 md:px-6 md:pt-10 xl:px-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
