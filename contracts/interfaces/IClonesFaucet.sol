// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IClonesFaucet
 * @author Clones Team
 * @notice Interface for the Clones Token Faucet contract
 * @dev Defines the external functions and events for the faucet
 */
interface IClonesFaucet {
    /// @notice Emitted when tokens are successfully claimed
    /// @param claimer Address that claimed tokens
    /// @param amount Amount of tokens claimed
    /// @param timestamp Block timestamp of the claim
    event TokensClaimed(address indexed claimer, uint256 indexed amount, uint256 indexed timestamp);

    /// @notice Emitted when faucet parameters are updated
    /// @param claimAmount New claim amount per transaction
    /// @param claimInterval New time interval between claims
    /// @param dailyLimit New daily distribution limit
    event FaucetConfigured(uint256 indexed claimAmount, uint256 indexed claimInterval, uint256 indexed dailyLimit);

    /// @notice Emitted when tokens are withdrawn from faucet
    /// @param admin Address that withdrew tokens
    /// @param amount Amount of tokens withdrawn
    event TokensWithdrawn(address indexed admin, uint256 indexed amount);

    /// @notice Emitted when daily distribution limit is reached
    /// @param day Day identifier when limit was reached
    /// @param totalDistributed Total amount distributed that day
    event DailyLimitReached(uint256 indexed day, uint256 indexed totalDistributed);

    /// @notice Claims tokens from the faucet
    function claimTokens() external;

    /// @notice Checks if an address can claim tokens
    /// @param claimer Address to check
    /// @return canClaimTokens True if address can claim tokens
    /// @return timeUntilNextClaim Seconds until next claim is possible
    function canClaim(address claimer) external view returns (bool canClaimTokens, uint256 timeUntilNextClaim);

    /// @notice Updates faucet configuration parameters
    /// @param newClaimAmount New amount per claim (in wei)
    /// @param newClaimInterval New time between claims (in seconds)
    /// @param newDailyLimit New daily distribution limit (in wei)
    function configureFaucet(uint256 newClaimAmount, uint256 newClaimInterval, uint256 newDailyLimit) external;

    /// @notice Withdraws tokens from the faucet
    /// @param amount Amount of tokens to withdraw (in wei)
    function withdrawTokens(uint256 amount) external;

    /// @notice Returns the current faucet balance
    /// @return balance Current token balance of the faucet
    function getFaucetBalance() external view returns (uint256 balance);

    /// @notice Returns the current daily distribution status
    /// @return currentDistribution Amount distributed today
    /// @return remainingDistribution Amount remaining for today
    /// @return dayIdentifier Current day identifier
    function getDailyDistributionStatus()
        external
        view
        returns (uint256 currentDistribution, uint256 remainingDistribution, uint256 dayIdentifier);

    /// @notice Pauses the faucet operations
    function pause() external;

    /// @notice Unpauses the faucet operations
    function unpause() external;

    /// @notice Emergency function to recover accidentally sent tokens
    /// @param token Token contract address to recover
    /// @param amount Amount to recover
    function emergencyRecoverTokens(address token, uint256 amount) external;

    /// @notice Returns the claim amount per transaction
    /// @return The amount of tokens distributed per claim
    function claimAmount() external view returns (uint256);

    /// @notice Returns the time interval between claims
    /// @return The time interval in seconds
    function claimInterval() external view returns (uint256);

    /// @notice Returns the daily distribution limit
    /// @return The maximum tokens that can be distributed per day
    function dailyDistributionLimit() external view returns (uint256);

    /// @notice Returns the total tokens distributed by the faucet
    /// @return The total amount of tokens distributed
    function totalDistributed() external view returns (uint256);

    /// @notice Returns the last claim time for an address
    /// @param claimer The address to check
    /// @return The timestamp of the last claim
    function lastClaimTime(address claimer) external view returns (uint256);
}
