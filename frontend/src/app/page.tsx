"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  formatTimeRemaining,
  getCategoryPhase,
  PHASE_CONFIG,
} from "@/contract";

export default function Home() {
  const { data: categoryCount, isLoading: isCountLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "categoryCount",
  });

  const count = Number(categoryCount || 0);

  const categoryContracts = Array.from({ length: count }, (_, i) => ({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "categories",
    args: [BigInt(i + 1)],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: categoriesData } = useReadContracts({
    contracts: categoryContracts as any,
    query: { enabled: count > 0, refetchInterval: 10000 },
  });

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

      {/* Hero */}
      <section className="text-center mb-14 max-w-3xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-400 bg-clip-text text-transparent leading-tight">
          Meme Futarchy
        </h1>
        <p className="text-lg text-sky-800/70 mb-8 max-w-xl mx-auto">
          Submit your best memes. The crowd votes and the prediction market
          decides the winner. Powered by Monad.
        </p>

        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-10">
          {[
            { step: "1", title: "Propose", desc: "Create a category" },
            { step: "2", title: "Submit & Stake", desc: "Drop meme + MON" },
            { step: "3", title: "Vote & Trade", desc: "Markets decide" },
          ].map((item) => (
            <div key={item.step} className="glass rounded-2xl p-4 text-center">
              <div className="w-8 h-8 rounded-full bg-glossy-btn text-white text-sm font-bold flex items-center justify-center mx-auto mb-2 shadow-glossy">
                {item.step}
              </div>
              <div className="font-semibold text-sky-900 text-sm">
                {item.title}
              </div>
              <div className="text-xs text-sky-700/60 mt-1">{item.desc}</div>
            </div>
          ))}
        </div>

        <Link
          href="/create"
          className="btn-glossy inline-block px-8 py-3 rounded-full text-base font-semibold"
        >
          + Create Category
        </Link>
      </section>

      {/* Category Cards */}
      <section className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-sky-900 mb-6">
          Active Categories
        </h2>

        {isCountLoading && (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-sky-700/60 text-lg animate-pulse">
              Loading categories...
            </p>
          </div>
        )}

        {!isCountLoading && count === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-sky-700/60 text-lg">
              No categories yet. Be the first to create one!
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoriesData?.map((result, i) => {
            if (result.status !== "success" || !result.result) return null;
            const cat = result.result as [
              bigint, string, string, bigint, bigint, bigint, bigint, bigint, boolean, bigint
            ];
            const [id, title, , stakeAmount, submissionDeadline, votingDeadline, totalPot, memeCountBig, resolved] = cat;
            const phase = getCategoryPhase(
              Number(submissionDeadline),
              Number(votingDeadline),
              resolved
            );
            const config = PHASE_CONFIG[phase];
            const deadline =
              phase === "submissions"
                ? Number(submissionDeadline)
                : Number(votingDeadline);

            return (
              <Link href={`/category/${id}`} key={i}>
                <div className="glass rounded-2xl p-6 hover:shadow-bubble transition-all duration-200 hover:-translate-y-1 cursor-pointer group h-full">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full ${config.color}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-xs text-sky-700/50 font-mono">
                      #{Number(id)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-sky-900 mb-4 group-hover:text-sky-600 transition-colors line-clamp-2">
                    {title}
                  </h3>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass rounded-xl p-3 text-center">
                      <div className="text-xs text-sky-700/50 mb-1">
                        Prize Pool
                      </div>
                      <div className="font-bold text-sky-900 text-sm">
                        {parseFloat(formatEther(totalPot)).toFixed(3)} MON
                      </div>
                    </div>
                    <div className="glass rounded-xl p-3 text-center">
                      <div className="text-xs text-sky-700/50 mb-1">Memes</div>
                      <div className="font-bold text-sky-900 text-sm">
                        {Number(memeCountBig)}
                      </div>
                    </div>
                    <div className="glass rounded-xl p-3 text-center">
                      <div className="text-xs text-sky-700/50 mb-1">Stake</div>
                      <div className="font-bold text-sky-900 text-sm">
                        {parseFloat(formatEther(stakeAmount)).toFixed(3)} MON
                      </div>
                    </div>
                    <div className="glass rounded-xl p-3 text-center">
                      <div className="text-xs text-sky-700/50 mb-1">
                        Time Left
                      </div>
                      <div className="font-bold text-sky-900 text-sm">
                        {formatTimeRemaining(deadline)}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
