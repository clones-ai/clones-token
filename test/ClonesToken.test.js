const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClonesToken", function () {
    let clonesToken;
    let owner, minter, pauser, user1, user2, zeroAddress;
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const MAX_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens

    beforeEach(async function () {
        [owner, minter, pauser, user1, user2] = await ethers.getSigners();
        zeroAddress = "0x0000000000000000000000000000000000000000";

        const ClonesToken = await ethers.getContractFactory("ClonesToken");
        clonesToken = await ClonesToken.deploy(owner.address);
        await clonesToken.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should deploy with correct name and symbol", async function () {
            expect(await clonesToken.name()).to.equal("CLONES");
            expect(await clonesToken.symbol()).to.equal("$CLONES");
            expect(await clonesToken.decimals()).to.equal(18);
        });

        it("Should mint full supply to owner", async function () {
            expect(await clonesToken.totalSupply()).to.equal(MAX_SUPPLY);
            expect(await clonesToken.balanceOf(owner.address)).to.equal(MAX_SUPPLY);
        });

        it("Should grant all roles to owner", async function () {
            expect(await clonesToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await clonesToken.hasRole(MINTER_ROLE, owner.address)).to.be.true;
            expect(await clonesToken.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
        });

        it("Should revert with zero address owner", async function () {
            const ClonesToken = await ethers.getContractFactory("ClonesToken");
            await expect(ClonesToken.deploy(zeroAddress))
                .to.be.revertedWithCustomError(clonesToken, "ZeroAddressOwner");
        });
    });

    describe("Role Management", function () {
        beforeEach(async function () {
            await clonesToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
            await clonesToken.connect(owner).grantRole(PAUSER_ROLE, pauser.address);
        });

        it("Should allow admin to grant roles", async function () {
            expect(await clonesToken.hasRole(MINTER_ROLE, minter.address)).to.be.true;
            expect(await clonesToken.hasRole(PAUSER_ROLE, pauser.address)).to.be.true;
        });

        it("Should allow admin to revoke roles", async function () {
            await clonesToken.connect(owner).revokeRole(MINTER_ROLE, minter.address);
            expect(await clonesToken.hasRole(MINTER_ROLE, minter.address)).to.be.false;
        });
    });

    describe("Minting", function () {
        beforeEach(async function () {
            await clonesToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
            // Burn some tokens to allow minting
            await clonesToken.connect(owner).burn(ethers.parseEther("1000000"));
        });

        it("Should allow minter to mint tokens", async function () {
            const mintAmount = ethers.parseEther("1000");
            const initialBalance = await clonesToken.balanceOf(user1.address);

            await clonesToken.connect(minter).mint(user1.address, mintAmount);

            expect(await clonesToken.balanceOf(user1.address)).to.equal(initialBalance + mintAmount);
        });

        it("Should revert minting to zero address", async function () {
            await expect(clonesToken.connect(minter).mint(zeroAddress, ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesToken, "MintToZeroAddress");
        });

        it("Should revert minting to contract address", async function () {
            await expect(clonesToken.connect(minter).mint(await clonesToken.getAddress(), ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesToken, "MintToContractAddress");
        });

        it("Should revert minting zero amount", async function () {
            await expect(clonesToken.connect(minter).mint(user1.address, 0))
                .to.be.revertedWithCustomError(clonesToken, "MintZeroAmount");
        });

        it("Should revert when exceeding max supply", async function () {
            // Try to mint more than available
            const excessAmount = ethers.parseEther("1000001"); // More than burned
            await expect(clonesToken.connect(minter).mint(user1.address, excessAmount))
                .to.be.revertedWithCustomError(clonesToken, "ExceedsMaxSupply");
        });

        it("Should revert when non-minter tries to mint", async function () {
            await expect(clonesToken.connect(user1).mint(user2.address, ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesToken, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, MINTER_ROLE);
        });

        it("Should revert minting when paused", async function () {
            await clonesToken.connect(owner).pause();
            await expect(clonesToken.connect(minter).mint(user1.address, ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesToken, "EnforcedPause");
        });
    });

    describe("Burning", function () {
        beforeEach(async function () {
            // Transfer some tokens to user1 for testing
            await clonesToken.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("Should allow user to burn their tokens", async function () {
            const burnAmount = ethers.parseEther("1000");
            const initialBalance = await clonesToken.balanceOf(user1.address);
            const initialSupply = await clonesToken.totalSupply();

            await clonesToken.connect(user1).burn(burnAmount);

            expect(await clonesToken.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
            expect(await clonesToken.totalSupply()).to.equal(initialSupply - burnAmount);
        });

        it("Should revert burning zero amount", async function () {
            await expect(clonesToken.connect(user1).burn(0))
                .to.be.revertedWithCustomError(clonesToken, "BurnZeroAmount");
        });

        it("Should revert burning more than balance", async function () {
            const userBalance = await clonesToken.balanceOf(user1.address);
            await expect(clonesToken.connect(user1).burn(userBalance + ethers.parseEther("1")))
                .to.be.revertedWithCustomError(clonesToken, "ERC20InsufficientBalance");
        });

        it("Should revert burning when paused", async function () {
            await clonesToken.connect(owner).pause();
            await expect(clonesToken.connect(user1).burn(ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesToken, "EnforcedPause");
        });
    });

    describe("BurnFrom", function () {
        beforeEach(async function () {
            await clonesToken.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("Should allow burning from account with approval", async function () {
            const burnAmount = ethers.parseEther("1000");

            await clonesToken.connect(user1).approve(user2.address, burnAmount);

            const initialBalance = await clonesToken.balanceOf(user1.address);
            const initialSupply = await clonesToken.totalSupply();

            await clonesToken.connect(user2).burnFrom(user1.address, burnAmount);

            expect(await clonesToken.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
            expect(await clonesToken.totalSupply()).to.equal(initialSupply - burnAmount);
        });

        it("Should revert burning from zero address", async function () {
            await expect(clonesToken.connect(user2).burnFrom(zeroAddress, ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesToken, "BurnFromZeroAddress");
        });

        it("Should revert burning zero amount", async function () {
            await expect(clonesToken.connect(user2).burnFrom(user1.address, 0))
                .to.be.revertedWithCustomError(clonesToken, "BurnZeroAmount");
        });

        it("Should revert when allowance insufficient", async function () {
            const burnAmount = ethers.parseEther("1000");
            // No approval given
            await expect(clonesToken.connect(user2).burnFrom(user1.address, burnAmount))
                .to.be.revertedWithCustomError(clonesToken, "BurnAmountExceedsAllowance");
        });
    });

    describe("Pausing", function () {
        beforeEach(async function () {
            await clonesToken.connect(owner).grantRole(PAUSER_ROLE, pauser.address);
        });

        it("Should allow pauser to pause contract", async function () {
            await clonesToken.connect(pauser).pause();
            expect(await clonesToken.paused()).to.be.true;
        });

        it("Should allow pauser to unpause contract", async function () {
            await clonesToken.connect(pauser).pause();
            await clonesToken.connect(pauser).unpause();
            expect(await clonesToken.paused()).to.be.false;
        });

        it("Should revert when non-pauser tries to pause", async function () {
            await expect(clonesToken.connect(user1).pause())
                .to.be.revertedWithCustomError(clonesToken, "AccessControlUnauthorizedAccount")
                .withArgs(user1.address, PAUSER_ROLE);
        });

        it("Should prevent transfers when paused", async function () {
            await clonesToken.connect(pauser).pause();
            await expect(clonesToken.connect(owner).transfer(user1.address, ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(clonesToken, "EnforcedPause");
        });
    });

    describe("ERC20 Functionality", function () {
        beforeEach(async function () {
            await clonesToken.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("Should handle transfers correctly", async function () {
            const transferAmount = ethers.parseEther("1000");

            await clonesToken.connect(user1).transfer(user2.address, transferAmount);

            expect(await clonesToken.balanceOf(user2.address)).to.equal(transferAmount);
        });

        it("Should handle approvals correctly", async function () {
            const approveAmount = ethers.parseEther("1000");

            await clonesToken.connect(user1).approve(user2.address, approveAmount);

            expect(await clonesToken.allowance(user1.address, user2.address)).to.equal(approveAmount);
        });

        it("Should handle transferFrom correctly", async function () {
            const transferAmount = ethers.parseEther("1000");

            await clonesToken.connect(user1).approve(user2.address, transferAmount);
            await clonesToken.connect(user2).transferFrom(user1.address, user2.address, transferAmount);

            expect(await clonesToken.balanceOf(user2.address)).to.equal(transferAmount);
        });
    });

    describe("Interface Support", function () {
        it("Should support ERC20 interface", async function () {
            // ERC165 interface ID for IERC20
            const ERC20_INTERFACE_ID = "0x36372b07";
            // Note: ERC20 implementation doesn't inherently support ERC165
            // This test should check if the token implements the basic ERC20 functions
            expect(await clonesToken.totalSupply()).to.be.greaterThan(0);
            expect(await clonesToken.name()).to.equal("CLONES");
            expect(await clonesToken.symbol()).to.equal("$CLONES");
        });

        it("Should support AccessControl interface", async function () {
            // ERC165 interface ID for AccessControl
            const ACCESS_CONTROL_INTERFACE_ID = "0x7965db0b";
            expect(await clonesToken.supportsInterface(ACCESS_CONTROL_INTERFACE_ID)).to.be.true;
        });
    });
});

// Helper function for access control reverts (legacy - now using custom errors)
function revertedWithAccessControl(account, role) {
    return `AccessControl: account ${account.toLowerCase()} is missing role ${role}`;
}