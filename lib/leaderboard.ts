export const LEADERBOARD_ADDRESS = process.env
  .NEXT_PUBLIC_LEADERBOARD_ADDRESS as `0x${string}` | undefined;

export const LEADERBOARD_ABI = [
  {
    type: "function",
    name: "submitScore",
    inputs: [{ name: "score", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTop",
    inputs: [],
    outputs: [
      { name: "players", type: "address[]" },
      { name: "scores", type: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ScoreSubmitted",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "score", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
