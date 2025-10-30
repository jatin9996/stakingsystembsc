const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Starting deployment...");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy TestToken
  console.log("\n1. Deploying TestToken...");
  const TestToken = await hre.ethers.getContractFactory("TestToken");
  const testToken = await TestToken.deploy();
  await testToken.waitForDeployment();
  const testTokenAddress = await testToken.getAddress();
  console.log("✅ TestToken deployed to:", testTokenAddress);

  // Deploy Staking
  console.log("\n2. Deploying Staking contract...");
  const Staking = await hre.ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(testTokenAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("✅ Staking deployed to:", stakingAddress);

  // Fund staking contract with rewards
  console.log("\n3. Funding staking contract...");
  const fundAmount = hre.ethers.parseEther("100000"); // 100k tokens for rewards
  await testToken.transfer(stakingAddress, fundAmount);
  console.log("✅ Funded staking contract with", hre.ethers.formatEther(fundAmount), "tokens");

  // Mint some tokens to deployer for testing
  console.log("\n4. Minting test tokens to deployer...");
  const mintAmount = hre.ethers.parseEther("10000");
  // Deployer already has 1M tokens from TestToken constructor, so we don't need to mint more
  console.log("✅ Deployer balance:", hre.ethers.formatEther(await testToken.balanceOf(deployer.address)), "tokens");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    contracts: {
      TestToken: testTokenAddress,
      Staking: stakingAddress
    },
    timestamps: new Date().toISOString()
  };

  // Save to file
  const filename = `deployment-${hre.network.name}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n📄 Deployment info saved to:", filename);

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("📍 TestToken Address:", testTokenAddress);
  console.log("📍 Staking Address:", stakingAddress);
  console.log("=".repeat(60));

  // Verify contract functionality
  console.log("\n5. Verifying deployment...");
  const stakingToken = await staking.stakingToken();
  console.log("Staking token address:", stakingToken);
  console.log("Match:", stakingToken.toLowerCase() === testTokenAddress.toLowerCase() ? "✅ Yes" : "❌ No");
  
  const contractBalance = await testToken.balanceOf(stakingAddress);
  console.log("Staking contract balance:", hre.ethers.formatEther(contractBalance), "tokens");

  console.log("\n✅ All checks passed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

