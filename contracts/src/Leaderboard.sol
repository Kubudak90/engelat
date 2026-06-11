// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Leaderboard {
    // bestScore[coin][player]
    mapping(bytes32 => mapping(address => uint256)) public bestScore;

    mapping(bytes32 => address[]) private _topPlayers;
    mapping(bytes32 => uint256[]) private _topScores;

    event ScoreSubmitted(bytes32 indexed coin, address indexed player, uint256 score);

    function submitScore(bytes32 coin, uint256 score) external {
        if (score <= bestScore[coin][msg.sender]) {
            return;
        }

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
}
