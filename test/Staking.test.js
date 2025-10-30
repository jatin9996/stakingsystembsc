const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BSC Staking Contract", function () {
  let testToken;
  let staking;
  let owner;
  let user1;
  let user2;
  let user3;

  const ONE_DAY = 86400; // 24 hours in seconds
  const STAKE_AMOUNT = ethers.parseEther("1000"); // 1000 tokens
  const FUND_AMOUNT = ethers.parseEther("100000"); // 100000 tokens for reward pool

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy TestToken
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy();
    await testToken.waitForDeployment();

    // Deploy Staking
    const Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(await testToken.getAddress());
    await staking.waitForDeployment();

    // Fund staking contract with rewards
    await testToken.transfer(await staking.getAddress(), FUND_AMOUNT);

    // Mint tokens for users
    await testToken.mint(user1.address, STAKE_AMOUNT * 10n);
    await testToken.mint(user2.address, STAKE_AMOUNT * 10n);
    await testToken.mint(user3.address, STAKE_AMOUNT * 10n);
  });

  describe("Token Deployment", function () {
    it("Should deploy TestToken successfully", async function () {
      expect(await testToken.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await testToken.name()).to.equal("Test Token");
      expect(await testToken.symbol()).to.equal("TEST");
      expect(await testToken.decimals()).to.equal(18);
    });

    it("Should deploy Staking contract successfully", async function () {
      expect(await staking.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await staking.stakingToken()).to.equal(await testToken.getAddress());
    });

    it("Should allow faucet to mint tokens", async function () {
      const balanceBefore = await testToken.balanceOf(user1.address);
      await testToken.connect(user1).faucet();
      const balanceAfter = await testToken.balanceOf(user1.address);
      const faucetAmount = ethers.parseEther("1000");
      expect(balanceAfter - balanceBefore).to.equal(faucetAmount);
    });
  });

  describe("Staking Functionality", function () {
    it("Should allow user to deposit tokens", async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).deposit(STAKE_AMOUNT);

      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(STAKE_AMOUNT);
      expect(stakeInfo.startTime).to.be.gt(0);
    });

    it("Should not allow deposit without approval", async function () {
      await expect(
        staking.connect(user1).deposit(STAKE_AMOUNT)
      ).to.be.reverted;
    });

    it("Should not allow deposit of zero tokens", async function () {
      await expect(
        staking.connect(user1).deposit(0)
      ).to.be.revertedWith("Staking: Amount must be greater than 0");
    });

    it("Should not allow double staking", async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).deposit(STAKE_AMOUNT);

      await expect(
        staking.connect(user1).deposit(STAKE_AMOUNT)
      ).to.be.revertedWith("Staking: Already staking, unstake first");
    });

    it("Should transfer tokens from user to contract", async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      
      const balanceBefore = await testToken.balanceOf(await staking.getAddress());
      await staking.connect(user1).deposit(STAKE_AMOUNT);
      const balanceAfter = await testToken.balanceOf(await staking.getAddress());

      expect(balanceAfter - balanceBefore).to.equal(STAKE_AMOUNT);
    });
  });

  describe("Referral System", function () {
    it("Should pay referral reward to referrer", async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await testToken.connect(user2).approve(await staking.getAddress(), STAKE_AMOUNT);

      // User2 stakes with user1 as referrer
      const referrerBalanceBefore = await testToken.balanceOf(user1.address);
      await staking.connect(user2)["deposit(uint256,address)"](STAKE_AMOUNT, user1.address);
      const referrerBalanceAfter = await testToken.balanceOf(user1.address);

      // Calculate expected referral reward (0.5% of deposit)
      const expectedReward = STAKE_AMOUNT * 50n / 10000n;
      expect(referrerBalanceAfter - referrerBalanceBefore).to.equal(expectedReward);

      // Check referral rewards mapping
      expect(await staking.referralRewards(user1.address)).to.equal(expectedReward);
    });

    it("Should handle deposit without referrer", async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1)["deposit(uint256)"](STAKE_AMOUNT);

      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(STAKE_AMOUNT);
    });

    it("Should not pay referral reward if referrer is the same as depositor", async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      const balanceBefore = await testToken.balanceOf(user1.address);
      
      await staking.connect(user1)["deposit(uint256,address)"](STAKE_AMOUNT, user1.address);
      
      // Should only have transferred the stake amount (no referral reward)
      const balanceAfter = await testToken.balanceOf(user1.address);
      expect(balanceBefore - balanceAfter).to.equal(STAKE_AMOUNT);
    });
  });

  describe("Reward Calculation", function () {
    beforeEach(async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).deposit(STAKE_AMOUNT);
    });

    it("Should calculate 1% daily ROI correctly", async function () {
      // Fast forward 1 day
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);

      const rewards = await staking.calculateRewards(user1.address);
      // 1% of 1000 tokens = 10 tokens
      const expectedRewards = ethers.parseEther("10");
      expect(rewards).to.equal(expectedRewards);
    });

    it("Should calculate 2% for 2 days", async function () {
      await ethers.provider.send("evm_increaseTime", [ONE_DAY * 2]);
      await ethers.provider.send("evm_mine", []);

      const rewards = await staking.calculateRewards(user1.address);
      const expectedRewards = ethers.parseEther("20");
      expect(rewards).to.equal(expectedRewards);
    });

    it("Should reset rewards calculation after claim", async function () {
      // Fast forward 1 day and claim
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);
      
      await staking.connect(user1).claim();

      // After claim, rewards should be 0
      const rewards = await staking.calculateRewards(user1.address);
      expect(rewards).to.equal(0);
    });

    it("Should accumulate rewards over time", async function () {
      // Claim after 1 day
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);
      await staking.connect(user1).claim();

      // Wait another day
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);

      const rewards = await staking.calculateRewards(user1.address);
      const expectedRewards = ethers.parseEther("10");
      expect(rewards).to.equal(expectedRewards);
    });
  });

  describe("Claim Functionality", function () {
    beforeEach(async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).deposit(STAKE_AMOUNT);
    });

    it("Should not allow claim without staking", async function () {
      await expect(
        staking.connect(user2).claim()
      ).to.be.revertedWith("Staking: No stake found");
    });

    it("Should not allow claim immediately after deposit", async function () {
      await expect(
        staking.connect(user1).claim()
      ).to.be.revertedWith("Staking: No rewards to claim");
    });

    it("Should allow claim after 24 hours", async function () {
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);

      const rewards = ethers.parseEther("10");
      await expect(staking.connect(user1).claim())
        .to.emit(staking, "Claimed")
        .withArgs(user1.address, rewards);
    });

    it("Should only allow one claim per 24 hours", async function () {
      // First claim
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);
      await staking.connect(user1).claim();

      // Try to claim again immediately (before 24 hours)
      await expect(
        staking.connect(user1).claim()
      ).to.be.revertedWith("Staking: No rewards to claim");
    });

    it("Should transfer rewards to user", async function () {
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await testToken.balanceOf(user1.address);
      await staking.connect(user1).claim();
      const balanceAfter = await testToken.balanceOf(user1.address);

      const expectedReward = ethers.parseEther("10");
      expect(balanceAfter - balanceBefore).to.equal(expectedReward);
    });

    it("Should track total claimed rewards", async function () {
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);
      await staking.connect(user1).claim();

      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.totalClaimed).to.equal(ethers.parseEther("10"));
    });
  });

  describe("Unstake Functionality", function () {
    beforeEach(async function () {
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).deposit(STAKE_AMOUNT);
    });

    it("Should not allow unstake without staking", async function () {
      await expect(
        staking.connect(user2).unstake()
      ).to.be.revertedWith("Staking: No stake found");
    });

    it("Should return principal on unstake", async function () {
      const balanceBefore = await testToken.balanceOf(user1.address);
      await staking.connect(user1).unstake();
      const balanceAfter = await testToken.balanceOf(user1.address);

      expect(balanceAfter).to.equal(balanceBefore + STAKE_AMOUNT);
    });

    it("Should return principal + rewards on unstake", async function () {
      // Fast forward 1 day to accumulate rewards
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await testToken.balanceOf(user1.address);
      await staking.connect(user1).unstake();
      const balanceAfter = await testToken.balanceOf(user1.address);

      // Should receive principal + rewards
      const expectedTotal = STAKE_AMOUNT + ethers.parseEther("10");
      expect(balanceAfter - balanceBefore).to.equal(expectedTotal);
    });

    it("Should reset stake after unstaking", async function () {
      await staking.connect(user1).unstake();
      
      const stakeInfo = await staking.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(0);
      
      // Should be able to stake again
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).deposit(STAKE_AMOUNT);
    });

    it("Should emit Unstaked event", async function () {
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);

      await expect(staking.connect(user1).unstake())
        .to.emit(staking, "Unstaked")
        .withArgs(user1.address, STAKE_AMOUNT, ethers.parseEther("10"));
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to fund reward pool", async function () {
      const fundAmount = ethers.parseEther("50000");
      await testToken.approve(await staking.getAddress(), fundAmount);
      
      await expect(staking.fund(fundAmount))
        .to.emit(staking, "RewardPoolFunded")
        .withArgs(owner.address, fundAmount);
    });

    it("Should not allow non-owner to fund", async function () {
      const fundAmount = ethers.parseEther("50000");
      await testToken.connect(user1).approve(await staking.getAddress(), fundAmount);
      
      await expect(
        staking.connect(user1).fund(fundAmount)
      ).to.be.reverted;
    });

    it("Should allow owner to rescue stuck tokens", async function () {
      // Deploy another ERC20 token
      const TestToken2 = await ethers.getContractFactory("TestToken");
      const testToken2 = await TestToken2.deploy();
      await testToken2.waitForDeployment();
      await testToken2.transfer(await staking.getAddress(), ethers.parseEther("100"));

      const rescueAmount = ethers.parseEther("100");
      await expect(staking.rescueTokens(await testToken2.getAddress(), rescueAmount))
        .to.emit(staking, "TokensRescued")
        .withArgs(await testToken2.getAddress(), rescueAmount);
    });

    it("Should not allow rescuing staking token", async function () {
      await expect(
        staking.rescueTokens(await testToken.getAddress(), ethers.parseEther("100"))
      ).to.be.revertedWith("Staking: Cannot rescue staking token");
    });
  });

  describe("Integration Test - Full Flow", function () {
    it("Should complete full flow: deposit → claim → unstake", async function () {
      // 1. User1 stakes with User2 as referrer
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1)["deposit(uint256,address)"](STAKE_AMOUNT, user2.address);

      // Verify User2 received referral reward (0.5%)
      const referralReward = await staking.referralRewards(user2.address);
      expect(referralReward).to.equal(ethers.parseEther("5"));

      // 2. Fast forward 1 day and claim
      await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
      await ethers.provider.send("evm_mine", []);
      await staking.connect(user1).claim();

      // Verify reward received
      const stakeInfo1 = await staking.getStakeInfo(user1.address);
      expect(stakeInfo1.totalClaimed).to.equal(ethers.parseEther("10"));

      // 3. Unstake
      await staking.connect(user1).unstake();

      // Verify user can stake again
      await testToken.connect(user1).approve(await staking.getAddress(), STAKE_AMOUNT);
      await staking.connect(user1).deposit(STAKE_AMOUNT);
    });
  });
});

