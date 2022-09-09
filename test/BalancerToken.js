const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

const impersonateAddress = async (address) => {
  const hre = require('hardhat');
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  const signer = await ethers.provider.getSigner(address);
  signer.address = signer._address;
  return signer;
};

describe("Lock", function () {
  async function deployFixture() {
    const [deployer, user1, user2] = await ethers.getSigners();

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    timestamp = blockBefore.timestamp;

    console.log("1. Deploy and init")
    const BalancerToken = await ethers.getContractFactory("BalancerToken");
    const balancerToken = await BalancerToken.deploy("Balancer Token", "BT");

    await balancerToken.initToken()

    console.log("Token deployed at: " + balancerToken.address)

    const vault = await hre.ethers.getContractAt(
      "IVault", "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
    );

    const usdc = await hre.ethers.getContractAt(
      "IERC20", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );

    const pool = await hre.ethers.getContractAt(
      "IWeightedPool", await balancerToken.weightedPoolAddress()
    );

    usdcWhale = await impersonateAddress("0xee5b5b923ffce93a870b3104b7ca09c3db80047a") // has a lot of USDC
    await deployer.sendTransaction({
      to: usdcWhale.address,
      value: ethers.utils.parseEther("2.0")
    });

    await usdc.connect(usdcWhale).transfer(deployer.address, ethers.utils.parseUnits("10000",6))
    await usdc.connect(usdcWhale).transfer(user1.address, ethers.utils.parseUnits("1000",6))

    return { balancerToken, vault, pool, usdc, deployer, user1, user2, timestamp };
  }

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const { balancerToken, vault, pool, usdc, deployer, user1, user2, timestamp } = await loadFixture(deployFixture);

      console.log("2. Add liquidity")
      await usdc.approve(vault.address, ethers.utils.parseUnits("1000", 6))
      await balancerToken.approve(vault.address, ethers.utils.parseEther("100000"))
    
      const JOIN_KIND_INIT = 0;
      var initialBalances = [ethers.utils.parseUnits("1000", 6), ethers.utils.parseEther("100000")]
      var tokens = [usdc.address, balancerToken.address]
      if(balancerToken.address < usdc.address)
      {
        tokens = [balancerToken.address, usdc.address]
        initialBalances = [ethers.utils.parseEther("100000"), ethers.utils.parseUnits("1000", 6)]
      }
      const initUserData =
      ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                          [JOIN_KIND_INIT, initialBalances]);
      var joinPoolRequest = [
        tokens /*assets*/,
        initialBalances /*maxAmountsIn*/,
        initUserData /*userData*/,
        false /*fromInternalBalance*/
      ]
      await vault.joinPool(
        await pool.getPoolId(),
        deployer.address,
        deployer.address,
        joinPoolRequest
      )
      console.log()

      console.log("3. Swap")

      console.log("Let's test some swaps")
      const swap_kind = 0;
      const swap_struct = {
          poolId: await pool.getPoolId(),
          kind: swap_kind,
          assetIn: usdc.address,
          assetOut: balancerToken.address,
          amount: ethers.utils.parseEther("0.01"),
          userData: '0x'
      };
    
      const fund_struct = {
          sender: deployer.address,
          fromInternalBalance: false,
          recipient: deployer.address,
          toInternalBalance: false
      };
    
      await vault.swap(
        swap_struct /*singleSwap*/,
        fund_struct /*funds*/,
        ethers.utils.parseEther("0.0") /*limit*/,
        timestamp + 100 /*deadline*/);
    
      console.log("A pool balance: " + ethers.utils.formatEther(await usdc.balanceOf(vault.address)))
      console.log("B pool balance: " + ethers.utils.formatEther(await balancerToken.balanceOf(vault.address)))
      console.log("LPB: " + ethers.utils.formatEther(await pool.balanceOf(deployer.address)))
    });
  });
});
