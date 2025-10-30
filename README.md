# BSC Staking Assignment

A decentralized staking platform on Binance Smart Chain (BSC) Testnet with referral rewards and daily ROI.

## Features

- ✅ Stake any BEP-20 token
- ✅ 1% ROI per 24 hours
- ✅ Instant referral rewards (0.5% of deposit)
- ✅ One claim per 24 hours per user
- ✅ Secure token management
- ✅ Owner can fund reward pool

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MetaMask or compatible wallet
- BSC Testnet BNB for gas fees

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd bsc-staking-assignment
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

## Testing

Run the test suite:
```bash
npx hardhat test
```

## Deployment

### Deploy to BSC Testnet

```bash
npx hardhat run --network bscTestnet scripts/deploy.js
```

The script will:
1. Deploy TestToken contract
2. Deploy Staking contract
3. Fund the staking pool with initial rewards
4. Mint test tokens to deployer

### Record the addresses

After deployment, save the contract addresses:
- TestToken contract address
- Staking contract address

## Usage

### 1. Mint Test Tokens

```javascript
// Using MetaMask or your preferred web3 interface
await testToken.faucet(); // Mint 1000 tokens to your address
```

### 2. Approve Staking Contract

```javascript
await testToken.approve(stakingAddress, amount);
```

### 3. Stake Tokens

```javascript
// Without referral
await staking.deposit(amount);

// With referral
await staking.deposit(amount, referrerAddress);
```

### 4. Claim Rewards (after 24 hours)

```javascript
await staking.claim();
```

### 5. Unstake

```javascript
await staking.unstake();
```

## Contract Details

### TestToken.sol
- Simple BEP-20 token (ERC-20 compatible)
- Faucet function for testing
- Transfer and approval functions

### Staking.sol
- **ROI**: 1% per 24 hours (integer-based)
- **Referral Reward**: 0.5% of deposit paid instantly to referrer
- **Claim Limit**: Once per 24 hours per user
- **Owner Functions**: Fund pool, rescue tokens

## Test Coverage

All tests pass successfully:
- ✅ Token minting and faucet
- ✅ Staking deposits
- ✅ Reward calculation
- ✅ Claim after 24 hours
- ✅ Unstake with rewards
- ✅ Referral rewards
- ✅ Time restrictions

## Security

- Only owner can fund pool or rescue tokens
- Timelock for claims (24h)
- Safe Math operations
- Access control

## License

MIT

