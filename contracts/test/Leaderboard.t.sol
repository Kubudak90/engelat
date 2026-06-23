// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Leaderboard.sol";

contract LeaderboardTest is Test {
    Leaderboard public lb;

    bytes32 constant BTC = bytes32("BTC");
    bytes32 constant ETH = bytes32("ETH");

    uint256 constant FEE = 0.000003 ether;
    address treasury = makeAddr("treasury");

    function setUp() public {
        lb = new Leaderboard(treasury, FEE);
    }

    // Submit helper that funds the player and pays the exact fee.
    function _submit(address player, bytes32 coin, uint256 score) internal {
        vm.deal(player, player.balance + FEE);
        vm.prank(player);
        lb.submitScore{value: FEE}(coin, score);
    }

    function test_Deploy_SetsOwnerFeeRecipientAndFee() public view {
        assertEq(lb.owner(), address(this));
        assertEq(lb.feeRecipient(), treasury);
        assertEq(lb.fee(), FEE);
    }

    function test_BestScoreOnlyIncreases() public {
        address alice = makeAddr("alice");
        _submit(alice, BTC, 100);
        assertEq(lb.bestScore(BTC, alice), 100);

        // A non-improving score reverts (so the player never pays for a no-op).
        vm.deal(alice, FEE);
        vm.prank(alice);
        vm.expectRevert(Leaderboard.NotHighScore.selector);
        lb.submitScore{value: FEE}(BTC, 50);

        assertEq(lb.bestScore(BTC, alice), 100);
    }

    function test_RevertWhen_FeeTooLow() public {
        address alice = makeAddr("alice");
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(Leaderboard.InsufficientFee.selector);
        lb.submitScore{value: FEE - 1}(BTC, 100);
    }

    function test_FeeIsForwardedToRecipient() public {
        address alice = makeAddr("alice");
        uint256 before = treasury.balance;
        _submit(alice, BTC, 100);
        assertEq(treasury.balance, before + FEE);
        assertEq(address(lb).balance, 0); // contract never custodies funds
    }

    function test_Overpayment_TipsRecipient() public {
        address alice = makeAddr("alice");
        uint256 before = treasury.balance;
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        lb.submitScore{value: 0.01 ether}(BTC, 100);
        assertEq(treasury.balance, before + 0.01 ether);
    }

    function test_TopTenSortedDescending() public {
        _submit(makeAddr("alice"), BTC, 50);
        _submit(makeAddr("bob"), BTC, 150);
        _submit(makeAddr("carol"), BTC, 100);

        (, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(scores.length, 3);
        assertEq(scores[0], 150);
        assertEq(scores[1], 100);
        assertEq(scores[2], 50);
    }

    function test_TopTenCappedAtTen() public {
        for (uint256 i = 0; i < 12; i++) {
            address p = makeAddr(string(abi.encodePacked("p", vm.toString(i))));
            _submit(p, BTC, (12 - i) * 10);
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
        _submit(alice, BTC, 100);
        _submit(bob, BTC, 200);
        _submit(alice, BTC, 150);

        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 2);
        assertEq(scores[0], 200);
        assertEq(scores[1], 150);
    }

    function test_ImproveToFirstInPlace() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        _submit(alice, BTC, 100);
        _submit(bob, BTC, 200);
        _submit(alice, BTC, 300);

        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 2);
        assertEq(scores[0], 300);
        assertEq(scores[1], 200);
        assertEq(players[0], alice);
        assertEq(players[1], bob);
    }

    function test_CoinsAreIsolated() public {
        address alice = makeAddr("alice");
        _submit(alice, BTC, 100);
        _submit(alice, ETH, 50);

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
        vm.deal(alice, FEE);
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Leaderboard.ScoreSubmitted(BTC, alice, 123);
        lb.submitScore{value: FEE}(BTC, 123);
    }

    function test_GetTopEmpty() public view {
        (address[] memory players, uint256[] memory scores) = lb.getTop(BTC);
        assertEq(players.length, 0);
        assertEq(scores.length, 0);
    }

    // --- Admin ---

    function test_SetFee_OnlyOwner() public {
        lb.setFee(0.001 ether);
        assertEq(lb.fee(), 0.001 ether);

        vm.prank(makeAddr("mallory"));
        vm.expectRevert(Leaderboard.NotOwner.selector);
        lb.setFee(0);
    }

    function test_SetFeeRecipient_OnlyOwner() public {
        address next = makeAddr("next");
        lb.setFeeRecipient(next);
        assertEq(lb.feeRecipient(), next);

        vm.expectRevert(Leaderboard.ZeroAddress.selector);
        lb.setFeeRecipient(address(0));

        vm.prank(makeAddr("mallory"));
        vm.expectRevert(Leaderboard.NotOwner.selector);
        lb.setFeeRecipient(next);
    }

    function test_TransferOwnership() public {
        address next = makeAddr("next");
        lb.transferOwnership(next);
        assertEq(lb.owner(), next);

        vm.expectRevert(Leaderboard.NotOwner.selector);
        lb.setFee(0);
    }

    function test_Constructor_RejectsZeroRecipient() public {
        vm.expectRevert(Leaderboard.ZeroAddress.selector);
        new Leaderboard(address(0), FEE);
    }
}
