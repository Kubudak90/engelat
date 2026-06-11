// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Leaderboard} from "../src/Leaderboard.sol";

/// @notice Deploys the Leaderboard contract.
/// @dev Signer is supplied by the forge CLI (`--account <name>`, `--private-key`,
///      or `--ledger`), so no private key needs to live in env/plaintext.
contract DeployLeaderboard is Script {
    function run() external returns (Leaderboard board) {
        vm.startBroadcast();
        board = new Leaderboard();
        vm.stopBroadcast();
        console.log("Leaderboard deployed at:", address(board));
    }
}
