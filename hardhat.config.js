require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // Enable debugging info for better error messages
      debug: {
        revertStrings: "debug"
      }
    },
  },
  networks: {
    baseSepolia: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 84532,
      // Gas settings for Base Sepolia
      gas: "auto",
      gasPrice: "auto",
      // Verify contract after deployment
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.basescan.org",
          apiKey: BASESCAN_API_KEY
        }
      }
    },
    hardhat: {
      // Fork Base Sepolia for local testing
      forking: process.env.ENABLE_FORKING === "true" ? {
        url: RPC_URL,
        blockNumber: undefined // Latest block
      } : undefined,
    }
  },
  // Contract verification
  etherscan: {
    apiKey: {
      baseSepolia: BASESCAN_API_KEY
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
  // Gas reporter for optimization
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    gasPrice: 21,
    coinmarketcap: process.env.CMC_API_KEY
  },
  // Coverage settings
  solidity_coverage: {
    matrix: {
      storageLayout: true
    }
  }
};