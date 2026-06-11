// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Leaderboard} from "../src/Leaderboard.sol";

/// @notice Deploys the Leaderboard contract. Requires env PRIVATE_KEY.
contract DeployLeaderboard is Script {
    function run() external returns (Leaderboard board) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        board = new Leaderboard();
        vm.stopBroadcast();
        console.log("Leaderboard deployed at:", address(board));
    }
}
