# CLONES Token & Faucet - Base Sepolia Testnet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.30-blue.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.26.3-orange.svg)](https://hardhat.org/)

**Professional implementation of CLONES token and faucet system for Base Sepolia testnet, designed for development and testing of Clones ecosystem applications.**

## 🎯 Overview

This project provides:
- **CLONES ERC20 Token**: Secure, feature-complete token implementation
- **Faucet Contract**: Rate-limited distribution system for developers
- **Professional Deployment**: Production-ready scripts and documentation
- **Security-First**: Follows latest Solidity security best practices

## 📋 Token Specifications

| Property         | Value                          |
| ---------------- | ------------------------------ |
| **Name**         | CLONES                         |
| **Symbol**       | $CLONES                        |
| **Decimals**     | 18                             |
| **Total Supply** | 1,000,000,000 CLONES           |
| **Network**      | Base Sepolia (Chain ID: 84532) |
| **Standards**    | ERC20, AccessControl, Pausable |

## 🚰 Faucet Configuration

| Setting            | Default Value  | Description                  |
| ------------------ | -------------- | ---------------------------- |
| **Claim Amount**   | 1,000 CLONES   | Tokens per claim             |
| **Claim Interval** | 24 hours       | Time between claims          |
| **Daily Limit**    | 100,000 CLONES | Maximum distribution per day |
| **Access Control** | Role-based     | Admin/Pauser roles           |

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v18+ recommended)
2. **Base Sepolia ETH** for deployment
3. **Wallet with Private Key** (test wallet only)

### Installation

```bash
# Clone and setup
git clone <repository>
cd clones-token

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration
```

### Environment Configuration

```bash
# Base Sepolia Configuration
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532

# Deployment Wallet (⚠️ USE TEST WALLET ONLY)
PRIVATE_KEY=0x...your_test_private_key

# Optional: Contract Verification
BASESCAN_API_KEY=your_api_key_here

# Faucet Parameters
FAUCET_DAILY_LIMIT=1000  # Tokens per claim
FAUCET_CLAIM_INTERVAL=86400  # Seconds between claims
```

### Deployment Process

#### 1. Deploy CLONES Token

```bash
# Deploy token contract
npm run deploy:sepolia

# Expected output:
# ✅ CLONES Token deployed successfully!
# Contract address: 0x...
# Total Supply: 1,000,000,000 tokens
```

#### 2. Deploy Faucet Contract

```bash
# Set token address from step 1
export CLONES_TOKEN_ADDRESS=0x...

# Deploy faucet
npm run deploy:faucet

# Expected output:
# ✅ CLONES Faucet deployed successfully!
# Contract address: 0x...
# Claim Amount: 1000 CLONES
```

#### 3. Fund the Faucet

```bash
# Transfer tokens to faucet (using your wallet)
# Or use the owner's minting function

# The faucet needs tokens to distribute
# Recommended: 1,000,000 CLONES for testing
```

#### 4. Verify Contracts

```bash
# Verify on BaseScan
npm run verify

# Expected output:
# ✅ ClonesToken verified successfully!
# ✅ ClonesFaucet verified successfully!
```

## 🔧 Advanced Usage

### Custom Deployment Parameters

```bash
# Custom faucet configuration
export FAUCET_DAILY_LIMIT=5000  # 5000 CLONES per claim
export FAUCET_CLAIM_INTERVAL=43200  # 12 hours between claims

npm run deploy:faucet
```

### Contract Interaction

```javascript
// Using ethers.js
const token = await ethers.getContractAt("ClonesToken", TOKEN_ADDRESS);
const faucet = await ethers.getContractAt("ClonesFaucet", FAUCET_ADDRESS);

// Check balances
const balance = await token.balanceOf(userAddress);
console.log(`Balance: ${ethers.formatEther(balance)} CLONES`);

// Check faucet status
const [canClaim, timeRemaining] = await faucet.canClaim(userAddress);
console.log(`Can claim: ${canClaim}, Time remaining: ${timeRemaining}s`);
```

## 🔒 Security Features

### Token Security
- **Access Control**: Role-based permissions (Admin, Minter, Pauser)
- **Pausable**: Emergency stop functionality
- **Supply Cap**: Hard limit of 1B tokens
- **Burn Functionality**: Deflationary mechanism

### Faucet Security
- **Rate Limiting**: Per-address and daily limits
- **Reentrancy Protection**: Safe external calls
- **Input Validation**: Comprehensive checks
- **Emergency Controls**: Admin pause/unpause

### Audit Readiness
- **Complete NatSpec**: Function documentation
- **Security Comments**: Audit-friendly code
- **Test Coverage**: >95% coverage target
- **Slither Analysis**: Static security analysis

## 🧪 Testing

```bash
# Run tests
npm test

# Coverage report
npm run coverage

# Gas analysis
REPORT_GAS=true npm test

# Security analysis (requires Slither)
npm run security                    # Standard configuration (recommended)
npm run security:production         # Production audit configuration  
npm run security:optimal            # Optimal balance configuration

# Or use slither directly:
slither . --config slither.config.json              # Standard (recommended)
slither . --config slither-production.config.json   # Production audit
slither . --config slither-optimal.config.json      # Optimal balance
# See "Security Analysis Configurations" section for detailed explanations
```

## 📁 Project Structure

```
clones-token/
├── contracts/
│   ├── ClonesToken.sol      # ERC20 token implementation
│   └── ClonesFaucet.sol     # Faucet contract
├── scripts/
│   ├── deploy.js            # Token deployment
│   ├── deploy-faucet.js     # Faucet deployment  
│   └── verify.js            # Contract verification
├── deployments/             # Deployment records
├── hardhat.config.js        # Network configuration
├── slither.config.json      # Standard Slither configuration
├── slither-production.config.json  # Production audit configuration
├── slither-optimal.config.json     # Optimal balance configuration
└── README.md               # This file
```

## 🔍 Security Analysis Configurations

This project includes multiple Slither configurations optimized for different use cases:

### Available Configurations

#### 🎯 `slither.config.json` (Recommended)
**Use case:** Standard development and CI/CD integration
```bash
slither . --config slither.config.json
```
**Features:**
- Excludes safe issues (assembly, pragma, solc-version, naming-convention)
- Includes timestamp warnings (important for faucet contracts)
- Generates JSON report for automation
- Balanced between noise reduction and security coverage

#### 🏭 `slither-production.config.json` (Production Audit)
**Use case:** Pre-deployment comprehensive audit
```bash
slither . --config slither-production.config.json
```
**Features:**
- Maximum detector coverage
- Multiple output formats (JSON, SARIF, Markdown, ZIP)
- Comprehensive reporting for audit documentation
- Includes optimization suggestions

#### ⚖️ `slither-optimal.config.json` (Minimal Noise)
**Use case:** Quick security checks during development
```bash
slither . --config slither-optimal.config.json
```
**Features:**
- Focuses on high-impact security issues
- Minimal false positives
- Fast execution
- Clean output for developers

### Configuration Comparison

| Feature                 | Standard   | Production | Optimal    |
| ----------------------- | ---------- | ---------- | ---------- |
| **Assembly warnings**   | ❌ Excluded | ❌ Excluded | ❌ Excluded |
| **Timestamp warnings**  | ✅ Included | ✅ Included | ✅ Included |
| **Optimization checks** | ✅ Included | ✅ Included | ✅ Included |
| **JSON output**         | ✅ Yes      | ✅ Yes      | ✅ Yes      |
| **Multiple formats**    | ❌ No       | ✅ Yes      | ❌ No       |
| **Execution speed**     | 🟡 Medium   | 🔴 Slow     | 🟢 Fast     |
| **Report detail**       | 🟡 Medium   | 🟢 High     | 🟡 Medium   |

### Understanding Findings

#### ⚠️ Expected Findings for Faucet Contracts
```
ClonesFaucet.claimTokens() uses timestamp for comparisons
```
**Status:** ✅ **ACCEPTABLE** - Timestamp usage is necessary for rate limiting in faucet contracts. The 24-hour interval makes miner manipulation (~15 seconds) negligible.

#### 🚨 Critical Findings to Address
**Status: ✅ NO CRITICAL ISSUES FOUND**

If Slither ever reports findings related to:
- **Reentrancy vulnerabilities** - Address immediately
- **Access control bypasses** - Review role assignments  
- **Integer overflow/underflow** - Use SafeMath or newer Solidity
- **Uninitialized storage pointers** - Initialize all storage variables

**Current Security Status:**
- ✅ Reentrancy protection: `ReentrancyGuard` implemented
- ✅ Access control: Role-based with OpenZeppelin `AccessControl`
- ✅ Integer safety: Solidity 0.8.30 built-in overflow protection
- ✅ Storage safety: All variables properly initialized

### Security Validation Commands

Verify security implementations:
```bash
# Check reentrancy protection
grep -r "nonReentrant" contracts/
# Expected: ClonesFaucet.claimTokens() has nonReentrant modifier

# Check access control
grep -r "onlyRole" contracts/
# Expected: All admin functions protected with role modifiers

# Check pausable implementation  
grep -r "whenNotPaused" contracts/
# Expected: Critical functions have pause protection

# Verify no SafeMath needed (Solidity 0.8.30+)
grep -r "SafeMath" contracts/
# Expected: No results (built-in overflow protection)
```

### Integration with CI/CD

Add to your GitHub Actions or CI pipeline:
```yaml
- name: Security Analysis
  run: |
    pip install slither-analyzer
    slither . --config slither.config.json
    # Fail if high/medium severity findings
    slither . --config slither.config.json --json - | jq '.results.detectors[] | select(.impact=="High" or .impact=="Medium")' | jq -e 'length == 0'
```

### Troubleshooting Slither

**"Command not found: slither"**
```bash
pip install slither-analyzer
# or
pip3 install slither-analyzer
```

**"Report file already exists"**
```bash
rm slither-report.json  # Remove existing report
npm run security        # Run again
```

**Too many false positives**
- Use `npm run security:optimal` for cleaner output
- Check the "Understanding Findings" section above

## 🌐 Network Information

### Base Sepolia Testnet
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **Faucets**: 
  - [Base Faucets](https://docs.base.org/base-chain/tools/network-faucets)
  - [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

### Adding to MetaMask
```json
{
  "networkName": "Base Sepolia",
  "rpcUrl": "https://sepolia.base.org",
  "chainId": 84532,
  "symbol": "ETH",
  "blockExplorer": "https://sepolia.basescan.org"
}
```

## 🛠️ Administration

### Token Administration
```bash
# Grant roles (run from deployment account)
npm run console
> const token = await ethers.getContractAt("ClonesToken", "0x...");
> await token.grantRole(MINTER_ROLE, "0x...new_minter");
```

### Faucet Administration  
```bash
# Configure faucet parameters
> const faucet = await ethers.getContractAt("ClonesFaucet", "0x...");
> await faucet.configureFaucet(
    ethers.parseEther("2000"), // 2000 tokens per claim
    12 * 60 * 60,              // 12 hours between claims
    ethers.parseEther("200000") // 200k daily limit
  );
```

### Emergency Procedures
```bash
# Pause contracts
> await token.pause();     # Pause token transfers
> await faucet.pause();    # Pause faucet claims

# Unpause
> await token.unpause();
> await faucet.unpause();
```

## 🐛 Troubleshooting

### Common Issues

**"Insufficient balance" during deployment**
- Ensure your wallet has Base Sepolia ETH
- Visit Base faucets to get test ETH

**"Contract not verified" error**  
- Wait a few minutes after deployment
- Ensure BASESCAN_API_KEY is set
- Run `npm run verify` manually

**"Daily limit exceeded" on faucet**
- Check daily distribution status
- Wait for next day (00:00 UTC reset)
- Admin can increase daily limit

**"Claim too soon" error**
- User must wait 24 hours between claims
- Check `canClaim()` function for exact timing

### Gas Estimation Issues
```bash
# If deployment fails with gas issues
export GAS_LIMIT=2000000
export GAS_PRICE=20000000000  # 20 gwei

npm run deploy:sepolia
```

## 🔗 Contract Addresses

After deployment, update this section:

```bash
# Base Sepolia Testnet
CLONES_TOKEN=0x...
CLONES_FAUCET=0x...

# Verify at:
# https://sepolia.basescan.org/address/0x...
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
