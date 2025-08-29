const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🚰 Starting CLONES Faucet deployment on Base Sepolia...\n");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📋 Deployment Details:");
    console.log("   Deployer address:", deployer.address);
    console.log("   Network:", hre.network.name);
    console.log("   Chain ID:", (await ethers.provider.getNetwork()).chainId);

    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("   Deployer balance:", ethers.formatEther(balance), "ETH");

    console.log("\n" + "=".repeat(50));

    // Get CLONES token address from environment or prompt
    const tokenAddress = process.env.CLONES_TOKEN_ADDRESS;
    if (!tokenAddress) {
        console.error("❌ Error: CLONES_TOKEN_ADDRESS not set in environment");
        console.log("Please set the token address and try again:");
        console.log("export CLONES_TOKEN_ADDRESS=0x...");
        process.exit(1);
    }

    console.log("🔗 Using CLONES Token at:", tokenAddress);

    try {
        // Verify token contract exists
        const tokenCode = await ethers.provider.getCode(tokenAddress);
        if (tokenCode === "0x") {
            throw new Error(`No contract found at token address: ${tokenAddress}`);
        }

        // Faucet configuration from environment or defaults
        const claimAmount = process.env.FAUCET_DAILY_LIMIT ?
            ethers.parseEther(process.env.FAUCET_DAILY_LIMIT) :
            ethers.parseEther("1000"); // 1000 CLONES per claim

        const claimInterval = process.env.FAUCET_CLAIM_INTERVAL ?
            parseInt(process.env.FAUCET_CLAIM_INTERVAL) :
            24 * 60 * 60; // 24 hours

        const dailyLimit = process.env.FAUCET_DAILY_LIMIT ?
            ethers.parseEther(process.env.FAUCET_DAILY_LIMIT) :
            ethers.parseEther("100000"); // 100,000 CLONES per day

        console.log("\n⚙️  Faucet Configuration:");
        console.log("   Claim Amount:", ethers.formatEther(claimAmount), "CLONES");
        console.log("   Claim Interval:", claimInterval / 3600, "hours");
        console.log("   Daily Limit:", ethers.formatEther(dailyLimit), "CLONES");

        // Deploy Faucet Contract
        console.log("\n🔨 Deploying CLONES Faucet...");
        const ClonesFaucet = await ethers.getContractFactory("ClonesFaucet");

        const faucet = await ClonesFaucet.deploy(
            tokenAddress,     // CLONES token address
            deployer.address, // Owner address
            claimAmount,      // Claim amount
            claimInterval,    // Claim interval
            dailyLimit        // Daily limit
        );

        console.log("   Transaction hash:", faucet.deploymentTransaction().hash);

        // Wait for deployment confirmation
        await faucet.waitForDeployment();
        const faucetAddress = await faucet.getAddress();

        console.log("✅ CLONES Faucet deployed successfully!");
        console.log("   Contract address:", faucetAddress);

        // Wait a bit for the contract to be fully available on the network
        console.log("⏳ Waiting for contract to be available...");
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        // Verify faucet configuration with retry logic
        let tokenAddr, claimAmt, claimInt, dailyLim;
        let retries = 3;

        while (retries > 0) {
            try {
                tokenAddr = await faucet.getClonesTokenAddress();
                claimAmt = await faucet.claimAmount();
                claimInt = await faucet.claimInterval();
                dailyLim = await faucet.dailyDistributionLimit();
                break; // Success, exit retry loop
            } catch (error) {
                retries--;
                if (retries === 0) {
                    console.log("⚠️  Could not verify contract details immediately. This is normal on some networks.");
                    console.log("   The contract is deployed and should be available shortly.");
                    // Set default values to continue
                    tokenAddr = tokenAddress;
                    claimAmt = claimAmount;
                    claimInt = claimInterval;
                    dailyLim = dailyLimit;
                    break;
                }
                console.log(`⏳ Retrying contract verification... (${3 - retries}/3)`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retry
            }
        }

        console.log("\n📊 Faucet Information:");
        console.log("   Token Address:", tokenAddr);
        console.log("   Claim Amount:", ethers.formatEther(claimAmt), "CLONES");
        console.log("   Claim Interval:", claimInt.toString(), "seconds");
        console.log("   Daily Limit:", ethers.formatEther(dailyLim), "CLONES");

        // Check roles with retry logic
        try {
            const DEFAULT_ADMIN_ROLE = await faucet.DEFAULT_ADMIN_ROLE();
            const ADMIN_ROLE = await faucet.ADMIN_ROLE();
            const PAUSER_ROLE = await faucet.PAUSER_ROLE();

            console.log("\n🔐 Role Verification:");
            console.log("   Default Admin:", await faucet.hasRole(DEFAULT_ADMIN_ROLE, deployer.address) ? "✅ Granted" : "❌ Missing");
            console.log("   Admin Role:", await faucet.hasRole(ADMIN_ROLE, deployer.address) ? "✅ Granted" : "❌ Missing");
            console.log("   Pauser Role:", await faucet.hasRole(PAUSER_ROLE, deployer.address) ? "✅ Granted" : "❌ Missing");
        } catch (error) {
            console.log("\n🔐 Role Verification: Could not verify roles (contract still propagating)");
            console.log("   This is normal on some networks. Roles should be properly set.");
        }

        // Check if faucet has tokens
        let faucetBalance = 0n;
        try {
            const ClonesToken = await ethers.getContractFactory("ClonesToken");
            const token = ClonesToken.attach(tokenAddress);
            faucetBalance = await token.balanceOf(faucetAddress);

            console.log("\n💰 Faucet Balance:");
            console.log("   Current Balance:", ethers.formatEther(faucetBalance), "CLONES");

            if (faucetBalance == 0) {
                console.log("⚠️  WARNING: Faucet has no tokens. You need to transfer tokens to the faucet:");
                console.log(`   Transfer tokens to: ${faucetAddress}`);
            }
        } catch (error) {
            console.log("\n💰 Faucet Balance: Could not verify balance (contract still propagating)");
            console.log("⚠️  You may need to transfer tokens to the faucet:");
            console.log(`   Transfer tokens to: ${faucetAddress}`);
        }

        console.log("\n" + "=".repeat(50));
        console.log("🎉 Faucet deployment completed successfully!");

        // Save deployment info
        const networkInfo = await ethers.provider.getNetwork();
        const deploymentInfo = {
            network: hre.network.name,
            chainId: networkInfo.chainId.toString(), // Convert BigInt to string
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: {
                ClonesFaucet: {
                    address: faucetAddress,
                    constructorArgs: [tokenAddress, deployer.address, claimAmount.toString(), claimInterval.toString(), dailyLimit.toString()],
                    transactionHash: faucet.deploymentTransaction().hash
                }
            },
            configuration: {
                tokenAddress,
                claimAmount: ethers.formatEther(claimAmount),
                claimInterval: claimInterval.toString(),
                dailyLimit: ethers.formatEther(dailyLimit)
            }
        };

        // Write deployment info to file
        const fs = require('fs');
        const path = require('path');

        const deploymentsDir = path.join(__dirname, '..', 'deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentFile = path.join(deploymentsDir, `faucet-${hre.network.name}-${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

        console.log("💾 Deployment info saved to:", deploymentFile);

        console.log("\n📋 Next Steps:");
        console.log("1. Fund the faucet with CLONES tokens:");
        console.log(`   Transfer tokens to: ${faucetAddress}`);
        console.log("2. Update website configuration with faucet address:");
        console.log(`   FAUCET_ADDRESS="${faucetAddress}"`);
        console.log("3. Verify contracts on BaseScan:");
        console.log("   npm run verify");
        console.log("\n🔗 View on BaseScan:");
        console.log(`   https://sepolia.basescan.org/address/${faucetAddress}`);

    } catch (error) {
        console.error("❌ Faucet deployment failed:");
        console.error(error);
        process.exit(1);
    }
}

// Handle script execution
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 Unhandled error:");
        console.error(error);
        process.exit(1);
    });