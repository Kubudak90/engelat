export const LEADERBOARD_ADDRESS = process.env
  .NEXT_PUBLIC_LEADERBOARD_ADDRESS as `0x${string}` | undefined;

export const LEADERBOARD_ABI = [
  {
    type: "function",
    name: "submitScore",
    inputs: [
      { name: "coin", type: "bytes32" },
      { name: "score", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "fee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTop",
    inputs: [{ name: "coin", type: "bytes32" }],
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
      { name: "coin", type: "bytes32", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "score", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
