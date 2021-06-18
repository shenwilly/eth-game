// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IWETH } from "./interfaces/IWETH.sol";
import { IGameVault } from "./interfaces/IGameVault.sol";

contract GameController is Ownable {
    using SafeERC20 for IERC20;

    struct Game {
        string name;
        string code;
    }

    struct GameMatch {
        address[] players; 
        uint winner; // 0 is reserved for invalid result
        Game game;
        address token;
        uint amount;
    }

    Game[] games;
    GameMatch[] gameMatches;

    address public vault;
    uint lockDuration; // timestamp

    // TODO: events
    
    constructor(address _vault, uint _duration) {
        vault = _vault;
        lockDuration = _duration;
    }

    function addGame(string calldata _name, string calldata _code) public onlyOwner {
        games.push(
            Game({
                name: _name,
                code: _code
            })
        );
    }

    function addGameMatch(
        uint _gameId, address[] calldata _players, uint _winner, address _token, uint _amount
    ) public onlyOwner {
        require(games.length > _gameId, "Invalid gameId");
        require(_players.length == 2, "Game requires 2 players");
        require(_players.length >= _winner, "Invalid winner");
        require(IGameVault(vault).getAsset(_token), "Token not supported");
        for (uint i = 0; i < _players.length; i++) {
            require(
                IGameVault(vault).getAccountAsset(_token, _players[i]) > _amount, 
                "Not enough token deposited"
            );
        }
        
        GameMatch memory gameMatch;
        gameMatch.game = games[_gameId];
        gameMatch.players = _players;
        gameMatch.winner = _winner;
        gameMatch.token = _token;
        gameMatch.amount = _amount;

        gameMatches.push(gameMatch);

        if (_winner > 0) {
            address winner = _players[_winner];
            address loser;
            if (_winner == 1) {
                loser = _players[2];
            } else {
                loser = _players[1];
            }
            IGameVault(vault).transferAccountAssetWithTimeLock(
                _token, loser, winner, _amount, block.timestamp + lockDuration
            );
        }
    }

    function setVault(address _vault) public onlyOwner {
        vault = _vault;
    }

    function setLockDuration(uint _duration) public onlyOwner {
        lockDuration = _duration;
    }
}