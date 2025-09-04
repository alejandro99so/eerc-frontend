'use client';

import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, avalancheFuji } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, sepolia, avalancheFuji],
  connectors: [
    injected(), // This allows wagmi to detect injected wallets (MetaMask, etc.)
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [avalancheFuji.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
