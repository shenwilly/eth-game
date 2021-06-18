// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import { IDateTimeUtils } from "./interfaces/IDateTimeUtils.sol";
import { ICommand } from "./interfaces/ICommand.sol";

contract DailyCheckIn {
    mapping(bytes32 => mapping(address => bool)) public dailyAccountCheckIns;
    
    address public controller;
    address public command;
    address public dateTime;

    event CheckIn(address indexed from, bytes32 dateTime);

    modifier onlyController {
        require(msg.sender == controller, "Not controller");
        _;
    }

    constructor(address _controller, address _dateTime) {
        controller = _controller;
        dateTime = _dateTime;
    }

    function checkIn() external {
        bytes32 todayHash = IDateTimeUtils(dateTime).getTodayHash();
        require(!dailyAccountCheckIns[todayHash][msg.sender], "Already checked in for today");

        executeCommand();
        dailyAccountCheckIns[todayHash][msg.sender] = true;

        emit CheckIn(msg.sender, todayHash);
    }

    function executeCommand() internal {
        if (command != address(0)) {
            ICommand(command).execute();
        }
    }

    function setCommand(address _address) onlyController public {
        command = _address;
    }

    function getTodayCheckIn(address _address) public view returns (bool) {
        bytes32 todayHash = IDateTimeUtils(dateTime).getTodayHash();
        return dailyAccountCheckIns[todayHash][_address];
    }
}