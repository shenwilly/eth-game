// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract GameVault {
    using SafeERC20 for IERC20;

    mapping(address => bool) public allowedAssets;
    mapping(address => mapping(address => uint)) public accountAssets; //[token][account]
    mapping(address => uint) public assetFees;
    address public controller;

    event NewController(address indexed oldController, address indexed newController);
 
    modifier onlyController {
        require(msg.sender == controller, "Not controller");
        _;
    }

    constructor(address _controller) {
        controller = _controller;
    }

    function addAsset(address _address) external onlyController {
        require(_address != address(0), "Asset is zero address");
        allowedAssets[_address] = true;
    }

    function removeAsset(address _address) external onlyController {
        allowedAssets[_address] = false;
    }

    function deposit(address _address, uint _amount) external {
        require(allowedAssets[_address], "Asset is not allowed");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20(_address).transferFrom(msg.sender, address(this), _amount);
        accountAssets[_address][msg.sender] += _amount;
    }
    
    // TODO: locked asset
    function withdraw(address _address, uint _amount) external {
        require(_amount <= accountAssets[_address][msg.sender], "Not enough asset in account");
        require(_amount > 0, "Amount must be greater than 0");
        
        IERC20(_address).transfer(msg.sender, _amount);
        accountAssets[_address][msg.sender] -= _amount;
    }
    
    function transferAccountAsset(
        address _tokenAddress, address _from, address _to, uint _amount
    ) external onlyController {
        require(_amount <= accountAssets[_tokenAddress][_from], "Not enough asset in account");
        accountAssets[_tokenAddress][_from] -= _amount;
        accountAssets[_tokenAddress][_to] += _amount;
    }

    function transferAccountAssetFee(address _tokenAddress, address _from, uint _amount) external onlyController {
        require(_amount <= accountAssets[_tokenAddress][_from], "Not enough asset in account");
        accountAssets[_tokenAddress][_from] -= _amount;
        assetFees[_tokenAddress] += _amount;
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
}
