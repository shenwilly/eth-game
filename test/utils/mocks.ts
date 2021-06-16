import { ethers } from "hardhat";
import { ERC20Mock, ERC20Mock__factory } from "../../typechain";

export const getMockERC20 = async (name: string, symbol: string): Promise<ERC20Mock> => {
    const ERC20MockFactory = (
        await ethers.getContractFactory("ERC20Mock")
    ) as ERC20Mock__factory;

    return await ERC20MockFactory.deploy(name, symbol);
}