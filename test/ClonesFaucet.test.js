const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ClonesFaucet", function () {
    let clonesToken, clonesFaucet;
    let owner, admin, pauser, user1, user2, user3, zeroAddress;
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

    const CLAIM_AMOUNT = ethers.parseEther("1000"); // 1000 tokens
    const CLAIM_INTERVAL = 24 * 60 * 60; // 24 hours
    const DAILY_LIMIT = ethers.parseEther("100000"); // 100,000 tokens per day
    const FAUCET_FUNDING = ethers.parseEther("1000000"); // 1M tokens for testing

    beforeEach(async function () {
        [owner, admin, pauser, user1, user2, user3] = await ethers.getSigners();
        zeroAddress = "0x0000000000000000000000000000000000000000";

        // Deploy token
        const ClonesToken = await ethers.getContractFactory("ClonesToken");
        clonesToken = await ClonesToken.deploy(owner.address);
        await clonesToken.waitForDeployment();

        // Deploy faucet
        const ClonesFaucet = await ethers.getContractFactory("ClonesFaucet");
        clonesFaucet = await ClonesFaucet.deploy(
            await clonesToken.getAddress(),
            owner.address,
            CLAIM_AMOUNT,
            CLAIM_INTERVAL,
            DAILY_LIMIT
        );
        await clonesFaucet.waitForDeployment();

        // Fund the faucet
        await clonesToken.connect(owner).transfer(await clonesFaucet.getAddress(), FAUCET_FUNDING);
    });

    describe("Deployment", function () {
        it("Should deploy with correct parameters", async function () {
            expect(await clonesFaucet.CLONES_TOKEN()).to.equal(await clonesToken.getAddress());
            expect(await clonesFaucet.claimAmount()).to.equal(CLAIM_AMOUNT);
            expect(await clonesFaucet.claimInterval()).to.equal(CLAIM_INTERVAL);
            expect(await clonesFaucet.dailyDistributionLimit()).to.equal(DAILY_LIMIT);
        });

        it("Should grant roles correctly", async function () {
            expect(await clonesFaucet.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await clonesFaucet.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
            expect(await clonesFaucet.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
        });

        it("Should emit FaucetConfigured event", async function () {
            const ClonesFaucet = await ethers.getContractFactory("ClonesFaucet");
            const deployTx = await ClonesFaucet.deploy(
                await clonesToken.getAddress(),
                owner.address,
                CLAIM_AMOUNT,
                CLAIM_INTERVAL,
                DAILY_LIMIT
            );
            await expect(deployTx.deploymentTransaction())
                .to.emit(deployTx, "FaucetConfigured")
                .withArgs(CLAIM_AMOUNT, CLAIM_INTERVAL, DAILY_LIMIT);
        });

        it("Should revert with zero token address", async function () {
            const ClonesFaucet = await ethers.getContractFactory("ClonesFaucet");
            await expect(ClonesFaucet.deploy(
                zeroAddress,
                owner.address,
                CLAIM_AMOUNT,
                CLAIM_INTERVAL,
                DAILY_LIMIT
            )).to.be.revertedWithCustomError(clonesFaucet, "ZeroTokenAddress");
        });

        it("Should revert with zero owner address", async function () {
            const ClonesFaucet = await ethers.getContractFactory("ClonesFaucet");
            await expect(ClonesFaucet.deploy(
                await clonesToken.getAddress(),
                zeroAddress,
                CLAIM_AMOUNT,
                CLAIM_INTERVAL,
                DAILY_LIMIT
            )).to.be.revertedWithCustomError(clonesFaucet, "ZeroOwnerAddress");
        });

        it("Should revert with zero claim amount", async function () {
            const ClonesFaucet = await ethers.getContractFactory("ClonesFaucet");
            await expect(ClonesFaucet.deploy(
                await clonesToken.getAddress(),
                owner.address,
                0,
                CLAIM_INTERVAL,
                DAILY_LIMIT
            )).to.be.revertedWithCustomError(clonesFaucet, "ZeroClaimAmount");
        });

        it("Should revert with zero claim interval", async function () {
            const ClonesFaucet = await ethers.getContractFactory("ClonesFaucet");
            await expect(ClonesFaucet.deploy(
                await clonesToken.getAddress(),
                owner.address,
                CLAIM_AMOUNT,
                0,
                DAILY_LIMIT
            )).to.be.revertedWithCustomError(clonesFaucet, "ZeroClaimInterval");
        });

        it("Should revert with daily limit too low", async function () {
            const ClonesFaucet = await ethers.getContractFactory("ClonesFaucet");
            await expect(ClonesFaucet.deploy(
                await clonesToken.getAddress(),
                owner.address,
                CLAIM_AMOUNT,
                CLAIM_INTERVAL,
                ethers.parseEther("500") // Less than claim amount
            )).to.be.revertedWithCustomError(clonesFaucet, "DailyLimitTooLow");
        });
    });

    describe("Token Claiming", function () {
        it("Should allow first claim", async function () {
            const initialBalance = await clonesToken.balanceOf(user1.address);

            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.emit(clonesFaucet, "TokensClaimed");

            expect(await clonesToken.balanceOf(user1.address)).to.equal(initialBalance + CLAIM_AMOUNT);
            expect(await clonesFaucet.totalDistributed()).to.equal(CLAIM_AMOUNT);
        });

        it("Should revert second claim before interval", async function () {
            await clonesFaucet.connect(user1).claimTokens();

            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.be.revertedWithCustomError(clonesFaucet, "ClaimTooSoon");
        });

        it("Should allow claim after interval", async function () {
            await clonesFaucet.connect(user1).claimTokens();

            // Fast forward time
            await time.increase(CLAIM_INTERVAL);

            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.emit(clonesFaucet, "TokensClaimed");
        });

        it("Should revert when daily limit exceeded", async function () {
            // Calculate how many claims needed to hit daily limit exactly
            const claimsNeeded = Number(DAILY_LIMIT / CLAIM_AMOUNT);

            // Create enough unique users to hit the limit
            const users = [];
            for (let i = 0; i < claimsNeeded + 1; i++) {
                const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: wallet.address,
                    value: ethers.parseEther("1")
                });
                users.push(wallet);
            }

            // Make claims to hit exactly the daily limit
            for (let i = 0; i < claimsNeeded; i++) {
                await clonesFaucet.connect(users[i]).claimTokens();
            }

            // This should fail due to daily limit
            await expect(clonesFaucet.connect(users[claimsNeeded]).claimTokens())
                .to.be.revertedWithCustomError(clonesFaucet, "DailyLimitExceeded");
        });

        it("Should reset daily limit on new day", async function () {
            // Exhaust daily limit
            const claimsNeeded = Number(DAILY_LIMIT / CLAIM_AMOUNT);
            for (let i = 0; i < claimsNeeded; i++) {
                // Create a new signer for each claim to avoid interval restriction
                const newUser = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: newUser.address,
                    value: ethers.parseEther("1") // Send ETH for gas
                });
                await clonesFaucet.connect(newUser).claimTokens();
            }

            // Advance to next day
            await time.increase(24 * 60 * 60);

            // Should be able to claim again
            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.emit(clonesFaucet, "TokensClaimed");
        });

        it("Should revert when faucet has insufficient balance", async function () {
            // Drain most of the faucet
            const faucetBalance = await clonesToken.balanceOf(await clonesFaucet.getAddress());
            const drainAmount = faucetBalance - CLAIM_AMOUNT + ethers.parseEther("1");

            await clonesFaucet.connect(owner).withdrawTokens(drainAmount);

            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.be.revertedWithCustomError(clonesFaucet, "InsufficientFaucetBalance");
        });

        it("Should revert when paused", async function () {
            await clonesFaucet.connect(owner).pause();

            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.be.revertedWithCustomError(clonesFaucet, "EnforcedPause");
        });

        it("Should revert contract calls", async function () {
            // Deploy a contract that tries to call the faucet
            const ContractCaller = await ethers.getContractFactory("TestContractCaller");
            const contractCaller = await ContractCaller.deploy();
            await contractCaller.waitForDeployment();

            await expect(contractCaller.callFaucet(await clonesFaucet.getAddress()))
                .to.be.revertedWithCustomError(clonesFaucet, "NoContractCalls");
        });

        it("Should emit DailyLimitReached when limit hit", async function () {
            // Make enough claims to hit daily limit exactly
            const claimsNeeded = Number(DAILY_LIMIT / CLAIM_AMOUNT);

            for (let i = 0; i < claimsNeeded - 1; i++) {
                const newUser = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: newUser.address,
                    value: ethers.parseEther("1")
                });
                await clonesFaucet.connect(newUser).claimTokens();
            }

            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.emit(clonesFaucet, "DailyLimitReached");
        });
    });

    describe("canClaim View Function", function () {
        it("Should return true for first time claimer", async function () {
            const [canClaim, timeRemaining] = await clonesFaucet.canClaim(user1.address);
            expect(canClaim).to.be.true;
            expect(timeRemaining).to.equal(0);
        });

        it("Should return false immediately after claim", async function () {
            await clonesFaucet.connect(user1).claimTokens();

            const [canClaim, timeRemaining] = await clonesFaucet.canClaim(user1.address);
            expect(canClaim).to.be.false;
            expect(timeRemaining).to.be.closeTo(CLAIM_INTERVAL, 10); // Within 10 seconds
        });

        it("Should return true after interval", async function () {
            await clonesFaucet.connect(user1).claimTokens();
            await time.increase(CLAIM_INTERVAL);

            const [canClaim, timeRemaining] = await clonesFaucet.canClaim(user1.address);
            expect(canClaim).to.be.true;
            expect(timeRemaining).to.equal(0);
        });

        it("Should revert with zero address", async function () {
            await expect(clonesFaucet.canClaim(zeroAddress))
                .to.be.revertedWithCustomError(clonesFaucet, "ZeroAddressCheck");
        });

        it("Should return false when daily limit exceeded", async function () {
            // Exhaust daily limit with other users
            const claimsNeeded = Number(DAILY_LIMIT / CLAIM_AMOUNT);
            for (let i = 0; i < claimsNeeded; i++) {
                const newUser = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: newUser.address,
                    value: ethers.parseEther("1")
                });
                await clonesFaucet.connect(newUser).claimTokens();
            }

            const [canClaim, timeRemaining] = await clonesFaucet.canClaim(user1.address);
            expect(canClaim).to.be.false;
        });

        it("Should return false when faucet has insufficient balance", async function () {
            // Drain the faucet
            const faucetBalance = await clonesToken.balanceOf(await clonesFaucet.getAddress());
            await clonesFaucet.connect(owner).withdrawTokens(faucetBalance);

            const [canClaim, timeRemaining] = await clonesFaucet.canClaim(user1.address);
            expect(canClaim).to.be.false;
        });

        it("Should return false when paused", async function () {
            await clonesFaucet.connect(owner).pause();

            const [canClaim, timeRemaining] = await clonesFaucet.canClaim(user1.address);
            expect(canClaim).to.be.false;
        });
    });

    describe("Admin Functions", function () {
        beforeEach(async function () {
            await clonesFaucet.connect(owner).grantRole(ADMIN_ROLE, admin.address);
        });

        it("Should allow admin to configure faucet", async function () {
            const newClaimAmount = ethers.parseEther("2000");
            const newInterval = 12 * 60 * 60; // 12 hours
            const newDailyLimit = ethers.parseEther("200000");

            await expect(clonesFaucet.connect(admin).configureFaucet(newClaimAmount, newInterval, newDailyLimit))
                .to.emit(clonesFaucet, "FaucetConfigured")
                .withArgs(newClaimAmount, newInterval, newDailyLimit);

            expect(await clonesFaucet.claimAmount()).to.equal(newClaimAmount);
            expect(await clonesFaucet.claimInterval()).to.equal(newInterval);
            expect(await clonesFaucet.dailyDistributionLimit()).to.equal(newDailyLimit);
        });

        it("Should revert configure with zero claim amount", async function () {
            await expect(clonesFaucet.connect(admin).configureFaucet(0, CLAIM_INTERVAL, DAILY_LIMIT))
                .to.be.revertedWithCustomError(clonesFaucet, "ZeroClaimAmount");
        });

        it("Should revert configure with zero interval", async function () {
            await expect(clonesFaucet.connect(admin).configureFaucet(CLAIM_AMOUNT, 0, DAILY_LIMIT))
                .to.be.revertedWithCustomError(clonesFaucet, "ZeroClaimInterval");
        });

        it("Should revert configure with low daily limit", async function () {
            await expect(clonesFaucet.connect(admin).configureFaucet(CLAIM_AMOUNT, CLAIM_INTERVAL, ethers.parseEther("500")))
                .to.be.revertedWithCustomError(clonesFaucet, "DailyLimitTooLow");
        });

        it("Should allow admin to withdraw tokens", async function () {
            const withdrawAmount = ethers.parseEther("10000");
            const initialAdminBalance = await clonesToken.balanceOf(admin.address);

            await expect(clonesFaucet.connect(admin).withdrawTokens(withdrawAmount))
                .to.emit(clonesFaucet, "TokensWithdrawn")
                .withArgs(admin.address, withdrawAmount);

            expect(await clonesToken.balanceOf(admin.address)).to.equal(initialAdminBalance + withdrawAmount);
        });

        it("Should revert withdraw zero amount", async function () {
            await expect(clonesFaucet.connect(admin).withdrawTokens(0))
                .to.be.revertedWithCustomError(clonesFaucet, "ZeroWithdrawAmount");
        });

        it("Should revert withdraw more than balance", async function () {
            const faucetBalance = await clonesToken.balanceOf(await clonesFaucet.getAddress());
            await expect(clonesFaucet.connect(admin).withdrawTokens(faucetBalance + ethers.parseEther("1")))
                .to.be.revertedWithCustomError(clonesFaucet, "InsufficientBalance");
        });

        it("Should revert when non-admin tries to configure", async function () {
            await expect(clonesFaucet.connect(user1).configureFaucet(CLAIM_AMOUNT, CLAIM_INTERVAL, DAILY_LIMIT))
                .to.be.revertedWithCustomError(clonesFaucet, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, ADMIN_ROLE);
        });

        it("Should revert when non-admin tries to withdraw", async function () {
            await expect(clonesFaucet.connect(user1).withdrawTokens(ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesFaucet, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, ADMIN_ROLE);
        });
    });

    describe("Pausing", function () {
        beforeEach(async function () {
            await clonesFaucet.connect(owner).grantRole(PAUSER_ROLE, pauser.address);
        });

        it("Should allow pauser to pause", async function () {
            await clonesFaucet.connect(pauser).pause();
            expect(await clonesFaucet.paused()).to.be.true;
        });

        it("Should allow pauser to unpause", async function () {
            await clonesFaucet.connect(pauser).pause();
            await clonesFaucet.connect(pauser).unpause();
            expect(await clonesFaucet.paused()).to.be.false;
        });

        it("Should revert when non-pauser tries to pause", async function () {
            await expect(clonesFaucet.connect(user1).pause())
                .to.be.revertedWithCustomError(clonesFaucet, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, PAUSER_ROLE);
        });
    });

    describe("View Functions", function () {
        it("Should return correct faucet balance", async function () {
            const balance = await clonesFaucet.getFaucetBalance();
            const tokenBalance = await clonesToken.balanceOf(await clonesFaucet.getAddress());
            expect(balance).to.equal(tokenBalance);
        });

        it("Should return correct daily distribution status", async function () {
            await clonesFaucet.connect(user1).claimTokens();

            const [currentDistribution, remainingDistribution, dayIdentifier] = await clonesFaucet.getDailyDistributionStatus();

            expect(currentDistribution).to.equal(CLAIM_AMOUNT);
            expect(remainingDistribution).to.equal(DAILY_LIMIT - CLAIM_AMOUNT);
            expect(dayIdentifier).to.equal(Math.floor(await time.latest() / (24 * 60 * 60)));
        });

        it("Should reset daily distribution status on new day", async function () {
            await clonesFaucet.connect(user1).claimTokens();
            await time.increase(24 * 60 * 60);

            const [currentDistribution, remainingDistribution, dayIdentifier] = await clonesFaucet.getDailyDistributionStatus();

            expect(currentDistribution).to.equal(0);
            expect(remainingDistribution).to.equal(DAILY_LIMIT);
        });
    });

    describe("Emergency Recovery", function () {
        let otherToken;

        beforeEach(async function () {
            // Deploy another token for testing recovery
            const OtherToken = await ethers.getContractFactory("ClonesToken");
            otherToken = await OtherToken.deploy(owner.address);
            await otherToken.waitForDeployment();

            // Send some other tokens to faucet by mistake
            await otherToken.connect(owner).transfer(await clonesFaucet.getAddress(), ethers.parseEther("1000"));
        });

        it("Should allow recovery of accidentally sent tokens", async function () {
            const recoveryAmount = ethers.parseEther("500");
            const initialBalance = await otherToken.balanceOf(owner.address);

            await clonesFaucet.connect(owner).emergencyRecoverTokens(await otherToken.getAddress(), recoveryAmount);

            expect(await otherToken.balanceOf(owner.address)).to.equal(initialBalance + recoveryAmount);
        });

        it("Should prevent recovery of faucet tokens", async function () {
            await expect(clonesFaucet.connect(owner).emergencyRecoverTokens(await clonesToken.getAddress(), ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesFaucet, "CannotRecoverFaucetTokens");
        });

        it("Should revert recovery of zero address token", async function () {
            await expect(clonesFaucet.connect(owner).emergencyRecoverTokens(zeroAddress, ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesFaucet, "ZeroTokenAddress");
        });

        it("Should revert recovery of zero amount", async function () {
            await expect(clonesFaucet.connect(owner).emergencyRecoverTokens(await otherToken.getAddress(), 0))
                .to.be.revertedWithCustomError(clonesFaucet, "ZeroRecoveryAmount");
        });
    });
});

// Helper function for access control reverts (legacy - now using custom errors)
function revertedWithAccessControl(account, role) {
    return `AccessControl: account ${account.toLowerCase()} is missing role ${role}`;
}

// Test contract to simulate contract calls
const TEST_CONTRACT_CALLER = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IClonesFaucet {
    function claimTokens() external;
}

contract TestContractCaller {
    function callFaucet(address faucet) external {
        IClonesFaucet(faucet).claimTokens();
    }
}
`;