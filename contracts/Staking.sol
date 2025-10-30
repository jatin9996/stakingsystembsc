// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Staking
 * @dev Staking contract with 1% daily ROI and referral rewards
 */
contract Staking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    IERC20 public stakingToken;

    // Constants
    uint256 public constant RATE_PRECISION = 10000; // 100% = 10000 (basis points)
    uint256 public constant DAILY_ROI_BP = 100; // 1% = 100 basis points
    uint256 public constant REFERRAL_REWARD_BP = 50; // 0.5% = 50 basis points
    uint256 public constant SECONDS_PER_DAY = 86400; // 24 hours

    // Structs
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
        uint256 totalClaimed;
    }

    // Mappings
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public referralRewards;

    // State variables
    uint256 public totalStaked;
    uint256 public totalRewardsDistributed;

    // Events
    event Staked(address indexed user, uint256 amount, address indexed referrer, uint256 referralReward);
    event Claimed(address indexed user, uint256 reward);
    event Unstaked(address indexed user, uint256 amount, uint256 totalReward);
    event ReferralRewardPaid(address indexed referrer, address indexed referee, uint256 amount);
    event RewardPoolFunded(address indexed funder, uint256 amount);
    event TokensRescued(address indexed token, uint256 amount);

    /**
     * @dev Constructor
     * @param _stakingToken Address of the ERC-20 token to stake
     */
    constructor(address _stakingToken) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Staking: Invalid token address");
        stakingToken = IERC20(_stakingToken);
    }

    /**
     * @dev Internal deposit logic
     */
    function _doDeposit(uint256 amount, address referrer) internal {
        require(amount > 0, "Staking: Amount must be greater than 0");
        require(stakes[msg.sender].amount == 0, "Staking: Already staking, unstake first");

        // Transfer tokens from user
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Initialize stake
        stakes[msg.sender] = StakeInfo({
            amount: amount,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            totalClaimed: 0
        });

        totalStaked += amount;

        // Handle referral reward
        uint256 referralReward = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            referralReward = (amount * REFERRAL_REWARD_BP) / RATE_PRECISION;
            
            // Add to referrer's rewards
            referralRewards[referrer] += referralReward;
            
            // Transfer referral reward instantly
            stakingToken.safeTransfer(referrer, referralReward);
            emit ReferralRewardPaid(referrer, msg.sender, referralReward);
        }
        emit Staked(msg.sender, amount, referrer, referralReward);
    }

    /**
     * @dev Deposit tokens to stake with referrer
     * @param amount Amount of tokens to stake
     * @param referrer Address of the referrer
     */
    function deposit(uint256 amount, address referrer) external nonReentrant {
        _doDeposit(amount, referrer);
    }

    /**
     * @dev Deposit without referral
     */
    function deposit(uint256 amount) external nonReentrant {
        _doDeposit(amount, address(0));
    }

    /**
     * @dev Claim accumulated rewards (once per 24 hours)
     */
    function claim() external nonReentrant {
        require(stakes[msg.sender].amount > 0, "Staking: No stake found");
        
        uint256 rewards = calculateRewards(msg.sender);
        require(rewards > 0, "Staking: No rewards to claim");

        // Check time restriction (24 hours)
        require(
            block.timestamp >= stakes[msg.sender].lastClaimTime + SECONDS_PER_DAY,
            "Staking: Can only claim once every 24 hours"
        );

        // Update last claim time
        stakes[msg.sender].lastClaimTime = block.timestamp;
        stakes[msg.sender].totalClaimed += rewards;

        totalRewardsDistributed += rewards;

        // Transfer rewards
        stakingToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards);
    }

    /**
     * @dev Unstake tokens and claim pending rewards
     */
    function unstake() external nonReentrant {
        require(stakes[msg.sender].amount > 0, "Staking: No stake found");

        uint256 stakedAmount = stakes[msg.sender].amount;
        uint256 pendingRewards = calculateRewards(msg.sender);
        uint256 totalAmount = stakedAmount + pendingRewards;

        // Reset stake
        delete stakes[msg.sender];
        totalStaked -= stakedAmount;

        if (pendingRewards > 0) {
            totalRewardsDistributed += pendingRewards;
        }

        // Transfer principal + rewards
        stakingToken.safeTransfer(msg.sender, totalAmount);

        emit Unstaked(msg.sender, stakedAmount, pendingRewards);
    }

    /**
     * @dev Calculate rewards for a staker
     * @param user Address of the staker
     * @return Total rewards accumulated
     */
    function calculateRewards(address user) public view returns (uint256) {
        if (stakes[user].amount == 0) {
            return 0;
        }

        // Calculate time difference in days (integer division)
        uint256 timeDiff = block.timestamp - stakes[user].lastClaimTime;
        uint256 daysStaked = timeDiff / SECONDS_PER_DAY;

        // Calculate rewards: 1% per day
        uint256 rewards = (stakes[user].amount * DAILY_ROI_BP * daysStaked) / RATE_PRECISION;

        return rewards;
    }

    /**
     * @dev View function to get all stake info
     * @param user Address of the staker
     */
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 lastClaimTime,
        uint256 totalClaimed,
        uint256 pendingRewards
    ) {
        StakeInfo memory stake = stakes[user];
        return (
            stake.amount,
            stake.startTime,
            stake.lastClaimTime,
            stake.totalClaimed,
            calculateRewards(user)
        );
    }

    /**
     * @dev Owner function to fund the reward pool
     * @param amount Amount of tokens to add to the pool
     */
    function fund(uint256 amount) external onlyOwner {
        require(amount > 0, "Staking: Amount must be greater than 0");
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit RewardPoolFunded(msg.sender, amount);
    }

    /**
     * @dev Owner function to rescue stuck tokens
     * @param token Address of the token to rescue
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(stakingToken), "Staking: Cannot rescue staking token");
        
        IERC20(token).safeTransfer(owner(), amount);
        emit TokensRescued(token, amount);
    }

    /**
     * @dev Emergency function to rescue ETH if any is sent
     */
    receive() external payable {
        // ETH sent to contract is locked unless rescued via rescueTokens
    }
}

