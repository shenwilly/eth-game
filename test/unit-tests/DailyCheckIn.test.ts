import { ethers } from "hardhat";
import chai from "chai";
import { DailyCheckIn, DailyCheckIn__factory, DateTime__factory, DateTimeUtils__factory } from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { expect } = chai;
const { expectRevert } = require('@openzeppelin/test-helpers');

describe("DailyCheckIn", () => {
  let ownerSigner: SignerWithAddress,
    player1Signer: SignerWithAddress;

  let owner: string,
    player1: string;

  let dailyCheckIn: DailyCheckIn;

  before(async () => {
    [
      ownerSigner,
      player1Signer,
    ] = await ethers.getSigners();
    owner = ownerSigner.address;
    player1 = player1Signer.address;

    const DateTimeFactory = (
      await ethers.getContractFactory("DateTime", ownerSigner)
    ) as DateTime__factory;
    const dateTime = await DateTimeFactory.deploy();

    const DateTimeUtilsFactory = (
      await ethers.getContractFactory("DateTimeUtils", ownerSigner)
    ) as DateTimeUtils__factory;
    const dateTimeUtils = await DateTimeUtilsFactory.deploy(dateTime.address);

    const DailyCheckInFactory = (await ethers.getContractFactory(
      "DailyCheckIn",
      ownerSigner
    )) as DailyCheckIn__factory;
    dailyCheckIn = await DailyCheckInFactory.deploy(owner, dateTimeUtils.address);
  });

  describe("checkIn()", async () => {
    it("should check in succesfully ", async () => {
      expect(await dailyCheckIn.getTodayCheckIn(player1)).to.be.eq(false);
      const tx = await dailyCheckIn.connect(player1Signer).checkIn();
      const receipt = await tx.wait();
      expect(receipt.events![0].args![0] == player1Signer);
      expect(await dailyCheckIn.getTodayCheckIn(player1)).to.be.eq(true);
    });

    it("should revert if already checkedIn for today", async () => {
      expect(await dailyCheckIn.getTodayCheckIn(player1)).to.be.eq(true);
      await expectRevert(
        dailyCheckIn.connect(player1Signer).checkIn(), 
        "Already checked in for today"
      );
    });
  });
});
