import { ethers } from "hardhat";
import chai from "chai";
import { ERC20Mock, GameVault, GameVault__factory, WETH9, WETH9__factory } from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, parseUnits } from "ethers/lib/utils";
import { getMockERC20 } from "../utils/mocks";
import { getCurrentTimestamp, increaseTime } from "../utils/time";

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

  describe("setVault()", async () => {
    it("should revert when sender is not owner ", async () => {
        
    });

    it("should set new Vault", async () => {
        
    });
  });
});
