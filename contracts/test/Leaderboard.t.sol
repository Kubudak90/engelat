// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Leaderboard.sol";

contract LeaderboardTest is Test {
    Leaderboard public lb;

    function setUp() public {
        lb = new Leaderboard();
    }

    // --- bestScore only increases ---

    function test_BestScoreOnlyIncreases() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(100);
        assertEq(lb.bestScore(alice), 100);

        vm.prank(alice);
        lb.submitScore(50);
        assertEq(lb.bestScore(alice), 100); // unchanged
    }

    function test_LowerScoreDoesNotAffectBoard() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(100);

        (address[] memory players1, uint256[] memory scores1) = lb.getTop();
        assertEq(players1.length, 1);
        assertEq(scores1[0], 100);

        vm.prank(alice);
        lb.submitScore(50);

        (address[] memory players2, uint256[] memory scores2) = lb.getTop();
        assertEq(players2.length, 1);
        assertEq(scores2[0], 100); // board unchanged
    }

    // --- top-10 sorted descending and capped ---

    function test_TopTenSortedDescending() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        address carol = makeAddr("carol");

        vm.prank(alice);
        lb.submitScore(50);

        vm.prank(bob);
        lb.submitScore(150);

        vm.prank(carol);
        lb.submitScore(100);

        (, uint256[] memory scores) = lb.getTop();
        assertEq(scores.length, 3);
        assertEq(scores[0], 150);
        assertEq(scores[1], 100);
        assertEq(scores[2], 50);
    }

    function test_TopTenCappedAtTen() public {
        // 12 distinct players submit scores
        for (uint256 i = 0; i < 12; i++) {
            address p = makeAddr(string(abi.encodePacked("p", vm.toString(i))));
            vm.prank(p);
            lb.submitScore((12 - i) * 10); // 120, 110, 100, ... 10
        }

        (address[] memory players, uint256[] memory scores) = lb.getTop();
        assertEq(players.length, 10);
        assertEq(scores.length, 10);
        assertEq(scores[0], 120);
        assertEq(scores[9], 30); // lowest kept
    }

    // --- in-place update (no duplicate) ---

    function test_ImproveInPlaceNoDuplicate() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        lb.submitScore(100);

        vm.prank(bob);
        lb.submitScore(200);

        // Alice improves
        vm.prank(alice);
        lb.submitScore(150);

        (address[] memory players, uint256[] memory scores) = lb.getTop();
        assertEq(players.length, 2);
        assertEq(scores[0], 200); // bob still first
        assertEq(scores[1], 150); // alice moved up, no duplicate
    }

    function test_ImproveToFirstInPlace() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");

        vm.prank(alice);
        lb.submitScore(100);

        vm.prank(bob);
        lb.submitScore(200);

        // Alice surpasses bob
        vm.prank(alice);
        lb.submitScore(300);

        (address[] memory players, uint256[] memory scores) = lb.getTop();
        assertEq(players.length, 2);
        assertEq(scores[0], 300);
        assertEq(scores[1], 200);
        assertEq(players[0], alice);
        assertEq(players[1], bob);
    }

    // --- event emission ---

    function test_EventEmittedWithCorrectArgs() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit Leaderboard.ScoreSubmitted(alice, 123);
        lb.submitScore(123);
    }

    function test_EventNotEmittedForLowerScore() public {
        address alice = makeAddr("alice");

        vm.prank(alice);
        lb.submitScore(100);

        vm.recordLogs();
        vm.prank(alice);
        lb.submitScore(50);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 0);
    }

    // --- empty board ---

    function test_GetTopEmpty() public view {
        (address[] memory players, uint256[] memory scores) = lb.getTop();
        assertEq(players.length, 0);
        assertEq(scores.length, 0);
    }
}
