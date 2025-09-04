import type { Metadata } from "next";
import "./globals.css";
import PrivyWrapper from "./components/privy-provider";

export const metadata: Metadata = {
  title: "eERC Protocol - Encrypted ERC Standard",
  description: "Secure, private, and encrypted token standard built on zero-knowledge proofs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PrivyWrapper>
          {children}
        </PrivyWrapper>
      </body>
    </html>
  );
}