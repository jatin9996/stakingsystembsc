// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestToken
 * @dev Simple BEP-20/ERC-20 token with faucet function for testing purposes
 */
contract TestToken is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1000 * 10**18; // 1000 tokens per faucet call

    /**
     * @dev Constructor that mints initial supply to deployer
     */
    constructor() ERC20("Test Token", "TEST") {
        _mint(msg.sender, 1000000 * 10**18); // Mint 1M tokens to deployer
    }

    /**
     * @dev Faucet function to mint tokens for testing
     * Anyone can call this to receive 1000 test tokens
     */
    function faucet() public {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /**
     * @dev Mint function for owner/authorized addresses
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) public {
        // In a production environment, you'd add access control here
        _mint(to, amount);
    }

    /**
     * @dev Override decimals to use 18 decimals (BEP-20 standard)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

