import { ethers} from "hardhat";
import chai from "chai";
import { ERC20Mock, GameVault, GameVault__factory, WETH9, WETH9__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { getMockERC20 } from "./utils/mocks";
import { BigNumber, Contract } from "ethers";

const { expect } = chai;
const { expectRevert, constants } = require('@openzeppelin/test-helpers');

const ZERO_ADDRESS = constants.ZERO_ADDRESS;

describe("GameVault", () => {
  let ownerSigner: SignerWithAddress,
    player1Signer: SignerWithAddress,
    player2Signer: SignerWithAddress;

  let owner: string,
    player1: string,
    player2: string;

  let gameVault: GameVault;
  let token: ERC20Mock;
  let unallowedToken: ERC20Mock;
  let weth: WETH9;

  before(async () => {
    [
      ownerSigner,
      player1Signer,
      player2Signer
    ] = await ethers.getSigners();
    owner = ownerSigner.address;
    player1 = player1Signer.address;
    player2 = player2Signer.address;

    const WethFactory = (
      await ethers.getContractFactory("WETH9", ownerSigner)
    ) as WETH9__factory;
    weth = await WethFactory.deploy();

    const GameVaultFactory = (await ethers.getContractFactory(
      "GameVault",
      ownerSigner
    )) as GameVault__factory;
    gameVault = await GameVaultFactory.deploy(owner, weth.address);

    token = await getMockERC20("Mock", "MOCK");
    await token.mint(player1, parseUnits("1", 18))

    unallowedToken = await getMockERC20("Random", "RNDM");
    await unallowedToken.mint(player1, parseUnits("1", 18))
  });

  describe("setFeeOn()", async () => {
    it("should revert when sender is not controller ", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).setFeeOn(true),
        "Not controller"
      );
    });

    it("should set new Fee", async () => {
      await gameVault.connect(ownerSigner).setFeeOn(true);
      expect(await gameVault.feeOn()).to.be.eq(true);
      await gameVault.connect(ownerSigner).setFeeOn(false);
      expect(await gameVault.feeOn()).to.be.eq(false);
    });
  });

  describe("addAsset()", async () => {
    it("should revert when sender is not controller ", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).addAsset(unallowedToken.address),
        "Not controller"
      );
    });

    it("should revert when asset is address(0) ", async () => {
      await expectRevert(
        gameVault.connect(ownerSigner).addAsset(ZERO_ADDRESS),
        "Asset is zero address"
      );
    });

    it("should return true for added asset", async () => {
      await gameVault.connect(ownerSigner).addAsset(token.address);
      expect(await gameVault.getAsset(token.address)).to.be.eq(true);
    });

    it("should return false for unadded asset", async () => {
      expect(await gameVault.getAsset(unallowedToken.address)).to.be.eq(false);
    });
  });

  describe("deposit()", async () => {
    it("should revert when depositing unallowed asset", async () => {
      const tokenBalance = await unallowedToken.balanceOf(player1);
      await unallowedToken.connect(player1Signer).approve(gameVault.address, tokenBalance);
      await expectRevert(
        gameVault.connect(player1Signer).deposit(unallowedToken.address, tokenBalance),
        "Asset is not allowed"
      );
    });

    it("should revert when amount is greater balance", async () => {
      const tokenBalance = await token.balanceOf(player1)
      const addedTokenBalance = tokenBalance.add(1);
      await token.connect(player1Signer).approve(gameVault.address, addedTokenBalance);
      await expectRevert(
        gameVault.connect(player1Signer).deposit(token.address, addedTokenBalance),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("should revert when amount is 0", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).deposit(token.address, 0),
        "Amount must be greater than 0"
      );
    });

    it("should increase accountAsset & vault balance and decrease user token balance", async () => {
      const tokenBalance = await token.balanceOf(player1);
      await token.connect(player1Signer).approve(gameVault.address, tokenBalance);
      await gameVault.connect(player1Signer).deposit(token.address, tokenBalance);

      expect(await token.balanceOf(player1)).to.be.eq(0);
      expect(await token.balanceOf(gameVault.address)).to.be.eq(tokenBalance);
      expect(await gameVault.getAccountAsset(token.address, player1)).to.be.eq(tokenBalance);
    });
  });

  describe("depositETH()", async () => {
    it("should revert when amount is 0", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).depositETH(),
        "Amount must be greater than 0"
      );
    });

    it("should increase accountAsset & vault balance", async () => {
      const ethAmount = parseEther("1");
      await gameVault.connect(player1Signer).depositETH({
        value: ethAmount
      });

      expect(await weth.balanceOf(gameVault.address)).to.be.eq(ethAmount);
      expect(await gameVault.getAccountAsset(weth.address, player1)).to.be.eq(ethAmount);
    });
  });

  describe("transferAccountAsset()", async () => {
    it("should revert when sender is not controller", async () => {
      const accountBalance = await gameVault.getAccountAsset(token.address, player1);
      await expectRevert(
        gameVault.connect(player1Signer).transferAccountAsset(
          token.address, 
          player1, 
          player2,
          accountBalance
        ), 
        "Not controller"
      );
    });
    
    it("should revert when amount is greater than balance", async () => {
      const accountBalance = await gameVault.getAccountAsset(token.address, player1);
      await expectRevert(
        gameVault.connect(ownerSigner).transferAccountAsset(
          token.address, 
          player1, 
          player2,
          accountBalance.add(1)
        ),
        "Not enough asset in account"
      );
    });

    it("should transfer token to designated account", async () => {
      const accountBalance = await gameVault.getAccountAsset(token.address, player1);
      await gameVault.connect(ownerSigner).transferAccountAsset(
        token.address, 
        player1, 
        player2,
        accountBalance.div(2)
      );
      expect(await gameVault.getAccountAsset(token.address, player1)).to.be.eq(accountBalance.div(2));
      expect(await gameVault.getAccountAsset(token.address, player2)).to.be.eq(accountBalance.div(2));
    });

    it("should transfer token and fee if feeOn is true", async () => {
      const accountBalancePlayer1 = await gameVault.getAccountAsset(token.address, player1);
      const accountBalancePlayer2 = await gameVault.getAccountAsset(token.address, player2);
      const assetFeeBalance = await gameVault.getAssetFees(token.address);
      await gameVault.connect(ownerSigner).setFeeOn(true);
      await gameVault.connect(ownerSigner).transferAccountAsset(
        token.address, 
        player1, 
        player2,
        accountBalancePlayer1
      );
      const tokenFee = await gameVault.fee();
      const tokenFeeDenominator = await gameVault.feeDenominator();
      const tokenFeeAmount = accountBalancePlayer1.mul(tokenFee).div(tokenFeeDenominator)
      expect(await gameVault.getAccountAsset(token.address, player1)).to.be.eq(0);
      expect(await gameVault.getAccountAsset(token.address, player2))
        .to.be.eq(accountBalancePlayer2.add(accountBalancePlayer1).sub(tokenFeeAmount));
      expect(await gameVault.getAssetFees(token.address)).to.be.eq(assetFeeBalance.add(tokenFeeAmount));
    });
  });

  describe("withdraw()", async () => {
    it("should revert when amount is greater balance", async () => {
      const accountBalance = await gameVault.getAccountAsset(token.address, player1)
      const addedAccountBalance = accountBalance.add(1);
      await expectRevert(
        gameVault.connect(player1Signer).withdraw(token.address, addedAccountBalance),
        "Not enough asset in account"
      );
    });

    it("should revert when amount is 0", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).withdraw(token.address, 0),
        "Amount must be greater than 0"
      );
    });

    it("should decrease accountAsset & vault balance and increase user token balance", async () => {
      const tokenAmount = parseUnits("1", 18);
      await token.mint(player1, tokenAmount);
      await token.connect(player1Signer).approve(gameVault.address, tokenAmount);
      await gameVault.connect(player1Signer).deposit(token.address, tokenAmount);

      const player1TokenBalanceBefore = await token.balanceOf(player1);
      const vaultTokenBalanceBefore = await token.balanceOf(gameVault.address);
      const player1AccountBalanceBefore = await gameVault.accountAssets(token.address, player1);
      await gameVault.connect(player1Signer).withdraw(token.address, player1AccountBalanceBefore);

      expect(await token.balanceOf(player1)).to.be.eq(player1TokenBalanceBefore.add(player1AccountBalanceBefore));
      expect(await token.balanceOf(gameVault.address)).to.be.eq(vaultTokenBalanceBefore.sub(player1AccountBalanceBefore));
      expect(await gameVault.getAccountAsset(token.address, player1)).to.be.eq(0);
    });
  });

  describe("withdrawETH()", async () => {
    it("should revert when amount is greater balance", async () => {
      const accountBalance = await gameVault.getAccountAsset(weth.address, player1)
      const addedAccountBalance = accountBalance.add(1);
      await expectRevert(
        gameVault.connect(player1Signer).withdrawETH(addedAccountBalance),
        "Not enough asset in account"
      );
    });

    it("should revert when amount is 0", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).withdrawETH(0),
        "Amount must be greater than 0"
      );
    });

    it("should decrease accountAsset & vault balance and increase user token balance", async () => {
      const ethAmount = parseEther("1");
      await gameVault.connect(player1Signer).depositETH({
        value: ethAmount
      });

      const player1EthBalanceBefore = await player1Signer.getBalance();
      const vaultWethBalanceBefore = await weth.balanceOf(gameVault.address);
      const player1AccountBalanceBefore = await gameVault.accountAssets(weth.address, player1);
      await gameVault.connect(player1Signer).withdrawETH(player1AccountBalanceBefore);
      
      expect(await player1Signer.getBalance()).to.be.gte(player1EthBalanceBefore);
      expect(await weth.balanceOf(gameVault.address)).to.be.eq(vaultWethBalanceBefore.sub(player1AccountBalanceBefore));
      expect(await gameVault.getAccountAsset(weth.address, player1)).to.be.eq(0);
    });
  });

  describe("removeAsset()", async () => {
    it("should revert when sender is not controller ", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).removeAsset(token.address),
        "Not controller"
      );
    });

    it("should revert when removing unadded asset ", async () => {
      await expectRevert(
        gameVault.connect(ownerSigner).removeAsset(unallowedToken.address),
        "Asset has not been added"
      );
    });

    it("should return false for removed asset", async () => {
      await gameVault.connect(ownerSigner).removeAsset(token.address);
      expect(await gameVault.getAsset(token.address)).to.be.eq(false);
    });
  });

  describe("setController()", async () => {
    it("should revert when sender is not controller ", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).setController(player1),
        "Not controller"
      );
    });

    it("should revert when new controller is address(0)", async () => {
      await expectRevert(
        gameVault.connect(ownerSigner).setController(ZERO_ADDRESS),
        "Controller is zero address"
      );
    });

    it("should set new controller", async () => {
      const oldController = await gameVault.controller();
      await gameVault.connect(ownerSigner).setController(player1);
      expect(await gameVault.controller()).to.be.not.eq(oldController);
      expect(await gameVault.controller()).to.be.eq(player1);
    });
  });
});
