// SPDX-License-Identifier: MIT

pragma solidity 0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";

import './interfaces/IBEP20.sol';
import './libraries/SafeBEP20.sol';

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./GoldenGrainToken.sol";

// MasterChef is the master of GGRAIN. He can make GGRAIN and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once GGRAIN is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MasterGGrain is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;         // How many LP tokens the user has provided.
        uint256 rewardDebt;     // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of GGRAINs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accGGRAINPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accGGRAINPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IBEP20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. GGRAIN to distribute per block.
        uint256 lastRewardBlock;  // Last block number that GGRAIN distribution occurs.
        uint256 accGGrainPerShare;   // Accumulated GGRAIN per share, times 1e12. See below.
        uint16 withdrawFeeBP;      // Withdraw fee in basis points
    }

    // The GGRAIN TOKEN!
    GoldenGrainToken public ggrain;
    // GGRAIN tokens created per block.
    uint256 public ggrainPerBlock;
    // Bonus muliplier for early GGRAIN makers.
    uint256 public constant BONUS_MULTIPLIER = 1;
    // Deposit Fee address / Dev Address and BuyBack Wallet
    address public feeAddDev;
    address public feeAddBb;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when GGRAIN mining starts.
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmissionRateUpdated(address indexed user, uint256 ggrainPerBlock);

    constructor(
        GoldenGrainToken _ggrain,
        address _feeAddDev,
        address _feeAddBb,
        uint256 _ggrainPerBlock,
        uint256 _startBlock
    ) public {
        ggrain = _ggrain;
        feeAddDev = _feeAddDev;
        feeAddBb = _feeAddBb;
        ggrainPerBlock = _ggrainPerBlock;
        startBlock = _startBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    mapping(IBEP20 => bool) public poolExistence;

    modifier nonDuplicated(IBEP20 _lpToken) {
        require(poolExistence[_lpToken] == false, "nonDuplicated: duplicated");
        _;
    }

    modifier poolExists(uint256 pid) {
        require(pid < poolInfo.length, "pool inexistent");
        _;
    }

    modifier lpProtection(uint256 pid, uint256 _amount) {
        PoolInfo storage pool = poolInfo[pid];
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        uint256 maxWithdraw = lpSupply.mul(1500).div(10000);
        require(_amount < maxWithdraw, "withdraw: _amount is higher than maximum LP withdraw");
        _;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    function add(uint256 _allocPoint, IBEP20 _lpToken, uint16 _withdrawFeeBP, bool _withUpdate) public onlyOwner nonDuplicated(_lpToken) {
        require(_withdrawFeeBP <= 1200, "add: invalid deposit fee basis points");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolExistence[_lpToken] = true;
        poolInfo.push(PoolInfo({
            lpToken : _lpToken,
            allocPoint : _allocPoint,
            lastRewardBlock : lastRewardBlock,
            accGGrainPerShare : 0,
            withdrawFeeBP : _withdrawFeeBP
        }));
    }

    // Update the given pool's GGRAIN allocation point and deposit fee. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, uint16 _withdrawFeeBP, bool _withUpdate) public onlyOwner poolExists(_pid) {
        require(_withdrawFeeBP <= 1200, "set: invalid deposit fee basis points");
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].withdrawFeeBP = _withdrawFeeBP;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return _to.sub(_from).mul(BONUS_MULTIPLIER);
    }

    // View function to see pending GGRAINs on frontend.
    function pendingGGrain(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accGGrainPerShare = pool.accGGrainPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 ggrainReward = multiplier.mul(ggrainPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accGGrainPerShare = accGGrainPerShare.add(ggrainReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accGGrainPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0 || pool.allocPoint == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 ggrainReward = multiplier.mul(ggrainPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        ggrain.mint(feeAddDev, ggrainReward.mul(1500).div(10000));
        ggrain.mint(address(this), ggrainReward);
        pool.accGGrainPerShare = pool.accGGrainPerShare.add(ggrainReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for GGRAIN allocation.
    function deposit(uint256 _pid, uint256 _amount) public nonReentrant poolExists(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);

        // Try to harvest
        if (user.amount > 0) {
            harvest(_pid);
        }

        // Thanks for RugDoc advice
        // Add user.amount
        if (_amount > 0) {
            // LP ammount before
            uint256 before = pool.lpToken.balanceOf(address(this));
            // Transafer from user
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            // LP ammount after
            uint256 _after = pool.lpToken.balanceOf(address(this));
            // Real amount of LP transfer to this address
            _amount = _after.sub(before);
            user.amount = user.amount.add(_amount);
        }

        // Update user reward debt and emit Deposit
        user.rewardDebt = user.amount.mul(pool.accGGrainPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant poolExists(_pid) lpProtection(_pid, _amount){
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: Amount to withdraw higher than LP balance.");
        updatePool(_pid);
        
        // Harvest before withdraw
        harvest(_pid);

        // Withdraw procedure
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            // Remove fee 
            if (pool.withdrawFeeBP > 0) {
                uint256 withdrawFee = _amount.mul(pool.withdrawFeeBP).div(10000);
                uint256 withdrawFeeHalf = withdrawFee.div(2);
                pool.lpToken.safeTransfer(feeAddDev, withdrawFeeHalf);
                pool.lpToken.safeTransfer(feeAddBb, withdrawFeeHalf);
                _amount = _amount.sub(withdrawFee);
                pool.lpToken.safeTransfer(address(msg.sender), _amount);
            }
        }

        user.rewardDebt = user.amount.mul(pool.accGGrainPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Safe GGRAIN transfer function, just in case if rounding error causes pool to not have enough GGRAINs.
    function safeGGrainTransfer(address _to, uint256 _amount) internal {
        uint256 ggrainBal = ggrain.balanceOf(address(this));
        bool transferSuccess = false;
        if (_amount > ggrainBal) {
            transferSuccess = ggrain.transfer(_to, ggrainBal);
        } else {
            transferSuccess = ggrain.transfer(_to, _amount);
        }
        require(transferSuccess, "safeGGrainTransfer: transfer failed");
    }

    // Harvest GGRAINs.
    function harvest(uint256 _pid) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 pending = user.amount.mul(pool.accGGrainPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0) {
            // send rewards
            safeGGrainTransfer(msg.sender, pending);
        }
    }

    // Pancake has to add hidden dummy pools in order to alter the emission, here we make it simple and transparent to all.
    function updateEmissionRate(uint256 _ggrainPerBlock) public onlyOwner {
        massUpdatePools();
        emit EmissionRateUpdated(msg.sender, _ggrainPerBlock);
        ggrainPerBlock = _ggrainPerBlock;
    }

    // token maintenance ?
    function updateGGRAINOwner(address newOwner) public onlyOwner {
        ggrain.transferOwnership(newOwner);
    }
}