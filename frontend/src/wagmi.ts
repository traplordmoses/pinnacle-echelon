import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "Pinnacle Echelon",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "placeholder",
  chains: [monadTestnet],
  ssr: true,
});
