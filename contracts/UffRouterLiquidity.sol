pragma solidity =0.6.6;

import './interfaces/IUffFactory.sol';
import './libraries/TransferHelper.sol';

import './interfaces/IUffRouterLiquidity.sol';
import './libraries/UffLibrary.sol';
import './libraries/SafeMath.sol';
import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';

contract UffRouterLiquidity is IUffRouterLiquidity {
    using SafeMath for uint;

    address public immutable override factory;
    address public immutable override WETH;

    // UFF MOD - ADD SPAMLIST MAP 
    mapping(address=>bool) isSpamListed;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'UFF ROUTER: EXP');
        _;
    }

    constructor(address _factory, address _WETH) public {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }

    // UFF MOD - ADD SPAMLIST UTILS
    function spamList(address _token) public {
        require(IUffFactory(factory).feeToSetter() == msg.sender, 'UFF ROUTER: ONLY FEE TO SETTER');
        require(!isSpamListed[_token], "UFF ROUTER: ALREADY SPAMLISTED");
        isSpamListed[_token] = true;
    }

    function removeFromSpamlist(address _token) public {
        require(IUffFactory(factory).feeToSetter() == msg.sender, 'UFF ROUTER: ONLY FEE TO SETTER');
        require(isSpamListed[_token], "UFF ROUTER: ALREADY UNLISTED");
        isSpamListed[_token] = false;
    }

    function spamListed(address _token) public view returns (bool) {
        return isSpamListed[_token];
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal virtual returns (uint amountA, uint amountB) {

        // UFF MOD - SPAMLIST CHECK TOKEN A & TOKEN B
        if (msg.sender != IUffFactory(factory).feeToSetter()) {
            require(!isSpamListed[tokenA], "UFF ROUTER: TOKEN ADDR SPAMLISTED");
            require(!isSpamListed[tokenB], "UFF ROUTER: TOKEN ADDR SPAMLISTED");
        }

        // UFF MOD - REVERT IF PAIR DOES NOT EXIST
        require(IUffFactory(factory).getPair(tokenA, tokenB) != address(0), "UFF ROUTER: PAIR NOT CREATED YET");

        (uint reserveA, uint reserveB) = UffLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = UffLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'UFF ROUTER: INSUFF_B_AMNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = UffLibrary.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'UFF ROUTER: INSUFF_A_AMNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = UffLibrary.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IUffPair(pair).mint(to);
    }
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external virtual override payable ensure(deadline) returns (uint amountToken, uint amountETH, uint liquidity) {
        (amountToken, amountETH) = _addLiquidity(
            token,
            WETH,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );
        address pair = UffLibrary.pairFor(factory, token, WETH);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWETH(WETH).deposit{value: amountETH}();
        assert(IWETH(WETH).transfer(pair, amountETH));
        liquidity = IUffPair(pair).mint(to);
        // refund dust eth, if any
        if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    }

    // UFF MOD - ADD LIQUIDITY WITHOUT FEES (UFF & PARTNER PROJECTS)
    function addLiquidityFree(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = UffLibrary.pairFor(factory, tokenA, tokenB);

        // UFF MOD - TRANSFER FROM AND TO LIQUIDITY ROUTER
        TransferHelper.safeTransferFrom(tokenA, msg.sender, address(this), amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, address(this), amountB);

        TransferHelper.safeTransfer(tokenA, pair, amountA);
        TransferHelper.safeTransfer(tokenB, pair, amountB);

        liquidity = IUffPair(pair).mint(to);
    }
    function addLiquidityETHFree(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external virtual override payable ensure(deadline) returns (uint amountToken, uint amountETH, uint liquidity) {
        (amountToken, amountETH) = _addLiquidity(
            token,
            WETH,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );
        address pair = UffLibrary.pairFor(factory, token, WETH);

        // UFF MOD - TRANSFER FROM AND TO LIQUIDITY ROUTER
        TransferHelper.safeTransferFrom(token, msg.sender, address(this), amountToken);
        TransferHelper.safeTransfer(token, pair, amountToken);

        IWETH(WETH).deposit{value: amountETH}();
        assert(IWETH(WETH).transfer(pair, amountETH));
        liquidity = IUffPair(pair).mint(to);
        // refund dust eth, if any
        if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {

        // UFF MOD - SPAMLIST CHECK TOKEN A & TOKEN B
        if (msg.sender != IUffFactory(factory).feeToSetter()) {
            require(!isSpamListed[tokenA], "UFF ROUTER: TOKEN A ADDR SPAMLISTED");
            require(!isSpamListed[tokenB], "UFF ROUTER: TOKEN B ADDR SPAMLISTED");
        }

        address pair = UffLibrary.pairFor(factory, tokenA, tokenB);
        IUffPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        (uint amount0, uint amount1) = IUffPair(pair).burn(to);
        (address token0,) = UffLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, 'UFF ROUTER: INSUFF_A_AMNT');
        require(amountB >= amountBMin, 'UFF ROUTER: INSUFF_B_AMNT');
    }
    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountToken, uint amountETH) {

        (amountToken, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );

        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }
    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountA, uint amountB) {
        address pair = UffLibrary.pairFor(factory, tokenA, tokenB);
        uint value = approveMax ? uint(-1) : liquidity;
        IUffPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountA, amountB) = removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);
    }
    function removeLiquidityETHWithPermit(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountToken, uint amountETH) {
        address pair = UffLibrary.pairFor(factory, token, WETH);
        uint value = approveMax ? uint(-1) : liquidity;
        IUffPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountToken, amountETH) = removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, to, deadline);

        // UFF MOD - WITH BNB FROM WBNB
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    // **** REMOVE LIQUIDITY (supporting fee-on-transfer tokens) ****
    function removeLiquidityETHSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountETH) {

        // UFF MOD - TOKENS SENT DIRECTLY TO USER
        (, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );

        // UFF MOD - WITHDRAW BNB AFTER REMOVE LIQ
        IWETH(WETH).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }
    function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountETH) {
        address pair = UffLibrary.pairFor(factory, token, WETH);
        uint value = approveMax ? uint(-1) : liquidity;
        IUffPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        amountETH = removeLiquidityETHSupportingFeeOnTransferTokens(
            token, liquidity, amountTokenMin, amountETHMin, to, deadline
        );
    }

    // **** LIBRARY FUNCTIONS ****
    function quote(uint amountA, uint reserveA, uint reserveB) public pure virtual override returns (uint amountB) {
        return UffLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut)
        public
        pure
        virtual
        override
        returns (uint amountOut)
    {
        return UffLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut)
        public
        pure
        virtual
        override
        returns (uint amountIn)
    {
        return UffLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(uint amountIn, address[] memory path)
        public
        view
        virtual
        override
        returns (uint[] memory amounts)
    {
        return UffLibrary.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint amountOut, address[] memory path)
        public
        view
        virtual
        override
        returns (uint[] memory amounts)
    {
        return UffLibrary.getAmountsIn(factory, amountOut, path);
    }

    // function pairFor(address tokenA, address tokenB) public view returns (address pair) {
    //     pair = UffLibrary.pairFor(factory, tokenA, tokenB);
    // }
}