const UffPair = require("../static/UffPair.json");
// const Ganache = require('./helpers/ganache');
const deployUffAmm = require('./helpers/deployUffAmm');
const { expect, assert } = require('chai');
const { ethers } = require('hardhat');

describe('uff amm protocol', function() {
  const bn = (input) => ethers.BigNumber.from(input);
  const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());
  const utils = ethers.utils
//   const ganache = new Ganache();
  const baseUnit = 18;
  const totalSupply = utils.parseUnits('10000000000', baseUnit);

  let accounts;
  let owner;
  let user;
  let feeReceiver;

  let weth;
  let uffFactory;
  let uffRouter;

  let uffPair;
  let uffPairTwo;

  let pairAddress;
  let pairTwoAddress;

  let tokenOne
  let tokenTwo
  let tokenThree

  beforeEach('setup others', async function() {
    accounts = await ethers.getSigners();

    owner = accounts[0];
    user = accounts[1];
    feeReceiver = accounts[4];
    userTwo = accounts[3];
    // afterEach('revert', function() { return ganache.revert(); });

    const contracts = await deployUffAmm(accounts);

    weth = contracts.weth;
    uffFactory = contracts.uffFactory;
    uffRouter = contracts.uffRouter;

    await uffFactory.setFeeTo(feeReceiver.address);

    const TokenOne = await ethers.getContractFactory('Token');
    const TokenTwo = await ethers.getContractFactory('TokenFOT');

    const TokenThree = await ethers.getContractFactory('Token');

    tokenOne = await TokenOne.deploy('TokenOne', 'TK1');
    await tokenOne.deployed();

    tokenTwo = await TokenTwo.deploy()
    await tokenTwo.deployed()

    tokenThree = await TokenThree.deploy('TokenThree', 'TK3')
    await tokenThree.deployed()

    await uffFactory.createPair(weth.address, tokenOne.address);
    pairAddress = await uffFactory.getPair(weth.address, tokenOne.address);
    uffPair = await ethers.getContractAt(UffPair.abi, pairAddress);

    await uffFactory.createPair(weth.address, tokenTwo.address);
    pairTwoAddress = await uffFactory.getPair(weth.address, tokenTwo.address);
    uffPairTwo = await ethers.getContractAt(UffPair.abi, pairTwoAddress);

    await uffFactory.createPair(tokenOne.address, tokenThree.address);
    pairThreeAddress = await uffFactory.getPair(tokenOne.address, tokenThree.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await uffPairTwo.whiteListRouter(uffRouter.address)
    await uffPair.whiteListRouter(uffRouter.address)
  });

  it('should be able to check a UFF pair BNB/TOKEN-ONE', async function() {
    assert.strictEqual(await uffPair.token0(), weth.address);
    assert.strictEqual(await uffPair.token1(), tokenOne.address);
    assertBNequal(await uffPair.totalSupply(), 0);
  });

  it('should be able to top up BNB/TOKEN-ONE pair with with 0% fees', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPair.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);

    await tokenOne.approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPair, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPair.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityBNBAmount);
  });

  it('should be able to do swap BNB for TOKEN-ONE with 0% fees', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // assertBNequal(await .getBurnFee(), 0);
    // assertBNequal(await infinity.getFee(), 0);

    await tokenOne.approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPair, 'Mint');

    assertBNequal(await tokenOne.balanceOf(user.address), 0);

    await expect(uffRouter.connect(user).swapExactETHForTokens(
      0,
      [weth.address, tokenOne.address],
      user.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    )).to.emit(uffPair, 'Swap');
  });

  it('should be able to do swap TOKEN-ONE for BNB with 0% fees', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');
    const amountToSwap = utils.parseUnits('100', baseUnit);

    await tokenOne.approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPair, 'Mint');

    await tokenOne.transfer(user.address, amountToSwap);
    assertBNequal(await tokenOne.balanceOf(user.address), amountToSwap);

    const balanceBefore = await ethers.provider.getBalance(user.address);
    await tokenOne.connect(user).approve(uffRouter.address, amountToSwap);
    await expect(uffRouter.connect(user).swapExactTokensForETHSupportingFeeOnTransferTokens(
      amountToSwap,
      0,
      [tokenOne.address, weth.address],
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPair, 'Swap');
  });

  it('should be able to top up BNB/TOKEN-TWO pair with the liquidity with 6% fees', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    const fee = bn(600);
    
    await tokenTwo.mint(liquidityTokenOneAmount)

    await tokenTwo.approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    const expectedFee = bn(liquidityTokenOneAmount).mul(fee).div(10000);

    assertBNequal(reserve1After, bn(liquidityTokenOneAmount).sub(expectedFee));
    assertBNequal(await tokenTwo.balanceOf(tokenTwo.address), expectedFee);
    assertBNequal(reserve0After, liquidityBNBAmount);
  });

  it('should be able to do swap BNB for TOKEN-TWO with 6% fees', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    const fee = bn(600);

    await tokenTwo.mint(liquidityTokenOneAmount)

    await tokenTwo.approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

    assertBNequal(await tokenTwo.balanceOf(user.address), 0);

    await expect(uffRouter.connect(user).swapExactETHForTokens(
      0,
      [weth.address, tokenTwo.address],
      user.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    )).to.emit(uffPairTwo, 'Swap');
  });

  it('should be able to do swap TOKEN-TWO for BNB with 6% fees', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');
    const amountToSwap = utils.parseUnits('100', baseUnit);

    const fee = bn(600);

    await tokenTwo.mint(liquidityTokenOneAmount.add(amountToSwap))

    await tokenTwo.approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

    await tokenTwo.transfer(user.address, amountToSwap);
    const expectedFee = bn(amountToSwap).mul(fee).div(10000);
    assertBNequal(await tokenTwo.balanceOf(user.address), amountToSwap.sub(expectedFee));

    const balanceBefore = await ethers.provider.getBalance(user.address);
    await tokenTwo.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await expect(uffRouter.connect(user).swapExactTokensForETHSupportingFeeOnTransferTokens(
      amountToSwap.sub(expectedFee),
      0,
      [tokenTwo.address, weth.address],
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPairTwo, 'Swap');
  });

  it('should be able to recive 0.3% trade fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('100000', baseUnit);
    const amountToSwap = utils.parseUnits('1', baseUnit);

    // await tokenTwo.mint(liquidityTokenOneAmount)
    // await tokenThree.mint(liquidityTokenOneAmount)

    // const fee = bn(600);
    // await tokenTwo.mint(liquidityTokenOneAmount.add(amountToSwap))

    await uffPairThree.whiteListRouter(uffRouter.address)
    const feeReceiverBalanceBefore = await uffPairThree.balanceOf(feeReceiver.address)

    tokenThree.transfer(user.address, liquidityTokenOneAmount.add(amountToSwap).mul(4))
    tokenOne.transfer(user.address, liquidityTokenOneAmount.add(amountToSwap).mul(4))

    await tokenThree.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await tokenOne.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.connect(user).addLiquidity(
      tokenOne.address,
      tokenThree.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const feeReceiverBalanceAfterLiquidity = await uffPairThree.balanceOf(feeReceiver.address)

    assert.strictEqual(feeReceiverBalanceBefore, feeReceiverBalanceAfterLiquidity);

    // await tokenTwo.transfer(user.address, amountToSwap);
    // const expectedFee = bn(amountToSwap).mul(fee).div(10000);
    // assertBNequal(await tokenTwo.balanceOf(user.address), amountToSwap.sub(expectedFee));

    // const balanceBefore = await ethers.provider.getBalance(user.address);
    // await tokenTwo.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await tokenOne.connect(user).approve(uffRouter.address, amountToSwap);
    await expect(uffRouter.connect(user).swapExactTokensForTokens(
      amountToSwap,
      0,
      [tokenOne.address, tokenThree.address],
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPairThree, 'Swap');

    await tokenThree.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await tokenOne.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.connect(user).addLiquidity(
      tokenOne.address,
      tokenThree.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const feeReceiverBalanceAfterSwap = await uffPairThree.balanceOf(feeReceiver.address)
    // const feeReceiverBalanceAfterSwapFormat = await utils.formatUnits(feeReceiverBalanceAfterSwap.toString())
    
    await uffPairThree.connect(feeReceiver).approve(uffRouter.address, utils.parseUnits(feeReceiverBalanceAfterSwap.toString(),baseUnit))
    // await tokenOne.connect(user).approve(uffRouter.address, utils.parseUnits('100000000000', baseUnit))
    // await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('10000000000000', baseUnit))

    await expect(uffRouter.connect(feeReceiver).removeLiquidity(
        tokenOne.address,
        tokenThree.address,
        feeReceiverBalanceAfterSwap,
        0,
        0,
        feeReceiver.address,
        new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Burn');

    const tokenOneBalanceRaw = await tokenOne.balanceOf(feeReceiver.address)
    const tokenThreeBalanceRaw = await tokenThree.balanceOf(feeReceiver.address)
    
    const tokenOneBalanceRawFormat = await utils.formatUnits(tokenOneBalanceRaw.toString())  
    const tokenThreeBalanceRawFormat = await utils.formatUnits(tokenThreeBalanceRaw.toString())

    // console.log(tokenOneBalanceRawFormat)
    // console.log(tokenThreeBalanceRawFormat)
  });

  it('should be able to recive 0.3% trade fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('100000', baseUnit);
    const amountToSwap = utils.parseUnits('1', baseUnit);

    // await tokenTwo.mint(liquidityTokenOneAmount)
    // await tokenThree.mint(liquidityTokenOneAmount)

    // const fee = bn(600);
    // await tokenTwo.mint(liquidityTokenOneAmount.add(amountToSwap))

    await uffPairThree.whiteListRouter(uffRouter.address)
    const feeReceiverBalanceBefore = await uffPairThree.balanceOf(feeReceiver.address)

    tokenThree.transfer(user.address, liquidityTokenOneAmount.add(amountToSwap).mul(4))
    tokenOne.transfer(user.address, liquidityTokenOneAmount.add(amountToSwap).mul(4))

    await tokenThree.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await tokenOne.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.connect(user).addLiquidity(
      tokenOne.address,
      tokenThree.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const feeReceiverBalanceAfterLiquidity = await uffPairThree.balanceOf(feeReceiver.address)

    assert.strictEqual(feeReceiverBalanceBefore, feeReceiverBalanceAfterLiquidity);

    // await tokenTwo.transfer(user.address, amountToSwap);
    // const expectedFee = bn(amountToSwap).mul(fee).div(10000);
    // assertBNequal(await tokenTwo.balanceOf(user.address), amountToSwap.sub(expectedFee));

    // const balanceBefore = await ethers.provider.getBalance(user.address);
    // await tokenTwo.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await tokenOne.connect(user).approve(uffRouter.address, amountToSwap);
    await expect(uffRouter.connect(user).swapExactTokensForTokens(
      amountToSwap,
      0,
      [tokenOne.address, tokenThree.address],
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPairThree, 'Swap');

    await tokenThree.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await tokenOne.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await expect(uffRouter.connect(user).addLiquidity(
      tokenOne.address,
      tokenThree.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const feeReceiverBalanceAfterSwap = await uffPairThree.balanceOf(feeReceiver.address)
    // const feeReceiverBalanceAfterSwapFormat = await utils.formatUnits(feeReceiverBalanceAfterSwap.toString())
    
    await uffPairThree.connect(feeReceiver).approve(uffRouter.address, utils.parseUnits(feeReceiverBalanceAfterSwap.toString(),baseUnit))
    // await tokenOne.connect(user).approve(uffRouter.address, utils.parseUnits('100000000000', baseUnit))
    // await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('10000000000000', baseUnit))

    await expect(uffRouter.connect(feeReceiver).removeLiquidity(
        tokenOne.address,
        tokenThree.address,
        feeReceiverBalanceAfterSwap,
        0,
        0,
        feeReceiver.address,
        new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Burn');

    const tokenOneBalanceRaw = await tokenOne.balanceOf(feeReceiver.address)
    const tokenThreeBalanceRaw = await tokenThree.balanceOf(feeReceiver.address)
    
    const tokenOneBalanceRawFormat = await utils.formatUnits(tokenOneBalanceRaw.toString())  
    const tokenThreeBalanceRawFormat = await utils.formatUnits(tokenThreeBalanceRaw.toString())

    // console.log(tokenOneBalanceRawFormat)
    // console.log(tokenThreeBalanceRawFormat)
  });

//   it('should be able to check a UFF pair BNB/TOKEN-ONE', async function() {
//     assert.strictEqual(await uffPair.token0(), weth.address);
//     assert.strictEqual(await uffPair.token1(), tokenOne.address);
//     assertBNequal(await uffPair.totalSupply(), 0);
//   });

});