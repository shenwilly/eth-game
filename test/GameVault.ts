import { ethers} from "hardhat";
import chai from "chai";
import { ERC20Mock, GameVault, GameVault__factory } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseUnits } from "ethers/lib/utils";
import { getMockERC20 } from "./utils/mocks";
import { BigNumber } from "ethers";

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

  before(async () => {
    [
      ownerSigner,
      player1Signer,
      player2Signer
    ] = await ethers.getSigners();
    owner = ownerSigner.address;
    player1 = player1Signer.address;
    player2 = player2Signer.address;

    const GameVaultFactory = (await ethers.getContractFactory(
      "GameVault",
      ownerSigner
    )) as GameVault__factory;
    gameVault = await GameVaultFactory.deploy(owner);

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

    it("should increase userAsset & decrease user token balance", async () => {
      const tokenBalance = await token.balanceOf(player1);
      await token.connect(player1Signer).approve(gameVault.address, tokenBalance);
      await gameVault.connect(player1Signer).deposit(token.address, tokenBalance);

      expect(await token.balanceOf(player1)).to.be.eq(0);
      expect(await gameVault.getAccountAsset(token.address, player1)).to.be.eq(tokenBalance);
    });
  });

  describe("transferAccountAsset()", async () => {
    it("should revert when sender is not controller", async () => {
      const tokenBalance = await gameVault.getAccountAsset(token.address, player1);
      await expectRevert(
        gameVault.connect(player1Signer).transferAccountAsset(
          token.address, 
          player1, 
          player2,
          tokenBalance
        ), 
        "Not controller"
      );
    });
    
    it("should revert when amount is greater than balance", async () => {
      const tokenBalance = await gameVault.getAccountAsset(token.address, player1);
      await expectRevert(
        gameVault.connect(ownerSigner).transferAccountAsset(
          token.address, 
          player1, 
          player2,
          tokenBalance.add(1)
        ),
        "Not enough asset in account"
      );
    });

    it("should transfer token to designated account", async () => {
      const tokenBalance = await gameVault.getAccountAsset(token.address, player1);
      await gameVault.connect(ownerSigner).transferAccountAsset(
        token.address, 
        player1, 
        player2,
        tokenBalance.div(2)
      );
      expect(await gameVault.getAccountAsset(token.address, player1)).to.be.eq(tokenBalance.div(2));
      expect(await gameVault.getAccountAsset(token.address, player2)).to.be.eq(tokenBalance.div(2));
    });

    it("should transfer token and fee if feeOn is true", async () => {
      const tokenBalancePlayer1 = await gameVault.getAccountAsset(token.address, player1);
      const tokenBalancePlayer2 = await gameVault.getAccountAsset(token.address, player2);
      const assetFeeBalance = await gameVault.getAssetFees(token.address);
      await gameVault.connect(ownerSigner).setFeeOn(true);
      await gameVault.connect(ownerSigner).transferAccountAsset(
        token.address, 
        player1, 
        player2,
        tokenBalancePlayer1
      );
      const tokenFee = await gameVault.fee();
      const tokenFeeDenominator = await gameVault.feeDenominator();
      const tokenFeeAmount = tokenBalancePlayer1.mul(tokenFee).div(tokenFeeDenominator)
      expect(await gameVault.getAccountAsset(token.address, player1)).to.be.eq(0);
      expect(await gameVault.getAccountAsset(token.address, player2))
        .to.be.eq(tokenBalancePlayer2.add(tokenBalancePlayer1).sub(tokenFeeAmount));
      expect(await gameVault.getAssetFees(token.address)).to.be.eq(assetFeeBalance.add(tokenFeeAmount));
    });
  });

  describe("withdraw()", async () => {
    it("should revert when amount is greater balance", async () => {
      const tokenBalance = await gameVault.getAccountAsset(token.address, player1)
      const addedTokenBalance = tokenBalance.add(1);
      await expectRevert(
        gameVault.connect(player1Signer).withdraw(token.address, addedTokenBalance),
        "Not enough asset in account"
      );
    });

    it("should revert when amount is 0", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).withdraw(token.address, 0),
        "Amount must be greater than 0"
      );
    });

    it("should decrease userAsset & increase user token balance", async () => {
      const tokenAmount = parseUnits("1", 18);
      await token.mint(player1, tokenAmount);
      await token.connect(player1Signer).approve(gameVault.address, tokenAmount);
      await gameVault.connect(player1Signer).deposit(token.address, tokenAmount);

      const tokenBalanceBefore = await token.balanceOf(player1);
      const vaultTokenBalanceBefore = await gameVault.accountAssets(token.address, player1);
      await gameVault.connect(player1Signer).withdraw(token.address, vaultTokenBalanceBefore);

      expect(await token.balanceOf(player1)).to.be.eq(tokenBalanceBefore.add(vaultTokenBalanceBefore));
      expect(await gameVault.getAccountAsset(token.address, player1)).to.be.eq(0);
    });
  });

  describe("removeAsset()", async () => {
    it("should revert when sender is not controller ", async () => {
      await expectRevert(
        gameVault.connect(player1Signer).removeAsset(token.address),
        "Not controller"
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
