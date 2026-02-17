import contractJson from "./abi/MemeFutarchy.json";
import { type Abi } from "viem";

export const CONTRACT_ABI = contractJson.abi as Abi;
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export function ipfsToUrl(hash: string): string {
  if (!hash) return "";
  if (hash.startsWith("http")) return hash;
  if (hash.startsWith("ipfs://"))
    return `https://ipfs.io/ipfs/${hash.slice(7)}`;
  return `https://ipfs.io/ipfs/${hash}`;
}

export function formatTimeRemaining(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export type Phase = "submissions" | "voting" | "awaiting_resolution" | "resolved";

export function getCategoryPhase(
  submissionDeadline: number,
  votingDeadline: number,
  resolved: boolean
): Phase {
  const now = Math.floor(Date.now() / 1000);
  if (resolved) return "resolved";
  if (now < submissionDeadline) return "submissions";
  if (now < votingDeadline) return "voting";
  return "awaiting_resolution";
}

export const PHASE_CONFIG: Record<Phase, { label: string; color: string }> = {
  submissions: { label: "Submissions Open", color: "bg-glossy-btn-green text-white" },
  voting: { label: "Voting & Trading", color: "bg-glossy-btn text-white" },
  awaiting_resolution: { label: "Awaiting Resolution", color: "bg-glossy-btn-orange text-white" },
  resolved: { label: "Resolved", color: "bg-gray-400/60 text-white" },
};

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
