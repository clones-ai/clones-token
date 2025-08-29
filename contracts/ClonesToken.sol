// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CLONES Token
 * @author Clones Team
 * @notice The native utility token for the Clones ecosystem on Base Sepolia testnet
 * @dev ERC20 implementation with access controls and pausable functionality
 * @custom:security-contact security@clones.com
 * @custom:audit-version 1.0
 */
contract ClonesToken is ERC20, AccessControl, Pausable {
    /// @notice Thrown when trying to initialize with zero address
    error ZeroAddressOwner();
    /// @notice Thrown when trying to mint to zero address
    error MintToZeroAddress();
    /// @notice Thrown when trying to mint to contract address
    error MintToContractAddress();
    /// @notice Thrown when trying to mint zero amount
    error MintZeroAmount();
    /// @notice Thrown when mint would exceed max supply
    error ExceedsMaxSupply();
    /// @notice Thrown when trying to burn zero amount
    error BurnZeroAmount();
    /// @notice Thrown when trying to burn from zero address
    error BurnFromZeroAddress();
    /// @notice Thrown when burn amount exceeds allowance
    error BurnAmountExceedsAllowance();
    /// @notice Role identifier for minting operations
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Role identifier for pausing operations
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Maximum total supply (1 billion tokens with 18 decimals)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    /**
     * @notice Contract constructor
     * @dev Initializes the token with name, symbol, and grants roles to deployer
     * @param initialOwner Address that will receive admin roles and initial supply
     */
    constructor(address initialOwner) ERC20("CLONES", "CLONES") {
        // AUDIT: Input validation - prevent zero address deployment
        if (initialOwner == address(0)) revert ZeroAddressOwner();

        // AUDIT: Role setup - grant all roles to initial owner
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
        _grantRole(PAUSER_ROLE, initialOwner);

        // AUDIT: Initial supply minting - mint full supply to owner
        _mint(initialOwner, MAX_SUPPLY);

        // AUDIT: State verification - ensure total supply equals max supply
        assert(totalSupply() == MAX_SUPPLY);
    }

    /**
     * @notice Mints tokens to a specified address
     * @dev Only accounts with MINTER_ROLE can mint tokens
     * @param to Address to receive the newly minted tokens
     * @param amount Number of tokens to mint (in wei)
     * @custom:audit Critical function - verify access controls and supply limits
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        // AUDIT: Input validation - prevent minting to zero address
        if (to == address(0)) revert MintToZeroAddress();
        if (to == address(this)) revert MintToContractAddress();
        if (amount == 0) revert MintZeroAmount();

        // AUDIT: Supply constraints - prevent exceeding maximum supply
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();

        // AUDIT: State effects - mint tokens
        _mint(to, amount);
    }

    /**
     * @notice Burns tokens from the caller's account
     * @dev Anyone can burn their own tokens to reduce total supply
     * @param amount Number of tokens to burn (in wei)
     */
    function burn(uint256 amount) external whenNotPaused {
        // AUDIT: Input validation - prevent burning zero amount
        if (amount == 0) revert BurnZeroAmount();

        // AUDIT: Balance checks handled by _burn internal function
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burns tokens from a specified account (requires approval)
     * @dev Burns tokens from account using allowance mechanism
     * @param account Account to burn tokens from
     * @param amount Number of tokens to burn (in wei)
     */
    function burnFrom(address account, uint256 amount) external whenNotPaused {
        // AUDIT: Input validation - prevent burning from zero address
        if (account == address(0)) revert BurnFromZeroAddress();
        if (amount == 0) revert BurnZeroAmount();

        // AUDIT: Allowance checks handled by _burnFrom internal function
        uint256 currentAllowance = allowance(account, msg.sender);
        if (currentAllowance < amount) revert BurnAmountExceedsAllowance();

        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
    }

    /**
     * @notice Pauses all token transfers and minting
     * @dev Only accounts with PAUSER_ROLE can pause the contract
     * @custom:audit Emergency function - verify access controls
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses all token transfers and minting
     * @dev Only accounts with PAUSER_ROLE can unpause the contract
     * @custom:audit Emergency function - verify access controls
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Hook called during any token transfer, mint, or burn
     * @dev Implements pausable functionality for all token operations
     * @param from Address tokens are transferred from (zero for minting)
     * @param to Address tokens are transferred to (zero for burning)
     * @param value Number of tokens being transferred
     */
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        super._update(from, to, value);
    }

    /**
     * @notice Checks if contract supports a given interface
     * @dev Required override for AccessControl + ERC20 compatibility
     * @param interfaceId Interface identifier to check
     * @return bool True if interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
