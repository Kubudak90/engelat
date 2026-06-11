// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Leaderboard {
    mapping(address => uint256) public bestScore;

    address[] private _topPlayers;
    uint256[] private _topScores;

    event ScoreSubmitted(address indexed player, uint256 score);

    function submitScore(uint256 score) external {
        if (score <= bestScore[msg.sender]) {
            return;
        }

        bestScore[msg.sender] = score;

        // Find existing index (if any)
        uint256 existingIndex = type(uint256).max;
        for (uint256 i = 0; i < _topPlayers.length; i++) {
            if (_topPlayers[i] == msg.sender) {
                existingIndex = i;
                break;
            }
        }

        // Remove existing entry by shifting left
        if (existingIndex != type(uint256).max) {
            for (uint256 i = existingIndex; i < _topPlayers.length - 1; i++) {
                _topPlayers[i] = _topPlayers[i + 1];
                _topScores[i] = _topScores[i + 1];
            }
            _topPlayers.pop();
            _topScores.pop();
        }

        // Find insertion point (descending order)
        uint256 insertAt = _topScores.length;
        for (uint256 i = 0; i < _topScores.length; i++) {
            if (score > _topScores[i]) {
                insertAt = i;
                break;
            }
        }

        // Insert at insertAt by shifting right
        _topPlayers.push();
        _topScores.push();
        for (uint256 i = _topPlayers.length - 1; i > insertAt; i--) {
            _topPlayers[i] = _topPlayers[i - 1];
            _topScores[i] = _topScores[i - 1];
        }
        _topPlayers[insertAt] = msg.sender;
        _topScores[insertAt] = score;

        // Cap at 10
        if (_topPlayers.length > 10) {
            _topPlayers.pop();
            _topScores.pop();
        }

        emit ScoreSubmitted(msg.sender, score);
    }

    function getTop()
        external
        view
        returns (address[] memory players, uint256[] memory scores)
    {
        uint256 len = _topPlayers.length;
        players = new address[](len);
        scores = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            players[i] = _topPlayers[i];
            scores[i] = _topScores[i];
        }
        return (players, scores);
    }
}
