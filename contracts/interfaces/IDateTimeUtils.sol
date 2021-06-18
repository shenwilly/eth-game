// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDateTimeUtils {
    function getTodayHash() external view returns (bytes32);
}
