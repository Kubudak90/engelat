// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Leaderboard.sol";

contract LeaderboardTest is Test {
    Leaderboard public lb;

    bytes32 constant BTC = bytes32("BTC");
    bytes32 constant ETH = bytes32("ETH");

    function setUp() public {
        lb = new Leaderboard();
    }

    function test_BestScoreOnlyIncreases() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(BTC, 100);
        assertEq(lb.bestScore(BTC, alice), 100);

        vm.prank(alice);
        lb.submitScore(BTC, 50);
        assertEq(lb.bestScore(BTC, alice), 100);
    }

    function test_LowerScoreDoesNotAffectBoard() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(BTC, 100);

        (address[] memory players1, uint256[] memory scores1) = lb.getTop(BTC);
        assertEq(players1.length, 1);
        assertEq(scores1[0], 100);

        vm.prank(alice);
        lb.submitScore(BTC, 50);

        (address[] memory players2, uint256[] memory scores2) = lb.getTop(BTC);
        assertEq(players2.length, 1);
        assertEq(scores2[0], 100);
    }

    function test_TopTenSortedDescending() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        address carol = makeAddr("carol");

        vm.prank(alice);
        lb.submitScore(BTC, 50);
        vm.prank(bob);
        lb.submitScore(BTC, 150);
        vm.prank(carol);
        lb.submitScore(BTC, 100);

        (, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(scores.length, 3);
        assertEq(scores[0], 150);
        assertEq(scores[1], 100);
        assertEq(scores[2], 50);
    }

    function test_TopTenCappedAtTen() public {
        for (uint256 i = 0; i < 12; i++) {
            address p = makeAddr(string(abi.encodePacked("p", vm.toString(i))));
            vm.prank(p);
            lb.submitScore(BTC, (12 - i) * 10);
        }

        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 10);
        assertEq(scores.length, 10);
        assertEq(scores[0], 120);
        assertEq(scores[9], 30);
    }

    function test_ImproveInPlaceNoDuplicate() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        lb.submitScore(BTC, 100);
        vm.prank(bob);
        lb.submitScore(BTC, 200);
        vm.prank(alice);
        lb.submitScore(BTC, 150);

        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 2);
        assertEq(scores[0], 200);
        assertEq(scores[1], 150);
    }

    function test_ImproveToFirstInPlace() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        lb.submitScore(BTC, 100);
        vm.prank(bob);
        lb.submitScore(BTC, 200);
        vm.prank(alice);
        lb.submitScore(BTC, 300);

        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 2);
        assertEq(scores[0], 300);
        assertEq(scores[1], 200);
        assertEq(players[0], alice);
        assertEq(players[1], bob);
    }

    function test_CoinsAreIsolated() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(BTC, 100);
        vm.prank(alice);
        lb.submitScore(ETH, 50);

        assertEq(lb.bestScore(BTC, alice), 100);
        assertEq(lb.bestScore(ETH, alice), 50);

        (, uint256[] memory btcScores) = lb.getTop(BTC);
        (, uint256[] memory ethScores) = lb.getTop(ETH);
        assertEq(btcScores.length, 1);
        assertEq(btcScores[0], 100);
        assertEq(ethScores.length, 1);
        assertEq(ethScores[0], 50);
    }

    function test_EventEmittedWithCorrectArgs() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Leaderboard.ScoreSubmitted(BTC, alice, 123);
        lb.submitScore(BTC, 123);
    }

    function test_EventNotEmittedForLowerScore() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(BTC, 100);

        vm.recordLogs();
        vm.prank(alice);
        lb.submitScore(BTC, 50);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    function test_GetTopEmpty() public view {
        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 0);
        assertEq(scores.length, 0);
    }
}
