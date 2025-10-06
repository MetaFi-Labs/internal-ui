"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createAppKit, useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { arbitrum, mainnet } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit-common";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

const queryClient = new QueryClient();
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, arbitrum];

const metadata = {
  name: "Generic Money",
  description: "Deposit and redeem gmUSD with a shadcn-powered interface.",
  url: "https://example.com",
  icons: ["/icons/icon.svg"],
};

type AppKitContextValue = {
  ready: boolean;
  isConnected: boolean;
  address?: string;
  openModal: (options?: { view?: "Account" | "Connect" }) => Promise<void>;
};

const noop = async () => {};

const AppKitContext = createContext<AppKitContextValue>({
  ready: false,
  isConnected: false,
  address: undefined,
  openModal: noop,
});

function AppKitBridge({ children }: { children: React.ReactNode }) {
  const { open } = useAppKit();
  const account = useAppKitAccount();

  const value = useMemo<AppKitContextValue>(() => {
    const defaultView = account.isConnected ? "Account" : "Connect";
    return {
      ready: true,
      isConnected: account.isConnected,
      address: account.address,
      openModal: async (options) => {
        await open(options?.view ? { view: options.view } : { view: defaultView });
      },
    };
  }, [account.address, account.isConnected, open]);

  return (
    <AppKitContext.Provider value={value}>{children}</AppKitContext.Provider>
  );
}

export function useAppKitContext() {
  return useContext(AppKitContext);
}

export function AppKitProvider({ children }: { children: React.ReactNode }) {
  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

  const adapter = useMemo(() => {
    if (!projectId) return null;
    return new WagmiAdapter({ networks, projectId, ssr: true });
  }, [projectId]);

  const initializedRef = useRef(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!projectId || !adapter || initializedRef.current) {
      return;
    }

    createAppKit({
      adapters: [adapter],
      networks,
      projectId,
      metadata,
      features: {
        analytics: true,
      },
    });

    initializedRef.current = true;
    setInitialized(true);
  }, [adapter, projectId]);

  if (!projectId || !adapter) {
    return (
      <AppKitContext.Provider
        value={{ ready: false, isConnected: false, address: undefined, openModal: noop }}
      >
        {children}
      </AppKitContext.Provider>
    );
  }

  return (
    <WagmiProvider config={adapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {initialized ? (
          <AppKitBridge>{children}</AppKitBridge>
        ) : (
          <AppKitContext.Provider
            value={{ ready: false, isConnected: false, address: undefined, openModal: noop }}
          >
            {children}
          </AppKitContext.Provider>
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
