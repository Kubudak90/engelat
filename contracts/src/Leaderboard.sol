// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Engelat per-coin arcade leaderboard (Base mainnet)
/// @notice A new personal-best submission requires a tiny fee, which is
///         forwarded in full to `feeRecipient`. Submitting a score that does
///         not beat your current best reverts, so you never pay for a no-op.
contract Leaderboard {
    address public owner;
    address public feeRecipient;
    uint256 public fee; // wei required to submit a new high score

    // bestScore[coin][player]
    mapping(bytes32 => mapping(address => uint256)) public bestScore;

    mapping(bytes32 => address[]) private _topPlayers;
    mapping(bytes32 => uint256[]) private _topScores;

    event ScoreSubmitted(bytes32 indexed coin, address indexed player, uint256 score);
    event FeeUpdated(uint256 fee);
    event FeeRecipientUpdated(address indexed recipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error InsufficientFee();
    error NotHighScore();
    error FeeTransferFailed();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address feeRecipient_, uint256 fee_) {
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        feeRecipient = feeRecipient_;
        fee = fee_;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeRecipientUpdated(feeRecipient_);
        emit FeeUpdated(fee_);
    }

    function submitScore(bytes32 coin, uint256 score) external payable {
        if (msg.value < fee) revert InsufficientFee();
        if (score <= bestScore[coin][msg.sender]) revert NotHighScore();

        bestScore[coin][msg.sender] = score;

        address[] storage players = _topPlayers[coin];
        uint256[] storage scores = _topScores[coin];

        // Find existing index (if any)
        uint256 existingIndex = type(uint256).max;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == msg.sender) {
                existingIndex = i;
                break;
            }
        }

        // Remove existing entry by shifting left
        if (existingIndex != type(uint256).max) {
            for (uint256 i = existingIndex; i < players.length - 1; i++) {
                players[i] = players[i + 1];
                scores[i] = scores[i + 1];
            }
            players.pop();
            scores.pop();
        }

        // Find insertion point (descending order)
        uint256 insertAt = scores.length;
        for (uint256 i = 0; i < scores.length; i++) {
            if (score > scores[i]) {
                insertAt = i;
                break;
            }
        }

        // Insert at insertAt by shifting right
        players.push();
        scores.push();
        for (uint256 i = players.length - 1; i > insertAt; i--) {
            players[i] = players[i - 1];
            scores[i] = scores[i - 1];
        }
        players[insertAt] = msg.sender;
        scores[insertAt] = score;

        // Cap at 10
        if (players.length > 10) {
            players.pop();
            scores.pop();
        }

        emit ScoreSubmitted(coin, msg.sender, score);

        // Interactions last (checks-effects-interactions). Forward the whole
        // payment to the recipient; the contract never custodies funds and any
        // overpayment simply tips. feeRecipient is an EOA, so no reentrancy.
        if (msg.value > 0) {
            (bool ok, ) = feeRecipient.call{value: msg.value}("");
            if (!ok) revert FeeTransferFailed();
        }
    }

    function getTop(bytes32 coin)
        external
        view
        returns (address[] memory players, uint256[] memory scores)
    {
        address[] storage tp = _topPlayers[coin];
        uint256[] storage ts = _topScores[coin];
        uint256 len = tp.length;
        players = new address[](len);
        scores = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            players[i] = tp[i];
            scores[i] = ts[i];
        }
    }

    // --- Admin ---

    function setFee(uint256 fee_) external onlyOwner {
        fee = fee_;
        emit FeeUpdated(fee_);
    }

    function setFeeRecipient(address recipient_) external onlyOwner {
        if (recipient_ == address(0)) revert ZeroAddress();
        feeRecipient = recipient_;
        emit FeeRecipientUpdated(recipient_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
