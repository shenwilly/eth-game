import { BigNumber } from "ethers";
import { ethers } from "hardhat";

export const getCurrentTimestamp = async (): Promise<number> => {
    const latestBlock = await ethers.provider.getBlock("latest");
    return latestBlock.timestamp;
}

export async function increaseTime(duration: number | BigNumber) {
    if (!BigNumber.isBigNumber(duration)) {
      duration = BigNumber.from(duration);
    }
  
    if (duration.lt(BigNumber.from("0")))
      throw Error(`Cannot increase time by a negative amount (${duration})`);
  
    await ethers.provider.send("evm_increaseTime", [duration.toNumber()]);
    await ethers.provider.send("evm_mine", []);
}