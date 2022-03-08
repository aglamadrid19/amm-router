pragma solidity =0.6.6;

import './interfaces/IUffFactory.sol';
import './libraries/TransferHelper.sol';

import './interfaces/IUffRouterSwap.sol';
import './libraries/UffLibrary.sol';
import './libraries/SafeMath.sol';
import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';

contract UffRouterSwap is IUffRouterSwap {
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
        require(isSpamListed[_token], "UFF ROUTER: ALREADY SPAMLISTED");
        isSpamListed[_token] = false;
    }

    function spamListed(address _token) public view returns (bool) {
        return isSpamListed[_token];
    }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal virtual {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);

            // UFF MOD - SPAMLIST CHECK TOKEN A & TOKEN B
            if (msg.sender != IUffFactory(factory).feeToSetter()) {
                require(!isSpamListed[input], "UFF ROUTER: TOKEN A ADDR SPAMLISTED");
                require(!isSpamListed[output], "UFF ROUTER: TOKEN B ADDR SPAMLISTED");
            }

            (address token0,) = UffLibrary.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
            address to = i < path.length - 2 ? UffLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IUffPair(UffLibrary.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        amounts = UffLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'UFF ROUTER: INSUFF_OUT_AMNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, UffLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        amounts = UffLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'UFF ROUTER: EXCESSIVE_INPUT_AMNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, UffLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        payable
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WETH, 'UFF ROUTER: INVALID_PATH');
        amounts = UffLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'UFF ROUTER: INSUFF_OUT_AMNT');
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(UffLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }
    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WETH, 'UFF ROUTER: INVALID_PATH');
        amounts = UffLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'UFF ROUTER: EXCESSIVE_INPUT_AMNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, UffLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WETH, 'UFF ROUTER: INVALID_PATH');
        amounts = UffLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'UFF ROUTER: INSUFF_OUT_AMNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, UffLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }
    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        payable
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WETH, 'UFF ROUTER: INVALID_PATH');
        amounts = UffLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= msg.value, 'UFF ROUTER: EXCESSIVE_INPUT_AMNT');
        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(UffLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
        // refund dust eth, if any
        if (msg.value > amounts[0]) TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0]);
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(address[] memory path, address _to) internal virtual {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);

            // UFF MOD - SPAMLIST CHECK TOKEN A & TOKEN B
            if (msg.sender != IUffFactory(factory).feeToSetter()) {
                require(!isSpamListed[input], "UFF ROUTER: TOKEN A ADDR SPAMLISTED");
                require(!isSpamListed[output], "UFF ROUTER: TOKEN B ADDR SPAMLISTED");
            }
            
            (address token0,) = UffLibrary.sortTokens(input, output);
            IUffPair pair = IUffPair(UffLibrary.pairFor(factory, input, output));
            uint amountInput;
            uint amountOutput;
            { // scope to avoid stack too deep errors
            (uint reserve0, uint reserve1,) = pair.getReserves();
            (uint reserveInput, uint reserveOutput) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
            amountInput = IERC20(input).balanceOf(address(pair)).sub(reserveInput);
            amountOutput = UffLibrary.getAmountOut(amountInput, reserveInput, reserveOutput);
            }
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOutput) : (amountOutput, uint(0));
            address to = i < path.length - 2 ? UffLibrary.pairFor(factory, output, path[i + 2]) : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) {
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, UffLibrary.pairFor(factory, path[0], path[1]), amountIn
        );
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            'UFF ROUTER: INSUFF_OUT_AMNT'
        );
    }
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        virtual
        override
        payable
        ensure(deadline)
    {
        require(path[0] == WETH, 'UFF ROUTER: INVALID_PATH');
        uint amountIn = msg.value;
        IWETH(WETH).deposit{value: amountIn}();
        assert(IWETH(WETH).transfer(UffLibrary.pairFor(factory, path[0], path[1]), amountIn));
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            'UFF ROUTER: INSUFF_OUT_AMNT'
        );
    }
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        virtual
        override
        ensure(deadline)
    {
        require(path[path.length - 1] == WETH, 'UFF ROUTER: INVALID_PATH');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, UffLibrary.pairFor(factory, path[0], path[1]), amountIn
        );
        _swapSupportingFeeOnTransferTokens(path, address(this));
        uint amountOut = IERC20(WETH).balanceOf(address(this));
        require(amountOut >= amountOutMin, 'UFF ROUTER: INSUFF_OUT_AMNT');
        IWETH(WETH).withdraw(amountOut);
        TransferHelper.safeTransferETH(to, amountOut);
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