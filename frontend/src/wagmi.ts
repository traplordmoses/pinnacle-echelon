import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http, fallback } from "wagmi";
import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://testnet-rpc.monad.xyz",
        "https://testnet-rpc2.monad.xyz",
      ],
    },
  },
  testnet: true,
});

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
        injectedWallet,
      ],
    },
  ],
  {
    appName: "Pinnacle Echelon",
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "placeholder",
  }
);

export const config = createConfig({
  connectors,
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: fallback([
      http("https://testnet-rpc.monad.xyz", {
        retryCount: 3,
        retryDelay: 2000,
      }),
      http("https://testnet-rpc2.monad.xyz", {
        retryCount: 3,
        retryDelay: 2000,
      }),
    ]),
  },
  ssr: true,
});
