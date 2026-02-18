"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ipfsToUrl,
  handleIpfsImgError,
  formatTimeRemaining,
  getCategoryPhase,
  PHASE_CONFIG,
  shortenAddress,
  type Phase,
} from "@/contract";
import { monadTestnet } from "@/wagmi";

// ── Types ──────────────────────────────────────────────────
interface MemeData {
  id: bigint;
  categoryId: bigint;
  creator: string;
  ipfsHash: string;
  voteCount: bigint;
  totalShares: bigint;
  sharePool: bigint;
}

interface ScoreData {
  normVotes: bigint;
  normPool: bigint;
  score: bigint;
}

// ── Page ───────────────────────────────────────────────────
export default function CategoryPage() {
  const { id } = useParams();
  const categoryId = BigInt(id as string);
  const { address, isConnected } = useAccount();
  const safeAddr = address ?? "0x0000000000000000000000000000000000000000" as `0x${string}`;

  // ── Local State ─────────────────────────────────────────
  const [voteAllocations, setVoteAllocations] = useState<
    Record<string, number>
  >({});
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedMemeForBet, setSelectedMemeForBet] = useState<bigint | null>(
    null
  );
  const [betAmount, setBetAmount] = useState("1");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [ipfsHash, setIpfsHash] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // ── Contract Reads ──────────────────────────────────────
  const { data: categoryRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "categories",
    args: [categoryId],
    query: { refetchInterval: 300000 },
  });

  const { data: memeIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getCategoryMemes",
    args: [categoryId],
    query: { refetchInterval: 300000 },
  });

  const { data: userVotesUsed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "votesUsed",
    args: [categoryId, safeAddr],
    query: { enabled: !!address, refetchInterval: 300000 },
  });

  const { data: userHasBet } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "hasBet",
    args: [categoryId, safeAddr],
    query: { enabled: !!address, refetchInterval: 300000 },
  });

  const { data: userBetMemeId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "userBetMeme",
    args: [categoryId, safeAddr],
    query: { enabled: !!address },
  });

  const { data: userHasSubmitted } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "hasSubmitted",
    args: [categoryId, safeAddr],
    query: { enabled: !!address },
  });

  // Batch read all memes
  const memeContracts = useMemo(() => {
    if (!memeIds) return [];
    return (memeIds as bigint[]).map((mid) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "memes",
      args: [mid],
    }));
  }, [memeIds]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memesRaw } = useReadContracts({
    contracts: memeContracts as any,
    query: { enabled: memeContracts.length > 0, refetchInterval: 300000 },
  });

  // Batch read scores
  const scoreContracts = useMemo(() => {
    if (!memeIds) return [];
    return (memeIds as bigint[]).map((mid) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getMemeScore",
      args: [mid],
    }));
  }, [memeIds]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scoresRaw } = useReadContracts({
    contracts: scoreContracts as any,
    query: { enabled: scoreContracts.length > 0, refetchInterval: 300000 },
  });

  // Batch read share prices
  const priceContracts = useMemo(() => {
    if (!memeIds) return [];
    return (memeIds as bigint[]).map((mid) => ({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "getSharePrice",
      args: [mid],
    }));
  }, [memeIds]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pricesRaw } = useReadContracts({
    contracts: priceContracts as any,
    query: { enabled: priceContracts.length > 0, refetchInterval: 300000 },
  });

  // Cost for bet modal
  const { data: shareCost } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getShareCost",
    args: [selectedMemeForBet!, BigInt(betAmount || "1")],
    query: {
      enabled: !!selectedMemeForBet && !!betAmount && parseInt(betAmount) > 0,
      refetchInterval: 30000,
    },
  });

  // ── Contract Writes ─────────────────────────────────────
  const {
    writeContract: writeVote,
    data: voteTxHash,
    isPending: isVotePending,
    error: voteError,
  } = useWriteContract();
  const { isLoading: isVoteConfirming, isSuccess: isVoteSuccess } =
    useWaitForTransactionReceipt({ hash: voteTxHash });

  const {
    writeContract: writeBet,
    data: betTxHash,
    isPending: isBetPending,
    error: betError,
  } = useWriteContract();
  const { isLoading: isBetConfirming, isSuccess: isBetSuccess } =
    useWaitForTransactionReceipt({ hash: betTxHash });

  const {
    writeContract: writeSubmit,
    data: submitTxHash,
    isPending: isSubmitPending,
    error: submitError,
  } = useWriteContract();
  const { isLoading: isSubmitConfirming, isSuccess: isSubmitSuccess } =
    useWaitForTransactionReceipt({ hash: submitTxHash });

  const {
    writeContract: writeResolve,
    data: resolveTxHash,
    isPending: isResolvePending,
    error: resolveError,
  } = useWriteContract();
  const { isLoading: isResolveConfirming } = useWaitForTransactionReceipt({
    hash: resolveTxHash,
  });

  const {
    writeContract: writeClaim,
    data: claimTxHash,
    isPending: isClaimPending,
    error: claimError,
  } = useWriteContract();
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({
    hash: claimTxHash,
  });

  // ── Derived Data ────────────────────────────────────────
  const category = categoryRaw as
    | [bigint, string, string, bigint, bigint, bigint, bigint, bigint, boolean, bigint]
    | undefined;

  const catTitle = category?.[1] ?? "Loading...";
  const catStake = category?.[3] ?? 0n;
  const catSubDeadline = Number(category?.[4] ?? 0);
  const catVoteDeadline = Number(category?.[5] ?? 0);
  const catPot = category?.[6] ?? 0n;
  const catMemeCount = Number(category?.[7] ?? 0);
  const catResolved = category?.[8] ?? false;
  const catWinningMemeId = category?.[9] ?? 0n;

  const phase: Phase = category
    ? getCategoryPhase(catSubDeadline, catVoteDeadline, catResolved)
    : "submissions";
  const phaseConfig = PHASE_CONFIG[phase];

  const memesArr: MemeData[] = useMemo(() => {
    if (!memesRaw) return [];
    return memesRaw
      .filter((r) => r.status === "success" && r.result)
      .map((r) => {
        const d = r.result as [bigint, bigint, string, string, bigint, bigint, bigint];
        return {
          id: d[0],
          categoryId: d[1],
          creator: d[2],
          ipfsHash: d[3],
          voteCount: d[4],
          totalShares: d[5],
          sharePool: d[6],
        };
      });
  }, [memesRaw]);

  const scoresArr: (ScoreData | null)[] = useMemo(() => {
    if (!scoresRaw) return [];
    return scoresRaw.map((r) => {
      if (r.status !== "success" || !r.result) return null;
      const d = r.result as [bigint, bigint, bigint];
      return { normVotes: d[0], normPool: d[1], score: d[2] };
    });
  }, [scoresRaw]);

  const pricesArr: (bigint | null)[] = useMemo(() => {
    if (!pricesRaw) return [];
    return pricesRaw.map((r) =>
      r.status === "success" ? (r.result as bigint) : null
    );
  }, [pricesRaw]);

  // Leaderboard sorted by score
  const leaderboard = useMemo(() => {
    return memesArr
      .map((m, i) => ({
        meme: m,
        score: scoresArr[i],
        price: pricesArr[i],
        index: i,
      }))
      .sort((a, b) => {
        const sa = Number(a.score?.score ?? 0n);
        const sb = Number(b.score?.score ?? 0n);
        return sb - sa;
      });
  }, [memesArr, scoresArr, pricesArr]);

  const hasVotedOnChain = Number(userVotesUsed ?? 0) > 0;
  const hasBetOnChain = userHasBet as boolean | undefined;

  const totalAllocated = Object.values(voteAllocations).reduce(
    (a, b) => a + b,
    0
  );
  const votesRemaining = 5 - totalAllocated;

  // ── Handlers ────────────────────────────────────────────
  const addVote = (memeId: string) => {
    if (votesRemaining <= 0 || hasVotedOnChain) return;
    setVoteAllocations((prev) => ({
      ...prev,
      [memeId]: (prev[memeId] || 0) + 1,
    }));
  };

  const removeVote = (memeId: string) => {
    if (hasVotedOnChain) return;
    setVoteAllocations((prev) => {
      const current = prev[memeId] || 0;
      if (current <= 0) return prev;
      const updated = { ...prev, [memeId]: current - 1 };
      if (updated[memeId] === 0) delete updated[memeId];
      return updated;
    });
  };

  const submitVotes = () => {
    const entries = Object.entries(voteAllocations).filter(
      ([, v]) => v > 0
    );
    if (entries.length === 0) return;

    const mIds = entries.map(([k]) => BigInt(k));
    const amounts = entries.map(([, v]) => BigInt(v));

    writeVote({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "vote",
      args: [categoryId, mIds, amounts],
      chainId: monadTestnet.id,
    });
  };

  const submitBet = () => {
    if (!selectedMemeForBet || !shareCost) return;
    writeBet({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "buyShares",
      args: [selectedMemeForBet, BigInt(betAmount)],
      value: shareCost as bigint,
      chainId: monadTestnet.id,
    });
  };

  const handleFileUpload = async (file: File) => {
    setUploadError("");
    setIsUploading(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
      const apiSecret = process.env.NEXT_PUBLIC_PINATA_SECRET;
      if (!apiKey || !apiSecret) {
        throw new Error("Pinata API keys not configured");
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          pinata_api_key: apiKey,
          pinata_secret_api_key: apiSecret,
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Pinata upload failed: ${err}`);
      }
      const data = await res.json();
      setIpfsHash(data.IpfsHash);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const submitMeme = () => {
    if (!ipfsHash) return;
    writeSubmit({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "submitMeme",
      args: [categoryId, ipfsHash],
      value: catStake,
      chainId: monadTestnet.id,
    });
  };

  const resolveCategory = () => {
    writeResolve({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "resolveCategory",
      args: [categoryId],
      chainId: monadTestnet.id,
    });
  };

  const claimWinnings = () => {
    writeClaim({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "claim",
      args: [categoryId],
      chainId: monadTestnet.id,
    });
  };

  // Close modals on success
  useEffect(() => {
    if (isBetSuccess) {
      setShowBetModal(false);
      setSelectedMemeForBet(null);
      setBetAmount("1");
    }
  }, [isBetSuccess]);

  useEffect(() => {
    if (isSubmitSuccess) {
      setShowSubmitModal(false);
      setIpfsHash("");
      setUploadError("");
    }
  }, [isSubmitSuccess]);

  const deadline =
    phase === "submissions" ? catSubDeadline : catVoteDeadline;

  // Extract readable error messages
  const parseError = (err: Error | null) => {
    if (!err) return null;
    const msg = err.message || String(err);
    // Extract the revert reason if present
    const revertMatch = msg.match(/reason:\s*(.+?)(?:\n|$)/);
    if (revertMatch) return revertMatch[1].trim();
    const shortMatch = msg.match(/Details:\s*(.+?)(?:\n|$)/);
    if (shortMatch) return shortMatch[1].trim();
    // User rejected
    if (msg.includes("User rejected") || msg.includes("user rejected"))
      return "Transaction rejected by user";
    // Truncate long messages
    if (msg.length > 120) return msg.slice(0, 120) + "...";
    return msg;
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <main className="min-h-screen p-6 md:p-10">
      {/* Nav */}
      <nav className="glass-strong rounded-2xl px-6 py-4 flex items-center justify-between mb-8 max-w-7xl mx-auto">
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

      <div className="max-w-7xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 text-sm mb-4"
        >
          &larr; All categories
        </Link>

        {/* ── Category Header ──────────────────────────── */}
        <div className="glass-strong rounded-3xl p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${phaseConfig.color}`}
                >
                  {phaseConfig.label}
                </span>
                <span className="text-xs text-sky-700/50 font-mono">
                  #{id}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-sky-900">
                {catTitle}
              </h1>
            </div>
            <div className="flex gap-3">
              <div className="glass rounded-xl px-4 py-2 text-center">
                <div className="text-xs text-sky-700/50">Prize Pool</div>
                <div className="font-bold text-sky-900">
                  {parseFloat(formatEther(catPot)).toFixed(4)} MON
                </div>
              </div>
              <div className="glass rounded-xl px-4 py-2 text-center">
                <div className="text-xs text-sky-700/50">Memes</div>
                <div className="font-bold text-sky-900">{catMemeCount}</div>
              </div>
              <div className="glass rounded-xl px-4 py-2 text-center">
                <div className="text-xs text-sky-700/50">Time Left</div>
                <div className="font-bold text-sky-900">
                  {formatTimeRemaining(deadline)}
                </div>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3">
            {phase === "submissions" && isConnected && !userHasSubmitted && (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="btn-glossy-green px-5 py-2 rounded-full text-sm font-semibold"
              >
                + Submit Meme ({formatEther(catStake)} MON)
              </button>
            )}
            {phase === "voting" && isConnected && !hasVotedOnChain && (
              <div className="flex items-center gap-3">
                <div className="glass rounded-full px-4 py-2 text-sm font-semibold text-sky-900">
                  Votes: {5 - votesRemaining}/5 allocated
                </div>
                <button
                  onClick={submitVotes}
                  disabled={
                    totalAllocated === 0 || isVotePending || isVoteConfirming
                  }
                  className="btn-glossy px-5 py-2 rounded-full text-sm font-semibold"
                >
                  {isVotePending
                    ? "Confirm..."
                    : isVoteConfirming
                    ? "Submitting..."
                    : `Submit ${totalAllocated} Vote${totalAllocated !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}
            {phase === "voting" && hasVotedOnChain && (
              <div className="glass rounded-full px-4 py-2 text-sm text-sky-700/70">
                Votes submitted ({Number(userVotesUsed)}/5 used)
              </div>
            )}
            {phase === "awaiting_resolution" && isConnected && (
              <button
                onClick={resolveCategory}
                disabled={isResolvePending || isResolveConfirming}
                className="btn-glossy-pink px-5 py-2 rounded-full text-sm font-semibold"
              >
                {isResolvePending || isResolveConfirming
                  ? "Resolving..."
                  : "Resolve Category"}
              </button>
            )}
            {phase === "resolved" && isConnected && (
              <button
                onClick={claimWinnings}
                disabled={isClaimPending || isClaimConfirming}
                className="btn-glossy-green px-5 py-2 rounded-full text-sm font-semibold"
              >
                {isClaimPending || isClaimConfirming
                  ? "Claiming..."
                  : "Claim Winnings"}
              </button>
            )}
          </div>
          {/* Inline errors for action bar */}
          {(voteError || resolveError || claimError) && (
            <p className="text-sm text-red-500 mt-3 break-words">
              {parseError(voteError || resolveError || claimError)}
            </p>
          )}
        </div>

        {/* ── Main Content ─────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Meme Grid */}
          <div className="flex-1">
            {memesArr.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center">
                <p className="text-sky-700/50 text-lg">
                  {phase === "submissions"
                    ? "No memes yet. Be the first to submit!"
                    : "No memes were submitted."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {memesArr.map((meme, idx) => {
                  const memeIdStr = meme.id.toString();
                  const allocated = voteAllocations[memeIdStr] || 0;
                  const score = scoresArr[idx];
                  const price = pricesArr[idx];
                  const isWinner =
                    catResolved && meme.id === catWinningMemeId;
                  const userBetOnThis =
                    hasBetOnChain && userBetMemeId === meme.id;

                  return (
                    <div
                      key={memeIdStr}
                      className={`glass rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-bubble ${
                        isWinner
                          ? "ring-2 ring-yellow-400 shadow-[0_0_24px_rgba(250,204,21,0.3)]"
                          : ""
                      }`}
                    >
                      {/* Meme Image */}
                      <div className="relative aspect-square bg-gradient-to-br from-sky-100 to-cyan-50 overflow-hidden">
                        {meme.ipfsHash ? (
                          <img
                            src={ipfsToUrl(meme.ipfsHash)}
                            alt={`Meme #${meme.id}`}
                            className="w-full h-full object-cover"
                            onError={handleIpfsImgError(meme.ipfsHash)}
                          />
                        ) : null}
                        {isWinner && (
                          <div className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            WINNER
                          </div>
                        )}
                        {userBetOnThis && (
                          <div className="absolute top-3 right-3 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            YOUR BET
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 glass-dark rounded-lg px-2 py-1 text-xs text-white font-mono">
                          #{Number(meme.id)}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-sky-600/60 font-mono">
                            by {shortenAddress(meme.creator)}
                          </span>
                          {score && (
                            <span className="text-xs font-bold text-sky-900 bg-sky-100 px-2 py-0.5 rounded-full">
                              Score:{" "}
                              {(
                                Number(score.score) / 1e16
                              ).toFixed(1)}
                            </span>
                          )}
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="glass rounded-lg py-1.5">
                            <div className="text-[10px] text-sky-700/50">
                              Votes
                            </div>
                            <div className="text-sm font-bold text-sky-900">
                              {Number(meme.voteCount)}
                            </div>
                          </div>
                          <div className="glass rounded-lg py-1.5">
                            <div className="text-[10px] text-sky-700/50">
                              Shares
                            </div>
                            <div className="text-sm font-bold text-sky-900">
                              {Number(meme.totalShares)}
                            </div>
                          </div>
                          <div className="glass rounded-lg py-1.5">
                            <div className="text-[10px] text-sky-700/50">
                              Pool
                            </div>
                            <div className="text-sm font-bold text-sky-900">
                              {parseFloat(
                                formatEther(meme.sharePool)
                              ).toFixed(3)}
                            </div>
                          </div>
                        </div>

                        {/* Vote Controls */}
                        {phase === "voting" && !hasVotedOnChain && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeVote(memeIdStr)}
                                disabled={allocated === 0}
                                className="w-8 h-8 rounded-full glass font-bold text-sky-700 hover:bg-white/50 disabled:opacity-30 transition-all text-sm"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-bold text-sky-900 text-lg">
                                {allocated}
                              </span>
                              <button
                                onClick={() => addVote(memeIdStr)}
                                disabled={votesRemaining <= 0}
                                className="w-8 h-8 rounded-full glass font-bold text-sky-700 hover:bg-white/50 disabled:opacity-30 transition-all text-sm"
                              >
                                +
                              </button>
                            </div>

                            {!hasBetOnChain && (
                              <button
                                onClick={() => {
                                  setSelectedMemeForBet(meme.id);
                                  setBetAmount("1");
                                  setShowBetModal(true);
                                }}
                                className="btn-glossy-pink px-4 py-1.5 rounded-full text-xs font-bold"
                              >
                                BET
                              </button>
                            )}
                          </div>
                        )}

                        {/* Show price */}
                        {phase === "voting" && price && (
                          <div className="text-[11px] text-sky-600/50 text-right">
                            Share price:{" "}
                            {parseFloat(formatEther(price)).toFixed(4)} MON
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Leaderboard Sidebar ─────────────────────── */}
          <div className="lg:w-80 shrink-0">
            <div className="glass-strong rounded-2xl p-5 sticky top-6">
              <h3 className="text-lg font-bold text-sky-900 mb-4">
                Leaderboard
              </h3>

              {leaderboard.length === 0 ? (
                <p className="text-sm text-sky-700/50">No memes yet</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry, rank) => {
                    const m = entry.meme;
                    const s = entry.score;
                    const isWinner =
                      catResolved && m.id === catWinningMemeId;

                    return (
                      <div
                        key={m.id.toString()}
                        className={`glass rounded-xl p-3 transition-all ${
                          isWinner ? "ring-2 ring-yellow-400" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              rank === 0
                                ? "bg-glossy-btn text-white shadow-glossy"
                                : rank === 1
                                ? "bg-sky-200 text-sky-800"
                                : rank === 2
                                ? "bg-sky-100 text-sky-700"
                                : "bg-white/50 text-sky-600"
                            }`}
                          >
                            {rank + 1}
                          </div>

                          {/* Tiny meme thumb */}
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-sky-50 shrink-0">
                            {m.ipfsHash && (
                              <img
                                src={ipfsToUrl(m.ipfsHash)}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={handleIpfsImgError(m.ipfsHash)}
                              />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-sky-700/60 truncate">
                              #{Number(m.id)} by{" "}
                              {shortenAddress(m.creator)}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-sky-600/50">
                                {Number(m.voteCount)}v
                              </span>
                              <span className="text-[10px] text-sky-600/50">
                                {parseFloat(
                                  formatEther(m.sharePool)
                                ).toFixed(3)}{" "}
                                MON
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-sky-900">
                              {s
                                ? (Number(s.score) / 1e16).toFixed(1)
                                : "0"}
                            </div>
                            <div className="text-[10px] text-sky-600/50">
                              pts
                            </div>
                          </div>
                        </div>

                        {/* Score breakdown bar */}
                        {s && Number(s.score) > 0 && (
                          <div className="mt-2 flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-sky-400 rounded-l-full"
                              style={{
                                width: `${
                                  (Number(s.normVotes) * 60) /
                                  (Number(s.score) || 1)
                                }%`,
                              }}
                            />
                            <div
                              className="bg-purple-400 rounded-r-full"
                              style={{
                                width: `${
                                  (Number(s.normPool) * 40) /
                                  (Number(s.score) || 1)
                                }%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-5 text-[10px] text-sky-700/50">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-sky-400" />
                  Votes (60%)
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  Market (40%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bet Modal ──────────────────────────────────── */}
      {showBetModal && selectedMemeForBet && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBetModal(false);
              setSelectedMemeForBet(null);
            }
          }}
        >
          <div className="glass-strong rounded-3xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-sky-900 mb-2">
              Place Prediction Bet
            </h3>
            <p className="text-sm text-sky-700/60 mb-6">
              Betting on Meme #{Number(selectedMemeForBet)}. You can only bet
              on one meme per category — this locks your choice.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-sky-800 mb-2">
                  Number of Shares
                </label>
                <input
                  type="number"
                  min="1"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="aero-input"
                />
              </div>

              <div className="glass rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-sky-700/60">Total Cost</span>
                  <span className="font-bold text-sky-900">
                    {shareCost
                      ? `${parseFloat(
                          formatEther(shareCost as bigint)
                        ).toFixed(6)} MON`
                      : "..."}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sky-700/60">Shares</span>
                  <span className="font-semibold text-sky-900">
                    {betAmount}
                  </span>
                </div>
              </div>

              {betError && (
                <p className="text-sm text-red-500 break-words">
                  {parseError(betError)}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBetModal(false);
                    setSelectedMemeForBet(null);
                  }}
                  className="flex-1 glass py-2.5 rounded-2xl text-sm font-semibold text-sky-700 hover:bg-white/50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitBet}
                  disabled={isBetPending || isBetConfirming}
                  className="flex-1 btn-glossy-pink py-2.5 rounded-2xl text-sm font-semibold"
                >
                  {isBetPending
                    ? "Confirm..."
                    : isBetConfirming
                    ? "Placing..."
                    : "Place Bet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Meme Modal ──────────────────────────── */}
      {showSubmitModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSubmitModal(false);
          }}
        >
          <div className="glass-strong rounded-3xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold text-sky-900 mb-2">
              Submit Your Meme
            </h3>
            <p className="text-sm text-sky-700/60 mb-6">
              Upload an image or paste an IPFS hash / URL. Costs{" "}
              {formatEther(catStake)} MON to enter.
            </p>

            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-semibold text-sky-800 mb-2">
                  Upload Image
                </label>
                <label
                  className={`block glass rounded-2xl p-6 text-center cursor-pointer hover:bg-white/50 transition-all ${
                    isUploading ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <div className="space-y-2">
                      <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-sm text-sky-700/70">Uploading to IPFS...</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-2xl text-sky-400">+</div>
                      <p className="text-sm text-sky-700/70">
                        Click to select an image
                      </p>
                      <p className="text-xs text-sky-600/40">PNG, JPG, GIF, WEBP</p>
                    </div>
                  )}
                </label>
                {uploadError && (
                  <p className="text-xs text-red-500 mt-2">{uploadError}</p>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-sky-200/50" />
                <span className="text-xs text-sky-600/40 font-semibold">OR</span>
                <div className="flex-1 h-px bg-sky-200/50" />
              </div>

              {/* Manual hash/URL input */}
              <div>
                <label className="block text-sm font-semibold text-sky-800 mb-2">
                  IPFS Hash or Image URL
                </label>
                <input
                  type="text"
                  value={ipfsHash}
                  onChange={(e) => setIpfsHash(e.target.value)}
                  placeholder="QmXoypiz... or https://..."
                  className="aero-input"
                />
              </div>

              {/* Preview */}
              {ipfsHash && (
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-sky-700/50 mb-2">Preview</p>
                  <div className="aspect-square rounded-lg overflow-hidden bg-sky-50">
                    <img
                      src={ipfsToUrl(ipfsHash)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={handleIpfsImgError(ipfsHash)}
                    />
                  </div>
                </div>
              )}

              <div className="glass rounded-xl p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-sky-700/60">Entry stake</span>
                  <span className="font-bold text-sky-900">
                    {formatEther(catStake)} MON
                  </span>
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-red-500 break-words">
                  {parseError(submitError)}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="flex-1 glass py-2.5 rounded-2xl text-sm font-semibold text-sky-700 hover:bg-white/50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitMeme}
                  disabled={!ipfsHash || isUploading || isSubmitPending || isSubmitConfirming}
                  className="flex-1 btn-glossy-green py-2.5 rounded-2xl text-sm font-semibold"
                >
                  {isSubmitPending
                    ? "Confirm..."
                    : isSubmitConfirming
                    ? "Submitting..."
                    : "Submit Meme"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
