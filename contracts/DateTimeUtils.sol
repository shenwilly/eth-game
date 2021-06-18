// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IDateTime } from "./interfaces/IDateTime.sol";

contract DateTimeUtils {
    IDateTime dateTime;
    
    constructor(address _dateTime) {
        dateTime = IDateTime(_dateTime);
    }

    function getTodayHash() public view returns (bytes32) {
        uint year = dateTime.getYear(block.timestamp);
        uint month = dateTime.getMonth(block.timestamp);
        uint day = dateTime.getDay(block.timestamp);

        return keccak256(abi.encodePacked([year, month, day]));
    }
}