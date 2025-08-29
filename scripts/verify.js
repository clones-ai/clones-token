const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🔍 Starting contract verification on BaseScan...\n");

    // Find latest deployment files
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
        console.error("❌ No deployments directory found. Deploy contracts first.");
        process.exit(1);
    }

    const files = fs.readdirSync(deploymentsDir)
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => {
            const aStat = fs.statSync(path.join(deploymentsDir, a));
            const bStat = fs.statSync(path.join(deploymentsDir, b));
            return bStat.mtime.getTime() - aStat.mtime.getTime();
        });

    if (files.length === 0) {
        console.error("❌ No deployment files found.");
        process.exit(1);
    }

    try {
        // Process each deployment file
        for (const file of files.slice(0, 2)) { // Only latest 2 deployments
            console.log(`📄 Processing deployment file: ${file}`);
            
            const deploymentPath = path.join(deploymentsDir, file);
            const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

            // Verify each contract in the deployment
            for (const [contractName, contractInfo] of Object.entries(deployment.contracts)) {
                console.log(`\n🔨 Verifying ${contractName}...`);
                console.log(`   Address: ${contractInfo.address}`);
                console.log(`   Constructor Args: ${JSON.stringify(contractInfo.constructorArgs)}`);

                try {
                    await hre.run("verify:verify", {
                        address: contractInfo.address,
                        constructorArguments: contractInfo.constructorArgs,
                    });

                    console.log(`✅ ${contractName} verified successfully!`);
                    console.log(`🔗 View on BaseScan: https://sepolia.basescan.org/address/${contractInfo.address}#code`);

                } catch (error) {
                    if (error.message.includes("Already Verified")) {
                        console.log(`✅ ${contractName} already verified`);
                        console.log(`🔗 View on BaseScan: https://sepolia.basescan.org/address/${contractInfo.address}#code`);
                    } else {
                        console.error(`❌ Failed to verify ${contractName}:`);
                        console.error(`   Error: ${error.message}`);
                        
                        // Try manual verification help
                        console.log(`\n🛠️  Manual verification command:`);
                        console.log(`npx hardhat verify --network baseSepolia ${contractInfo.address} ${contractInfo.constructorArgs.join(' ')}`);
                    }
                }
            }
        }

        console.log("\n" + "=".repeat(50));
        console.log("🎉 Verification process completed!");
        
        console.log("\n📋 Summary:");
        console.log("   All contracts have been processed for verification");
        console.log("   Check BaseScan links above to confirm verification status");
        console.log("   If any verification failed, use the manual commands provided");

    } catch (error) {
        console.error("❌ Verification process failed:");
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