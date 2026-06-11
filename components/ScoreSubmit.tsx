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
import { baseSepolia } from "wagmi/chains";
import { LEADERBOARD_ABI, LEADERBOARD_ADDRESS } from "@/lib/leaderboard";
import type { ContractFunctionParameters } from "viem";

interface ScoreSubmitProps {
  score: number;
  onSubmitted?: () => void;
}

export function ScoreSubmit({ score, onSubmitted }: ScoreSubmitProps) {
  const contracts = [
    {
      address: LEADERBOARD_ADDRESS,
      abi: LEADERBOARD_ABI,
      functionName: "submitScore",
      args: [BigInt(score)],
    },
  ] as ContractFunctionParameters[];

  if (!LEADERBOARD_ADDRESS) {
    return (
      <div
        style={{
          padding: 12,
          fontSize: 13,
          color: "#ffffff80",
          textAlign: "center",
        }}
      >
        Leaderboard not deployed yet
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        width: "100%",
      }}
    >
      <Wallet>
        <ConnectWallet />
        <WalletDropdown>
          <WalletDropdownDisconnect />
        </WalletDropdown>
      </Wallet>

      <Transaction
        chainId={baseSepolia.id}
        calls={contracts}
        onSuccess={onSubmitted}
      >
        <TransactionButton text="Submit Score" />
        <TransactionStatus>
          <TransactionStatusLabel />
          <TransactionStatusAction />
        </TransactionStatus>
      </Transaction>
    </div>
  );
}
