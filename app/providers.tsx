"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import "@coinbase/onchainkit/styles.css";

const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          chain={baseSepolia}
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          miniKit={{ enabled: true, autoConnect: true }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
