# Deployment Guide

## Prerequisites
1. Install dependencies: `npm install`
2. Create `.env` file with your private key:
   ```
   BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
   PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
   ```
3. Get BNB test tokens from [faucet](https://testnet.binance.org/faucet-smart)

## Deploy to BSC Testnet

```bash
npx hardhat run --network bscTestnet scripts/deploy.js
```

After deployment, you'll see:
- 📍 TestToken Address
- 📍 Staking Address

Save these addresses for testing.

## Testing on Testnet

1. **Mint Test Tokens**: Call `faucet()` on TestToken contract (mints 1000 tokens)
2. **Approve Staking**: Approve Staking contract to spend your tokens
3. **Stake**: Call `deposit(amount, referrer)` or `deposit(amount)`
4. **Wait 24h** or simulate time on testnet
5. **Claim**: Call `claim()` to receive 1% daily ROI
6. **Unstake**: Call `unstake()` to withdraw principal + rewards

## Verify on BSCScan Testnet

Visit: https://testnet.bscscan.com and verify your contracts.

