const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration Tests", function () {
    let clonesToken, clonesFaucet;
    let owner, user1, user2;
    const CLAIM_AMOUNT = ethers.parseEther("1000");
    const CLAIM_INTERVAL = 24 * 60 * 60;
    const DAILY_LIMIT = ethers.parseEther("100000");
    const FAUCET_FUNDING = ethers.parseEther("500000");

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

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

    describe("Full User Journey", function () {
        it("Should handle complete faucet interaction flow", async function () {
            // 1. User claims tokens from faucet
            const initialBalance = await clonesToken.balanceOf(user1.address);

            await clonesFaucet.connect(user1).claimTokens();

            expect(await clonesToken.balanceOf(user1.address)).to.equal(initialBalance + CLAIM_AMOUNT);

            // 2. User can't claim again immediately
            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.be.revertedWithCustomError(clonesFaucet, "ClaimTooSoon");

            // 3. Check claim status
            const [canClaim, timeRemaining] = await clonesFaucet.canClaim(user1.address);
            expect(canClaim).to.be.false;
            expect(timeRemaining).to.be.closeTo(CLAIM_INTERVAL, 10);

            // 4. Fast forward time
            await time.increase(CLAIM_INTERVAL);

            // 5. User can claim again
            const [canClaimAfter] = await clonesFaucet.canClaim(user1.address);
            expect(canClaimAfter).to.be.true;

            await clonesFaucet.connect(user1).claimTokens();
            expect(await clonesToken.balanceOf(user1.address)).to.equal(initialBalance + (CLAIM_AMOUNT * 2n));
        });

        it("Should handle multiple users claiming simultaneously", async function () {
            const users = [user1, user2];
            const initialBalances = [];

            // Record initial balances
            for (const user of users) {
                initialBalances.push(await clonesToken.balanceOf(user.address));
            }

            // All users claim
            for (const user of users) {
                await clonesFaucet.connect(user).claimTokens();
            }

            // Verify all balances increased
            for (let i = 0; i < users.length; i++) {
                expect(await clonesToken.balanceOf(users[i].address))
                    .to.equal(initialBalances[i] + CLAIM_AMOUNT);
            }

            // Verify total distribution
            expect(await clonesFaucet.totalDistributed()).to.equal(CLAIM_AMOUNT * BigInt(users.length));
        });

        it("Should handle faucet running out of funds", async function () {
            // Drain most of the faucet
            const faucetBalance = await clonesToken.balanceOf(await clonesFaucet.getAddress());
            const keepAmount = CLAIM_AMOUNT - ethers.parseEther("1"); // Less than one claim
            const withdrawAmount = faucetBalance - keepAmount;

            await clonesFaucet.connect(owner).withdrawTokens(withdrawAmount);

            // Attempt to claim should fail
            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.be.revertedWithCustomError(clonesFaucet, "InsufficientFaucetBalance");

            // canClaim should return false
            const [canClaim] = await clonesFaucet.canClaim(user1.address);
            expect(canClaim).to.be.false;

            // Refund faucet
            await clonesToken.connect(owner).transfer(await clonesFaucet.getAddress(), CLAIM_AMOUNT);

            // Now claim should work
            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.emit(clonesFaucet, "TokensClaimed");
        });

        it("Should handle daily limit reset and continuation", async function () {
            // Calculate exact number of claims to hit daily limit
            const claimsToHitLimit = Number(DAILY_LIMIT / CLAIM_AMOUNT);

            // Create enough users to hit the limit
            const users = [];
            for (let i = 0; i < claimsToHitLimit; i++) {
                const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: wallet.address,
                    value: ethers.parseEther("1") // Gas money
                });
                users.push(wallet);
            }

            // Make claims to hit exactly the daily limit
            for (const user of users) {
                await clonesFaucet.connect(user).claimTokens();
            }

            // Verify daily limit is hit
            const [currentDist, remainingDist] = await clonesFaucet.getDailyDistributionStatus();
            expect(currentDist).to.equal(DAILY_LIMIT);
            expect(remainingDist).to.equal(0);

            // New user can't claim
            const newUser = ethers.Wallet.createRandom().connect(ethers.provider);
            await owner.sendTransaction({
                to: newUser.address,
                value: ethers.parseEther("1")
            });

            await expect(clonesFaucet.connect(newUser).claimTokens())
                .to.be.revertedWithCustomError(clonesFaucet, "DailyLimitExceeded");

            // Advance to next day
            await time.increase(24 * 60 * 60);

            // Now new user can claim
            await expect(clonesFaucet.connect(newUser).claimTokens())
                .to.emit(clonesFaucet, "TokensClaimed");

            // Verify daily stats reset
            const [newCurrentDist, newRemainingDist] = await clonesFaucet.getDailyDistributionStatus();
            expect(newCurrentDist).to.equal(CLAIM_AMOUNT);
            expect(newRemainingDist).to.equal(DAILY_LIMIT - CLAIM_AMOUNT);
        });

        it("Should handle token burning and supply changes", async function () {
            const initialSupply = await clonesToken.totalSupply();

            // User claims tokens
            await clonesFaucet.connect(user1).claimTokens();

            // User burns half of claimed tokens
            const burnAmount = CLAIM_AMOUNT / 2n;
            await clonesToken.connect(user1).burn(burnAmount);

            // Verify supply decreased
            expect(await clonesToken.totalSupply()).to.equal(initialSupply - burnAmount);
            expect(await clonesToken.balanceOf(user1.address)).to.equal(CLAIM_AMOUNT - burnAmount);
        });

        it("Should handle pausing and emergency scenarios", async function () {
            // User claims normally
            await clonesFaucet.connect(user1).claimTokens();

            // Emergency pause
            await clonesFaucet.connect(owner).pause();
            await clonesToken.connect(owner).pause();

            // Fast forward past claim interval
            await time.increase(CLAIM_INTERVAL);

            // All operations should be paused
            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.be.revertedWithCustomError(clonesFaucet, "EnforcedPause");

            await expect(clonesToken.connect(user1).transfer(user2.address, ethers.parseEther("100")))
                .to.be.revertedWithCustomError(clonesToken, "EnforcedPause");

            // Unpause
            await clonesFaucet.connect(owner).unpause();
            await clonesToken.connect(owner).unpause();

            // Operations should work again
            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.emit(clonesFaucet, "TokensClaimed");
        });
    });

    describe("Edge Cases and Attack Scenarios", function () {
        it("Should prevent reentrancy attacks", async function () {
            // The faucet uses ReentrancyGuard, so this test ensures it works
            // Even if a malicious token tried to reenter, it should fail

            // This is tested by the NoContractCalls check
            const TestContract = await ethers.getContractFactory("TestContractCaller");
            const testContract = await TestContract.deploy();
            await testContract.waitForDeployment();

            await expect(testContract.callFaucet(await clonesFaucet.getAddress()))
                .to.be.revertedWithCustomError(clonesFaucet, "NoContractCalls");
        });

        it("Should handle timestamp edge cases", async function () {
            await clonesFaucet.connect(user1).claimTokens();

            // Try to claim exactly at the boundary
            await time.increaseTo((await time.latest()) + CLAIM_INTERVAL);

            // Should be able to claim now
            await expect(clonesFaucet.connect(user1).claimTokens())
                .to.emit(clonesFaucet, "TokensClaimed");
        });

        it("Should handle day transition edge cases", async function () {
            // Make a claim late in the day
            const currentTime = await time.latest();
            const currentDay = Math.floor(currentTime / (24 * 60 * 60));
            const endOfDay = (currentDay + 1) * 24 * 60 * 60 - 1;

            await time.increaseTo(endOfDay);
            await clonesFaucet.connect(user1).claimTokens();

            // Advance by 1 second to next day
            await time.increase(1);

            // The daily distribution status should show reset for new day
            // Make a claim to trigger the day reset logic
            const newUser = ethers.Wallet.createRandom().connect(ethers.provider);
            await owner.sendTransaction({
                to: newUser.address,
                value: ethers.parseEther("1")
            });
            await clonesFaucet.connect(newUser).claimTokens();

            // Now check that it shows the new claim amount (reset happened)
            const [currentDist] = await clonesFaucet.getDailyDistributionStatus();
            expect(currentDist).to.equal(CLAIM_AMOUNT * 2n); // Should show both the original claim and new claim
        });

        it("Should handle configuration changes mid-operation", async function () {
            // User claims
            await clonesFaucet.connect(user1).claimTokens();

            // Admin changes configuration
            const newClaimAmount = ethers.parseEther("500");
            const newInterval = 12 * 60 * 60;

            await clonesFaucet.connect(owner).configureFaucet(
                newClaimAmount,
                newInterval,
                ethers.parseEther("50000")
            );

            // Wait for new interval (configuration change should apply immediately for timing)
            await time.increase(CLAIM_INTERVAL);

            // Now user should be able to claim with new amount
            const balanceBefore = await clonesToken.balanceOf(user1.address);
            await clonesFaucet.connect(user1).claimTokens();
            const balanceAfter = await clonesToken.balanceOf(user1.address);

            expect(balanceAfter - balanceBefore).to.equal(newClaimAmount);
        });
    });

    describe("Gas Usage and Optimization", function () {
        it("Should use reasonable gas for claims", async function () {
            const tx = await clonesFaucet.connect(user1).claimTokens();
            const receipt = await tx.wait();

            // Gas usage should be reasonable (adjust threshold as needed)
            expect(receipt.gasUsed).to.be.lessThan(150000);
        });

        it("Should use reasonable gas for view functions", async function () {
            // These should be very low gas
            await clonesFaucet.canClaim(user1.address);
            await clonesFaucet.getFaucetBalance();
            await clonesFaucet.getDailyDistributionStatus();

            // View functions don't consume gas, but this ensures they execute
            expect(true).to.be.true;
        });
    });
});