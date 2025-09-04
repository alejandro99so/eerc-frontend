'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { config } from '../lib/wagmi-config';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

const queryClient = new QueryClient();

interface PrivyWrapperProps {
  children: ReactNode;
}

export default function PrivyWrapper({ children }: PrivyWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <PrivyProvider
          appId={PRIVY_APP_ID}
          config={{
            // Disable embedded wallets to prevent multiple wallet connections
            embeddedWallets: {
              createOnLogin: 'off'
            },
            // Configure login methods
            loginMethods: ['wallet'],
            // Appearance
            appearance: {
              theme: 'light',
              accentColor: '#676FFF',
            }
          }}
        >
          {children}
        </PrivyProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
