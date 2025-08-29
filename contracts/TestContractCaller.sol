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
