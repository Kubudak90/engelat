"use client";

import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from "@coinbase/onchainkit/transaction";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { encodeFunctionData, formatEther } from "viem";
import { LEADERBOARD_ABI, LEADERBOARD_ADDRESS } from "@/lib/leaderboard";
import { coinKey } from "@/lib/coins";

interface ScoreSubmitProps {
  coin: string;
  score: number;
  onSubmitted?: () => void;
}

// Fallback used only until the on-chain fee() read resolves. Matches the
// deployed default (0.000003 ETH); the contract is the source of truth.
const DEFAULT_FEE = BigInt("3000000000000");

export function ScoreSubmit({ coin, score, onSubmitted }: ScoreSubmitProps) {
  const { data: feeData } = useReadContract({
    address: LEADERBOARD_ADDRESS,
    abi: LEADERBOARD_ABI,
    functionName: "fee",
    chainId: base.id,
    query: { enabled: !!LEADERBOARD_ADDRESS },
  });

  if (!LEADERBOARD_ADDRESS) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: "#ffffff80", textAlign: "center" }}>
        Leaderboard not deployed yet
      </div>
    );
  }

  const fee = (feeData as bigint | undefined) ?? DEFAULT_FEE;

  // Raw call so we can attach `value` (the submission fee) to the contract write.
  const calls = [
    {
      to: LEADERBOARD_ADDRESS,
      data: encodeFunctionData({
        abi: LEADERBOARD_ABI,
        functionName: "submitScore",
        args: [coinKey(coin), BigInt(score)],
      }),
      value: fee,
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        width: "100%",
      }}
    >
      <Wallet>
        <ConnectWallet />
        <WalletDropdown>
          <WalletDropdownDisconnect />
        </WalletDropdown>
      </Wallet>

      <Transaction chainId={base.id} calls={calls} onSuccess={onSubmitted}>
        <TransactionButton text={`Submit Score · ${formatEther(fee)} ETH`} />
        <TransactionStatus>
          <TransactionStatusLabel />
          <TransactionStatusAction />
        </TransactionStatus>
      </Transaction>
      <p style={{ fontSize: 11, color: "#ffffff66", textAlign: "center", maxWidth: 280 }}>
        Base mainnet · only a new personal best is recorded.
      </p>
    </div>
  );
}
