"use client";

import Link from "next/link";
import { useState } from "react";
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

const GUIDE_STEPS = [
  {
    icon: "+",
    accent: "bg-glossy-btn",
    title: "Create a Category",
    body: "Anyone can start a meme competition. Pick a theme, set the entry stake (in MON), and choose how long submissions and voting last. Your category goes live immediately on-chain.",
  },
  {
    icon: "\u{1F5BC}",
    accent: "bg-glossy-btn-green",
    title: "Submit a Meme & Stake",
    body: "Upload your meme image during the submission window. Each submission costs the entry stake in MON \u2014 this goes straight into the prize pool. One meme per wallet, so make it count.",
  },
  {
    icon: "\u{2705}",
    accent: "bg-glossy-btn",
    title: "Vote (5 Free Votes)",
    body: "Once submissions close, voting opens. Every wallet gets 5 free votes to spread across any memes \u2014 all on one, or split them up. Submit your allocation in a single transaction. One shot per wallet.",
  },
  {
    icon: "\u{1F4C8}",
    accent: "bg-glossy-btn-pink",
    title: "Prediction Betting",
    body: "Think you know the winner? Buy prediction shares on your pick. Shares follow a bonding curve \u2014 early bets are cheaper, price rises with demand. You can only bet on ONE meme per round, and it\u2019s locked once placed.",
  },
  {
    icon: "\u{1F3AF}",
    accent: "bg-glossy-btn-orange",
    title: "How the Winner is Picked",
    body: "This is the futarchy magic. Each meme gets a score: 60% from normalized votes + 40% from normalized market pool. A meme needs both crowd love AND market conviction to win. No single whale or vote brigade can game it alone.",
  },
  {
    icon: "\u{1F4B0}",
    accent: "bg-glossy-btn-green",
    title: "Who Gets the Money",
    body: "When a category resolves, the prize pool splits: 20% to the winning meme\u2019s creator, 75% to shareholders of the winning meme (split pro-rata by shares held), and 5% protocol fee. If nobody bought shares, the creator gets 95%.",
  },
];

export default function Home() {
  const [showGuide, setShowGuide] = useState(false);

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
    query: { enabled: count > 0, refetchInterval: 30000 },
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGuide(true)}
            className="glass rounded-full px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-white/60 transition-all"
          >
            ? How it works
          </button>
          <ConnectButton />
        </div>
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

      {/* ── How It Works Modal ────────────────────────────── */}
      {showGuide && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuide(false);
          }}
        >
          <div className="glass-strong rounded-3xl p-6 md:p-8 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                How It Works
              </h2>
              <button
                onClick={() => setShowGuide(false)}
                className="w-9 h-9 rounded-full glass flex items-center justify-center text-sky-700 hover:bg-white/60 transition-all font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-sky-700/60 mb-6">
              Pinnacle Echelon is a meme competition where the crowd votes and
              the prediction market keeps everyone honest. Here&apos;s the full
              breakdown.
            </p>

            {/* Steps */}
            <div className="space-y-4">
              {GUIDE_STEPS.map((step, i) => (
                <div
                  key={i}
                  className="glass rounded-2xl p-4 flex gap-4 items-start"
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${step.accent} text-white text-lg font-bold flex items-center justify-center shrink-0 shadow-glossy`}
                  >
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sky-900 text-sm mb-1">
                      {step.title}
                    </h3>
                    <p className="text-xs text-sky-700/70 leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Score Formula */}
            <div className="glass rounded-2xl p-4 mt-4">
              <h3 className="font-bold text-sky-900 text-sm mb-2">
                The Futarchy Formula
              </h3>
              <div className="glass-dark rounded-xl p-3 text-center mb-3">
                <code className="text-white text-sm font-mono">
                  Score = Votes &times; 60% + Market &times; 40%
                </code>
              </div>
              <div className="flex gap-4 justify-center text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-sky-400" />
                  <span className="text-sky-700/60">Votes (60%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-purple-400" />
                  <span className="text-sky-700/60">Market (40%)</span>
                </div>
              </div>
            </div>

            {/* Payout Breakdown */}
            <div className="glass rounded-2xl p-4 mt-4">
              <h3 className="font-bold text-sky-900 text-sm mb-3">
                Prize Pool Split
              </h3>
              <div className="flex gap-1 h-5 rounded-full overflow-hidden mb-3">
                <div className="bg-gradient-to-r from-emerald-400 to-green-400 rounded-l-full" style={{ width: "20%" }} />
                <div className="bg-gradient-to-r from-sky-400 to-cyan-400" style={{ width: "75%" }} />
                <div className="bg-gray-400/60 rounded-r-full" style={{ width: "5%" }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="font-bold text-sky-900">20%</div>
                  <div className="text-sky-700/50">Meme Creator</div>
                </div>
                <div>
                  <div className="font-bold text-sky-900">75%</div>
                  <div className="text-sky-700/50">Shareholders</div>
                </div>
                <div>
                  <div className="font-bold text-sky-900">5%</div>
                  <div className="text-sky-700/50">Protocol</div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowGuide(false)}
              className="btn-glossy w-full py-3 rounded-2xl text-sm font-semibold mt-6"
            >
              Got it, let&apos;s go!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
