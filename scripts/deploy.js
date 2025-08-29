const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Starting CLONES token deployment on Base Sepolia...\n");

    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📋 Deployment Details:");
    console.log("   Deployer address:", deployer.address);
    console.log("   Network:", hre.network.name);
    console.log("   Chain ID:", (await ethers.provider.getNetwork()).chainId);
    
    // Check deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("   Deployer balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.01")) {
        console.log("⚠️  WARNING: Low balance. You may need more ETH for deployment.");
    }
    
    console.log("\n" + "=".repeat(50));

    try {
        // Deploy CLONES Token
        console.log("🔨 Deploying CLONES Token...");
        const ClonesToken = await ethers.getContractFactory("ClonesToken");
        
        // Deploy with deployer as initial owner
        const clonesToken = await ClonesToken.deploy(deployer.address);
        console.log("   Transaction hash:", clonesToken.deploymentTransaction().hash);
        
        // Wait for deployment confirmation
        await clonesToken.waitForDeployment();
        const tokenAddress = await clonesToken.getAddress();
        
        console.log("✅ CLONES Token deployed successfully!");
        console.log("   Contract address:", tokenAddress);
        
        // Verify token details
        const name = await clonesToken.name();
        const symbol = await clonesToken.symbol();
        const totalSupply = await clonesToken.totalSupply();
        const decimals = await clonesToken.decimals();
        
        console.log("\n📊 Token Information:");
        console.log("   Name:", name);
        console.log("   Symbol:", symbol);
        console.log("   Decimals:", decimals);
        console.log("   Total Supply:", ethers.formatEther(totalSupply), "tokens");
        console.log("   Owner Balance:", ethers.formatEther(await clonesToken.balanceOf(deployer.address)), "tokens");
        
        // Verify roles
        const DEFAULT_ADMIN_ROLE = await clonesToken.DEFAULT_ADMIN_ROLE();
        const MINTER_ROLE = await clonesToken.MINTER_ROLE();
        const PAUSER_ROLE = await clonesToken.PAUSER_ROLE();
        
        console.log("\n🔐 Role Verification:");
        console.log("   Admin Role:", await clonesToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address) ? "✅ Granted" : "❌ Missing");
        console.log("   Minter Role:", await clonesToken.hasRole(MINTER_ROLE, deployer.address) ? "✅ Granted" : "❌ Missing");
        console.log("   Pauser Role:", await clonesToken.hasRole(PAUSER_ROLE, deployer.address) ? "✅ Granted" : "❌ Missing");
        
        console.log("\n" + "=".repeat(50));
        console.log("🎉 Deployment completed successfully!");
        
        // Save deployment info
        const deploymentInfo = {
            network: hre.network.name,
            chainId: (await ethers.provider.getNetwork()).chainId,
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: {
                ClonesToken: {
                    address: tokenAddress,
                    constructorArgs: [deployer.address],
                    transactionHash: clonesToken.deploymentTransaction().hash
                }
            }
        };
        
        // Write deployment info to file
        const fs = require('fs');
        const path = require('path');
        
        const deploymentsDir = path.join(__dirname, '..', 'deployments');
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }
        
        const deploymentFile = path.join(deploymentsDir, `${hre.network.name}-${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        
        console.log("💾 Deployment info saved to:", deploymentFile);
        
        console.log("\n📋 Next Steps:");
        console.log("1. Update tokens.ts files with the new contract address:");
        console.log(`   CLONES_TOKEN_ADDRESS="${tokenAddress}"`);
        console.log("2. Run faucet deployment:");
        console.log("   npm run deploy:faucet");
        console.log("3. Verify contracts on BaseScan:");
        console.log("   npm run verify");
        console.log("\n🔗 View on BaseScan:");
        console.log(`   https://sepolia.basescan.org/address/${tokenAddress}`);
        
    } catch (error) {
        console.error("❌ Deployment failed:");
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