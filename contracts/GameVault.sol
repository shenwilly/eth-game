// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IWETH } from "./interfaces/IWETH.sol";

contract GameVault {
    using SafeERC20 for IERC20;

    struct LockedAsset {
        address account;
        address token;
        uint amount;
        uint unlockedAt; // timestamp
        bool unlocked;
    }

    address[] public assets;
    mapping(address => bool) public allowedAssets;
    mapping(address => uint) public assetFees;

    mapping(address => mapping(address => uint)) public accountAssets; // [token][account]
    LockedAsset[] public lockedAssets;
    mapping(address => uint[]) public accountToLockedAssetIds;
    
    address public controller;
    address public weth;

    bool public feeOn = false;
    uint public fee = 1;
    uint public feeDenominator = 1000;

    event NewController(address indexed oldController, address indexed newController);
    event NewFeeOn(bool indexed feeOn);
    event AssetAdded(address indexed asset);
    event AssetRemoved(address indexed asset);
    event NewDeposit(address indexed asset, address indexed from, uint amount);
    event NewWithdrawal(address indexed asset, address indexed from, uint amount);
    event NewTransfer(address indexed asset, address indexed from, address indexed to, uint amount);
    event NewFeeTransfer(address indexed asset, uint amount);
    event NewTimeLockTransfer(uint indexed id, address indexed asset, address from, address to, uint amount, uint unlockedAt);
    event UnlockTimeLockTransfer(uint indexed id, address indexed asset, address to, uint amount);
 
    modifier onlyController {
        require(msg.sender == controller, "Not controller");
        _;
    }

    constructor(address _controller, address _weth) {
        controller = _controller;
        weth = _weth;
    }

    function addAsset(address _address) public onlyController {
        require(_address != address(0), "Asset is zero address");
        allowedAssets[_address] = true;
        assets.push(_address);

        emit AssetAdded(_address);
    }

    function removeAsset(address _address) public onlyController {
        require(allowedAssets[_address], "Asset has not been added");
        allowedAssets[_address] = false;

        emit AssetRemoved(_address);
    }

    function deposit(address _address, uint _amount) external {
        require(allowedAssets[_address], "Asset is not allowed");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20(_address).transferFrom(msg.sender, address(this), _amount);
        accountAssets[_address][msg.sender] += _amount;

        emit NewDeposit(_address, msg.sender, _amount);
    }

    function depositETH() payable external {
        require(msg.value > 0, "Amount must be greater than 0");

        IWETH(weth).deposit{value: msg.value}();
        accountAssets[weth][msg.sender] += msg.value;

        emit NewDeposit(weth, msg.sender, msg.value);
    }
    
    // TODO: locked asset
    function withdraw(address _address, uint _amount) external {
        require(_amount <= accountAssets[_address][msg.sender], "Not enough asset in account");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20(_address).transfer(msg.sender, _amount);
        accountAssets[_address][msg.sender] -= _amount;

        emit NewWithdrawal(_address, msg.sender, _amount);
    }
    
    function withdrawETH(uint _amount) external {
        require(_amount <= accountAssets[weth][msg.sender], "Not enough asset in account");
        require(_amount > 0, "Amount must be greater than 0");

        IWETH(weth).withdraw(_amount);
        payable(msg.sender).transfer(_amount);
        accountAssets[weth][msg.sender] -= _amount;

        emit NewWithdrawal(weth, msg.sender, _amount);
    }
    
    function transferAccountAsset(
        address _tokenAddress, address _from, address _to, uint _amount
    ) external onlyController {
        require(_amount <= accountAssets[_tokenAddress][_from], "Not enough asset in account");
        accountAssets[_tokenAddress][_from] -= _amount;

        uint transferAmount = _amount;
        uint feeAmount = calculateFee(_amount);
        if (feeAmount > 0) {
            assetFees[_tokenAddress] += feeAmount;
            transferAmount -= feeAmount;
            
            emit NewFeeTransfer(_tokenAddress, feeAmount);
        }
        accountAssets[_tokenAddress][_to] += transferAmount;
        
        emit NewTransfer(_tokenAddress, _from, _to, transferAmount);
    }
    
    function transferAccountAssetWithTimeLock(
        address _tokenAddress, address _from, address _to, uint _amount, uint _unlockedAt
    ) external onlyController returns (uint id) {
        require(_amount <= accountAssets[_tokenAddress][_from], "Not enough asset in account");
        accountAssets[_tokenAddress][_from] -= _amount;
        
        id = lockedAssets.length;
        LockedAsset memory lockedAsset;
        lockedAsset.account = _to;
        lockedAsset.token = _tokenAddress;
        lockedAsset.amount = _amount;
        lockedAsset.unlockedAt = _unlockedAt;
        lockedAssets.push(lockedAsset);
        accountToLockedAssetIds[_to].push(id);
        
        emit NewTimeLockTransfer(id, _tokenAddress, _from, _to, _amount, _unlockedAt);
    }
    
    function unlockAccountAssets(uint[] calldata _ids) external {
        for (uint i = 0; i < _ids.length; i++) {
            uint id = _ids[i];
            LockedAsset memory lockedAsset = lockedAssets[id];

            require(block.timestamp >= lockedAsset.unlockedAt, "Asset not unlocked yet");
            
            address tokenAddress = lockedAsset.token;
            address account = lockedAsset.account;
            uint transferAmount = lockedAsset.amount;
            
            uint feeAmount = calculateFee(transferAmount);
            if (feeAmount > 0) {
                assetFees[tokenAddress] += feeAmount;
                transferAmount -= feeAmount;
                
                emit NewFeeTransfer(tokenAddress, feeAmount);
            }
            accountAssets[tokenAddress][account] += transferAmount;
            lockedAsset.unlocked = true;
            
            emit UnlockTimeLockTransfer(id, tokenAddress, account, transferAmount);
        }
    }

    function calculateFee(uint _withdrawAmount) public view returns (uint) {
        uint feeAmount = 0;
        if (feeOn) {
            feeAmount = _withdrawAmount * fee / feeDenominator;
        }
        return feeAmount;
    }

    function setFeeOn(bool _feeOn) public onlyController {
        feeOn = _feeOn;

        emit NewFeeOn(feeOn);
    }

    function setController(address _controller) public onlyController {
        require(_controller != address(0), "Controller is zero address");
        address oldController = _controller;
        controller = _controller;

        emit NewController(oldController, controller);
    }

    function getAsset(address _address) public view returns (bool) {
        return allowedAssets[_address];
    }

    function getAssets() public view returns (address[] memory) {
        return assets;
    }

    function getAccountAsset(address _tokenaddress, address _accountAddress) public view returns (uint) {
        return accountAssets[_tokenaddress][_accountAddress];
    }

    function getAccountAssets(address _accountAddress) public view returns (uint[] memory) {
        uint len = assets.length;
        uint[] memory accountAssetList = new uint[](len);
        for (uint i = 0; i < len; i++) {
            accountAssetList[i] = accountAssets[assets[i]][_accountAddress];
        }
        return accountAssetList;
    }

    function getAccountLockedAssetIds(address _accountAddress) public view returns (uint[] memory) {
        uint len = accountToLockedAssetIds[_accountAddress].length;
        uint[] memory lockedAssetIds = new uint[](len);
        for (uint i = 0; i < len; i++) {
            lockedAssetIds[i] = accountToLockedAssetIds[_accountAddress][i];
        }
        return lockedAssetIds;
    }

    function getLockedAssetStatus(uint[] calldata _ids) public view returns (bool[] memory) {
        uint len = _ids.length;
        bool[] memory lockedAssetStatusList = new bool[](len);
        for (uint i = 0; i < len; i++) {
            lockedAssetStatusList[i] = lockedAssets[_ids[i]].unlocked;
        }
        return lockedAssetStatusList;
    }

    function getAssetFees(address _tokenaddress) public view returns (uint) {
        return assetFees[_tokenaddress];
    }

    receive() payable external {}
}
