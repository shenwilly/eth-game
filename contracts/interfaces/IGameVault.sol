// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGameVault {
    function addAsset(address) external;
    function removeAsset(address) external;

    function deposit(address, uint) external;
    function depositETH() payable external;
    function withdraw(address, uint) external;
    function withdrawETH(uint) external;
    
    function transferAccountAsset(address, address, address, uint) external;
    function transferAccountAssetWithTimeLock(address, address, address, uint, uint) external;
    function unlockAccountAssets(uint[] calldata) external;

    function calculateFee(uint) external view returns (uint);

    function setFeeOn(bool) external;
    function setController(address) external;

    function getAsset(address) external view returns (bool);
    function getAssets() external view returns (address[] memory);
    function getAccountAsset(address, address) external view returns (uint);
    function getAccountAssets(address) external view returns (uint[] memory);
    function getAccountLockedAssetIds(address) external view returns (uint[] memory);
    function getLockedAssetStatus(uint[] calldata) external view returns (bool[] memory);
    function getAssetFees(address) external view returns (uint);
}