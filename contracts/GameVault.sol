// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IWETH } from "./interfaces/IWETH.sol";

contract GameVault {
    using SafeERC20 for IERC20;

    mapping(address => bool) public allowedAssets;
    mapping(address => mapping(address => uint)) public accountAssets; // [token][account]
    mapping(address => uint) public assetFees;
    
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

        uint withdrawAmount = _amount;
        if (feeOn) {
            uint feeAmount = _amount * fee / feeDenominator;
            assetFees[_tokenAddress] += feeAmount;
            withdrawAmount -= feeAmount;
            
            emit NewFeeTransfer(_tokenAddress, feeAmount);
        }
        accountAssets[_tokenAddress][_to] += withdrawAmount;
        
        emit NewTransfer(_tokenAddress, _from, _to, withdrawAmount);
    }

    function timeLockAccountAsset(
        address _tokenAddress, address _from, address _to, uint _amount
    ) external onlyController {
        // TODO   
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

    function getAccountAsset(address _tokenaddress, address _accountAddress) public view returns (uint) {
        return accountAssets[_tokenaddress][_accountAddress];
    }

    function getAssetFees(address _tokenaddress) public view returns (uint) {
        return assetFees[_tokenaddress];
    }

    receive() payable external {}
}
