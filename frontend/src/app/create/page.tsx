"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/contract";

export default function CreateCategory() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [title, setTitle] = useState("");
  const [stakeAmount, setStakeAmount] = useState("0.01");
  const [submissionHours, setSubmissionHours] = useState("24");
  const [votingHours, setVotingHours] = useState("48");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;

    const now = Math.floor(Date.now() / 1000);
    const subDeadline = BigInt(now + parseInt(submissionHours) * 3600);
    const voteDeadline = BigInt(
      now +
        parseInt(submissionHours) * 3600 +
        parseInt(votingHours) * 3600
    );

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "createCategory",
      args: [title, parseEther(stakeAmount), subDeadline, voteDeadline],
    });
  };

  useEffect(() => {
    if (isSuccess) {
      router.push("/");
    }
  }, [isSuccess, router]);

  return (
    <main className="min-h-screen p-6 md:p-10">
      {/* Nav */}
      <nav className="glass-strong rounded-2xl px-6 py-4 flex items-center justify-between mb-10 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-glossy-btn flex items-center justify-center text-white font-bold text-lg shadow-glossy">
            PE
          </div>
          <span className="text-xl font-bold text-sky-900 tracking-tight">
            Pinnacle Echelon
          </span>
        </Link>
        <ConnectButton />
      </nav>

      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 text-sm mb-6"
        >
          &larr; Back to categories
        </Link>

        <div className="glass-strong rounded-3xl p-8">
          <h1 className="text-3xl font-bold text-sky-900 mb-2">
            Create Category
          </h1>
          <p className="text-sky-700/60 mb-8">
            Propose a meme competition. Set the theme, stake amount, and
            deadlines.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-sky-800 mb-2">
                Category Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. "Best Crypto Cringe Meme"'
                className="aero-input"
                required
              />
            </div>

            {/* Stake Amount */}
            <div>
              <label className="block text-sm font-semibold text-sky-800 mb-2">
                Entry Stake (MON)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0.01"
                className="aero-input"
                required
              />
              <p className="text-xs text-sky-600/50 mt-1">
                Each meme submission costs this much to enter. Goes into the
                prize pool.
              </p>
            </div>

            {/* Submission Window */}
            <div>
              <label className="block text-sm font-semibold text-sky-800 mb-2">
                Submission Window (hours)
              </label>
              <input
                type="number"
                min="1"
                value={submissionHours}
                onChange={(e) => setSubmissionHours(e.target.value)}
                placeholder="24"
                className="aero-input"
                required
              />
              <p className="text-xs text-sky-600/50 mt-1">
                How long players can submit memes before voting begins.
              </p>
            </div>

            {/* Voting Window */}
            <div>
              <label className="block text-sm font-semibold text-sky-800 mb-2">
                Voting Window (hours after submissions close)
              </label>
              <input
                type="number"
                min="1"
                value={votingHours}
                onChange={(e) => setVotingHours(e.target.value)}
                placeholder="48"
                className="aero-input"
                required
              />
              <p className="text-xs text-sky-600/50 mt-1">
                How long the crowd can vote and trade prediction shares.
              </p>
            </div>

            {/* Summary */}
            <div className="glass rounded-2xl p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-sky-700/60">Submissions close in</span>
                <span className="font-semibold text-sky-900">
                  {submissionHours}h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sky-700/60">Voting ends in</span>
                <span className="font-semibold text-sky-900">
                  {parseInt(submissionHours || "0") +
                    parseInt(votingHours || "0")}
                  h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sky-700/60">Entry cost</span>
                <span className="font-semibold text-sky-900">
                  {stakeAmount} MON
                </span>
              </div>
            </div>

            {/* Submit */}
            {!isConnected ? (
              <div className="text-center">
                <p className="text-sky-700/60 text-sm mb-3">
                  Connect your wallet to create a category
                </p>
                <ConnectButton />
              </div>
            ) : (
              <button
                type="submit"
                disabled={isPending || isConfirming || !title}
                className="btn-glossy w-full py-3 rounded-2xl text-base font-semibold"
              >
                {isPending
                  ? "Confirm in Wallet..."
                  : isConfirming
                  ? "Creating..."
                  : "Create Category"}
              </button>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
