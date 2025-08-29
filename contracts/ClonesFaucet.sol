// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IClonesFaucet} from "./interfaces/IClonesFaucet.sol";

/**
 * @title Clones Token Faucet
 * @author Clones Team
 * @notice A secure faucet contract for distributing CLONES tokens on Base Sepolia testnet
 * @dev Implements rate limiting, access controls, and emergency controls for security
 * @custom:security-contact security@clones.com
 * @custom:audit-version 1.0
 */
contract ClonesFaucet is IClonesFaucet, AccessControl, ReentrancyGuard, Pausable {
    /// @notice Custom errors for gas optimization
    error ZeroTokenAddress();
    error ZeroOwnerAddress();
    error ZeroClaimAmount();
    error ZeroClaimInterval();
    error DailyLimitTooLow();
    error NoContractCalls();
    error ClaimTooSoon();
    error DailyLimitExceeded();
    error InsufficientFaucetBalance();
    error ZeroAddressCheck();
    error ZeroWithdrawAmount();
    error InsufficientBalance();
    error CannotRecoverFaucetTokens();
    error ZeroRecoveryAmount();
    using SafeERC20 for IERC20;

    /// @notice Role identifier for administrative operations
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role identifier for pausing operations
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice The CLONES token contract
    IERC20 public immutable CLONES_TOKEN;

    /// @notice Returns the CLONES token contract address
    /// @return The address of the CLONES token contract
    function getClonesTokenAddress() external view returns (address) {
        return address(CLONES_TOKEN);
    }

    /// @notice Amount of tokens distributed per claim (1000 CLONES with 18 decimals)
    uint256 public claimAmount;

    /// @notice Time interval between claims for the same address (24 hours)
    uint256 public claimInterval;

    /// @notice Maximum number of tokens that can be distributed daily
    uint256 public dailyDistributionLimit;

    /// @notice Current day's distribution counter
    uint256 public currentDayDistribution;

    /// @notice Timestamp of the current day (for daily limit reset)
    uint256 public currentDay;

    /// @notice Mapping of address to their last claim timestamp
    mapping(address => uint256) public lastClaimTime;

    /// @notice Total tokens distributed by the faucet
    uint256 public totalDistributed;

    // Events are defined in the IClonesFaucet interface

    /**
     * @notice Contract constructor
     * @dev Initializes the faucet with token address and default parameters
     * @param clonesToken Address of the CLONES token contract
     * @param owner Address that will receive admin roles
     * @param initialClaimAmount Initial amount per claim (in wei)
     * @param initialClaimInterval Initial time between claims (in seconds)
     * @param initialDailyLimit Initial daily distribution limit (in wei)
     */
    constructor(
        address clonesToken,
        address owner,
        uint256 initialClaimAmount,
        uint256 initialClaimInterval,
        uint256 initialDailyLimit
    ) {
        // AUDIT: Input validation - prevent zero address deployment
        if (clonesToken == address(0)) revert ZeroTokenAddress();
        if (owner == address(0)) revert ZeroOwnerAddress();
        if (initialClaimAmount == 0) revert ZeroClaimAmount();
        if (initialClaimInterval == 0) revert ZeroClaimInterval();
        if (initialDailyLimit < initialClaimAmount) revert DailyLimitTooLow();

        CLONES_TOKEN = IERC20(clonesToken);

        // AUDIT: Role setup - grant roles to owner
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(ADMIN_ROLE, owner);
        _grantRole(PAUSER_ROLE, owner);

        // AUDIT: Initialize parameters with validation
        claimAmount = initialClaimAmount;
        claimInterval = initialClaimInterval;
        dailyDistributionLimit = initialDailyLimit;
        currentDay = block.timestamp / 1 days; // Current day identifier

        emit FaucetConfigured(initialClaimAmount, initialClaimInterval, initialDailyLimit);
    }

    /**
     * @notice Claims tokens from the faucet
     * @dev Implements checks-effects-interactions pattern for security
     * @custom:audit Critical function - verify rate limiting and access controls
     */
    function claimTokens() external nonReentrant whenNotPaused {
        // AUDIT: Input validation - prevent contract calls (basic EOA check)
        if (msg.sender.code.length != 0) revert NoContractCalls();

        // AUDIT: Rate limiting - check claim interval
        uint256 timeSinceLastClaim = block.timestamp - lastClaimTime[msg.sender];
        if (timeSinceLastClaim < claimInterval) revert ClaimTooSoon();

        // AUDIT: Daily limit checks - reset if new day
        uint256 today = block.timestamp / 1 days;
        if (today > currentDay) {
            currentDay = today;
            currentDayDistribution = 0;
        }

        // AUDIT: Daily limit validation
        if (currentDayDistribution + claimAmount > dailyDistributionLimit) revert DailyLimitExceeded();

        // AUDIT: Balance validation - ensure faucet has enough tokens
        if (CLONES_TOKEN.balanceOf(address(this)) < claimAmount) revert InsufficientFaucetBalance();

        // AUDIT: Effects - update state before interactions
        lastClaimTime[msg.sender] = block.timestamp;
        currentDayDistribution += claimAmount;
        totalDistributed += claimAmount;

        // AUDIT: Interactions - transfer tokens using SafeERC20
        CLONES_TOKEN.safeTransfer(msg.sender, claimAmount);

        emit TokensClaimed(msg.sender, claimAmount, block.timestamp);

        // AUDIT: Check if daily limit is reached
        if (currentDayDistribution >= dailyDistributionLimit) {
            emit DailyLimitReached(currentDay, currentDayDistribution);
        }
    }

    /**
     * @notice Checks if an address can claim tokens
     * @dev View function to check claim eligibility
     * @param claimer Address to check
     * @return canClaimTokens True if address can claim tokens
     * @return timeUntilNextClaim Seconds until next claim is possible
     */
    function canClaim(address claimer) external view returns (bool canClaimTokens, uint256 timeUntilNextClaim) {
        // AUDIT: Input validation
        if (claimer == address(0)) revert ZeroAddressCheck();

        uint256 timeSinceLastClaim = block.timestamp - lastClaimTime[claimer];

        if (timeSinceLastClaim >= claimInterval) {
            // Check daily limit
            uint256 today = block.timestamp / 1 days;
            uint256 todayDistribution = (today > currentDay) ? 0 : currentDayDistribution;

            canClaimTokens =
                (todayDistribution + claimAmount <= dailyDistributionLimit) &&
                (CLONES_TOKEN.balanceOf(address(this)) >= claimAmount) &&
                !paused();
            timeUntilNextClaim = 0;
        } else {
            canClaimTokens = false;
            timeUntilNextClaim = claimInterval - timeSinceLastClaim;
        }
    }

    /**
     * @notice Updates faucet configuration parameters
     * @dev Only accounts with ADMIN_ROLE can update configuration
     * @param newClaimAmount New amount per claim (in wei)
     * @param newClaimInterval New time between claims (in seconds)
     * @param newDailyLimit New daily distribution limit (in wei)
     * @custom:audit Administrative function - verify access controls
     */
    function configureFaucet(
        uint256 newClaimAmount,
        uint256 newClaimInterval,
        uint256 newDailyLimit
    ) external onlyRole(ADMIN_ROLE) {
        // AUDIT: Input validation
        if (newClaimAmount == 0) revert ZeroClaimAmount();
        if (newClaimInterval == 0) revert ZeroClaimInterval();
        if (newDailyLimit < newClaimAmount) revert DailyLimitTooLow();

        claimAmount = newClaimAmount;
        claimInterval = newClaimInterval;
        dailyDistributionLimit = newDailyLimit;

        emit FaucetConfigured(newClaimAmount, newClaimInterval, newDailyLimit);
    }

    /**
     * @notice Withdraws tokens from the faucet
     * @dev Only accounts with ADMIN_ROLE can withdraw tokens
     * @param amount Amount of tokens to withdraw (in wei)
     * @custom:audit Administrative function - verify access controls and effects
     */
    function withdrawTokens(uint256 amount) external onlyRole(ADMIN_ROLE) {
        // AUDIT: Input validation
        if (amount == 0) revert ZeroWithdrawAmount();
        if (CLONES_TOKEN.balanceOf(address(this)) < amount) revert InsufficientBalance();

        // AUDIT: Safe transfer to admin
        CLONES_TOKEN.safeTransfer(msg.sender, amount);

        emit TokensWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Returns the current faucet balance
     * @dev View function for faucet token balance
     * @return balance Current token balance of the faucet
     */
    function getFaucetBalance() external view returns (uint256 balance) {
        return CLONES_TOKEN.balanceOf(address(this));
    }

    /**
     * @notice Returns the current daily distribution status
     * @dev View function for daily distribution tracking
     * @return currentDistribution Amount distributed today
     * @return remainingDistribution Amount remaining for today
     * @return dayIdentifier Current day identifier
     */
    function getDailyDistributionStatus()
        external
        view
        returns (uint256 currentDistribution, uint256 remainingDistribution, uint256 dayIdentifier)
    {
        uint256 today = block.timestamp / 1 days;
        currentDistribution = (today > currentDay) ? 0 : currentDayDistribution;
        remainingDistribution = dailyDistributionLimit - currentDistribution;
        dayIdentifier = today;
    }

    /**
     * @notice Pauses the faucet operations
     * @dev Only accounts with PAUSER_ROLE can pause
     * @custom:audit Emergency function - verify access controls
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the faucet operations
     * @dev Only accounts with PAUSER_ROLE can unpause
     * @custom:audit Emergency function - verify access controls
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency function to recover accidentally sent tokens
     * @dev Only DEFAULT_ADMIN_ROLE can recover tokens
     * @param token Token contract address to recover
     * @param amount Amount to recover
     * @custom:audit Emergency function - verify this cannot drain faucet tokens
     */
    function emergencyRecoverTokens(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // AUDIT: Prevent draining of faucet tokens through this function
        if (token == address(CLONES_TOKEN)) revert CannotRecoverFaucetTokens();
        if (token == address(0)) revert ZeroTokenAddress();
        if (amount == 0) revert ZeroRecoveryAmount();

        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
