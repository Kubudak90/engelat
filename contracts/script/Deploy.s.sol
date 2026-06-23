// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Leaderboard} from "../src/Leaderboard.sol";

/// @notice Deploys the Leaderboard contract.
/// @dev Signer is supplied by the forge CLI (`--account <name>`, `--private-key`,
///      or `--ledger`). The deployer becomes `owner`. `FEE_RECIPIENT` and
///      `LEADERBOARD_FEE_WEI` are read from env (recipient defaults to the
///      deployer; fee defaults to 0.000003 ether).
contract DeployLeaderboard is Script {
    function run() external returns (Leaderboard board) {
        uint256 fee = vm.envOr("LEADERBOARD_FEE_WEI", uint256(0.000003 ether));
        address deployer = msg.sender;
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        vm.startBroadcast();
        board = new Leaderboard(feeRecipient, fee);
        vm.stopBroadcast();

        console.log("Leaderboard deployed at:", address(board));
        console.log("owner:", board.owner());
        console.log("feeRecipient:", board.feeRecipient());
        console.log("fee (wei):", board.fee());
    }
}
