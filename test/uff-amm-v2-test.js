const UffPair = require("../static/UffPair.json");
// const Ganache = require('./helpers/ganache');
const deployUffAmm = require('./helpers/deployUffAmmV2');
const { expect, assert } = require('chai');
const { ethers } = require('hardhat');

describe('uff amm v2 protocol', function() {
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
  let uffRouterSwap;
  let uffRouterLiquidity;

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
    uffRouterSwap = contracts.uffRouterSwap;
    uffRouterLiquidity = contracts.uffRouterLiquidity;

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

    // 

    // await uffFactory.createPair(weth.address, tokenTwo.address);
    // pairTwoAddress = await uffFactory.getPair(weth.address, tokenTwo.address);
    // uffPairTwo = await ethers.getContractAt(UffPair.abi, pairTwoAddress);

    // await uffPairTwo.whiteListRouter(uffRouterSwap.address)
    // await uffPair.whiteListRouter(uffRouterSwap.address)
  });

  it('should be able to create a UFF PAIR from feeToSetter', async function() {
    await uffFactory.createPair(weth.address, tokenOne.address);
    pairAddress = await uffFactory.getPair(weth.address, tokenOne.address);
    uffPair = await ethers.getContractAt(UffPair.abi, pairAddress);

    assert.strictEqual(await uffPair.token0(), tokenOne.address);
    assert.strictEqual(await uffPair.token1(), weth.address);
    assertBNequal(await uffPair.totalSupply(), 0);
  });

  it('should NOT be able to create a UFF PAIR from non-feeToSetter', async function() {
    await expect(uffFactory.connect(user).createPair
    (
      weth.address,
      tokenOne.address,
    )).to.revertedWith("UFF: ONLY FEE TO SETTER")
  });

  it('should NOT be able to AddLiquidity if LP not Initialized', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);

    // const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPair.getReserves();
    // assertBNequal(reserve0Before, 0);
    // assertBNequal(reserve1Before, 0);
    // assertBNequal(await tokenOne.totalSupply(), totalSupply);
    // assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);

    await tokenOne.transfer(user.address, liquidityTokenOneAmount)
    await tokenThree.transfer(user.address, liquidityTokenOneAmount)

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await tokenThree.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidity(
      tokenTwo.address,
      tokenThree.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.revertedWith("UFF ROUTER: PAIR NOT CREATED YET")
  });

  it('should be able to AddLiquidity NON-FOT/NON-FOT with 0% fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // Create LP from feeToSetter
    await uffFactory.createPair(tokenOne.address, tokenThree.address);
    pairThreeAddress = await uffFactory.getPair(tokenOne.address, tokenThree.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await tokenOne.transfer(user.address, liquidityTokenOneAmount)
    await tokenThree.transfer(user.address, liquidityTokenOneAmount)

    // const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await tokenThree.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidity(
      tokenOne.address,
      tokenThree.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairThree.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount);
  });

  it('should be able to AddLiquidityETH BNB/NON-FOT with 0% fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // Create LP from feeToSetter
    await uffFactory.createPair(tokenOne.address, weth.address);
    pairThreeAddress = await uffFactory.getPair(tokenOne.address, weth.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await tokenOne.transfer(user.address, liquidityTokenOneAmount)
    // await tokenThree.transfer(user.address, liquidityTokenOneAmount)

    // const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    // await tokenThree.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairThree, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairThree.getReserves();
    
    assertBNequal(reserve0After, liquidityBNBAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount);
  });

  it('should be able to AddLiquidityETHFree BNB/FOT with 0% fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // Create LP from feeToSetter
    await uffFactory.createPair(weth.address, tokenTwo.address);
    pairThreeAddress = await uffFactory.getPair(weth.address, tokenTwo.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await tokenTwo.excludeFromFee(uffRouterLiquidity.address)
    await tokenTwo.excludeFromFee(accounts[0].address)

    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)
    // await tokenThree.transfer(user.address, liquidityTokenOneAmount)

    // const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    // await tokenThree.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairThree, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairThree.getReserves();
    
    assertBNequal(reserve0After, liquidityBNBAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount);
  });

  it('should be able to AddLiquidityETHFree FOT/NON-FOT with 0% fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // Create LP from feeToSetter
    await uffFactory.createPair(tokenTwo.address, tokenOne.address);
    pairThreeAddress = await uffFactory.getPair(tokenTwo.address, tokenOne.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await tokenTwo.excludeFromFee(uffRouterLiquidity.address)
    await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPairThree.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairThree.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)

    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    
    await expect(uffRouterLiquidity.connect(user).addLiquidityFree(
      tokenTwo.address,
      tokenOne.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairThree.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount);
  });

  it('should be able to AddLiquidity FOT/NON-FOT with 6% fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');
    const fee = bn(600)
    const expectedFee = bn(liquidityTokenOneAmount).mul(fee).div(10000);

    // Create LP from feeToSetter
    await uffFactory.createPair(tokenTwo.address, tokenOne.address);
    pairThreeAddress = await uffFactory.getPair(tokenTwo.address, tokenOne.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await tokenTwo.excludeFromFee(accounts[0].address)

    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)
    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    // const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidity(
      tokenOne.address,
      tokenTwo.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairThree.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount.sub(expectedFee));
  });

  it('should be able to RemLiquidity NON-FOT/NON-FOT with 0% fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // Create LP from feeToSetter
    await uffFactory.createPair(tokenOne.address, tokenThree.address);
    pairThreeAddress = await uffFactory.getPair(tokenOne.address, tokenThree.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await tokenOne.transfer(user.address, liquidityTokenOneAmount)
    await tokenThree.transfer(user.address, liquidityTokenOneAmount)

    // const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await tokenThree.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidity(
      tokenOne.address,
      tokenThree.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairThree.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount);

    const lpBalance = await uffPairThree.balanceOf(user.address)

    // await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await uffPairThree.connect(user).approve(uffRouterLiquidity.address, lpBalance);
  
    // console.log(uffPairTwo.address)
    await expect(uffRouterLiquidity.connect(user).removeLiquidity(
      tokenOne.address,
      tokenThree.address,
      lpBalance,
      0,
      0,
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPairThree, 'Burn');
  });

  it('should be able to RemLiquidityETH BNB/NON-FOT with 0% fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // Create LP from feeToSetter
    await uffFactory.createPair(tokenOne.address, weth.address);
    pairThreeAddress = await uffFactory.getPair(tokenOne.address, weth.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await tokenOne.transfer(user.address, liquidityTokenOneAmount)
    // await tokenThree.transfer(user.address, liquidityTokenOneAmount)

    // const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    // await tokenThree.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairThree, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairThree.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityBNBAmount );

    const lpBalance = await uffPairThree.balanceOf(user.address)

    await uffPairThree.connect(user).approve(uffRouterLiquidity.address, lpBalance);
  
    // console.log(uffPairTwo.address)
    await expect(uffRouterLiquidity.connect(user).removeLiquidityETH(
      tokenOne.address,
      lpBalance,
      0,
      0,
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPairThree, 'Burn');
  });

  it('should be able to RemLiquidity FOT/NON-FOT with 6% fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');
    const fee = bn(600)
    const expectedFee = bn(liquidityTokenOneAmount).mul(fee).div(10000);

    // Create LP from feeToSetter
    await uffFactory.createPair(tokenTwo.address, tokenOne.address);
    pairThreeAddress = await uffFactory.getPair(tokenTwo.address, tokenOne.address);
    uffPairThree = await ethers.getContractAt(UffPair.abi, pairThreeAddress);

    await tokenTwo.excludeFromFee(accounts[0].address)

    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)
    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    // const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidity(
      tokenOne.address,
      tokenTwo.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairThree, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairThree.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount.sub(expectedFee));
    assertBNequal(reserve1After, liquidityTokenOneAmount);

    const lpBalance = await uffPairThree.balanceOf(user.address)

    await uffPairThree.connect(user).approve(uffRouterLiquidity.address, lpBalance);
  
    await expect(uffRouterLiquidity.connect(user).removeLiquidity(
      tokenTwo.address,
      tokenOne.address,
      lpBalance,
      0,
      0,
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPairThree, 'Burn');

    // assertBNequal(reserve0After.sub(expectedFee), await tokenTwo.balanceOf(user.address));
  });

  it('should NOT be able to swap with 0% fee if spamlisted', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // await tokenOne.excludeFromFee(uffRouterLiquidity.address)
    // await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPair.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    // await tokenOne.mint(liquidityTokenOneAmount)
    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenOne.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPair, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPair.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityBNBAmount);

    await uffRouterSwap.spamList(tokenOne.address)

    await expect(uffRouterSwap.connect(user).swapExactETHForTokens(
      0,
      [weth.address, tokenOne.address],
      user.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    )).to.revertedWith('UFF ROUTER: TOKEN B ADDR SPAMLISTED');
  });

  it('should NOT be able to swap with 6% fee if spamlisted', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    await tokenTwo.excludeFromFee(uffRouterLiquidity.address)
    await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPairTwo.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityBNBAmount);

    await uffRouterSwap.spamList(tokenTwo.address)

    await expect(uffRouterSwap.connect(user).swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [weth.address, tokenTwo.address],
      user.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    )).to.revertedWith('UFF ROUTER: TOKEN B ADDR SPAMLISTED');

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');
  });

  it('should NOT be able to addLiquidity with 0% fee if spamlisted', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // await tokenOne.excludeFromFee(uffRouterLiquidity.address)
    // await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPairTwo.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    // await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await uffRouterLiquidity.spamList(tokenOne.address)

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.revertedWith('UFF ROUTER: TOKEN ADDR SPAMLISTED');

    // const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPair.getReserves();
    
    // assertBNequal(reserve0After, liquidityTokenOneAmount);
    // assertBNequal(reserve1After, liquidityBNBAmount );

    // await uffPair.whiteListRouter(uffRouterSwap.address)

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokensSupportingFeeOnTransferTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.revertedWith('UFF ROUTER: TOKEN B ADDR BLACKLISTED');

    // await expect(uffRouterSwap.swapExactETHForTokensSupportingFeeOnTransferTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   owner.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');
  });

  it('should be able to swap with 6% after spamlist if tx comes from feeToSetter', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    await tokenTwo.excludeFromFee(uffRouterLiquidity.address)
    await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPairTwo.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityBNBAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount);

    await uffRouterSwap.spamList(tokenTwo.address)
    await uffPairTwo.approveRouter(uffRouterSwap.address)

    await expect(uffRouterSwap.connect(user).swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [weth.address, tokenTwo.address],
      user.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    )).to.revertedWith('UFF ROUTER: TOKEN B ADDR SPAMLISTED');

    await expect(uffRouterSwap.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [weth.address, tokenTwo.address],
      owner.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    ))

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');
  });

  it('should be able to swap with 0% after spamlist if tx comes from feeToSetter', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // await tokenOne.excludeFromFee(uffRouterLiquidity.address)
    // await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPairTwo.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    // await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPair, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPair.getReserves();
    
    assertBNequal(reserve0After, liquidityBNBAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount);

    await uffRouterSwap.spamList(tokenOne.address)
    await uffPair.approveRouter(uffRouterSwap.address)

    await expect(uffRouterSwap.connect(user).swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [weth.address, tokenOne.address],
      user.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    )).to.revertedWith('UFF ROUTER: TOKEN B ADDR SPAMLISTED');

    await expect(uffRouterSwap.swapExactETHForTokensSupportingFeeOnTransferTokens(
      0,
      [weth.address, tokenOne.address],
      owner.address,
      new Date().getTime() + 3000,
      { value: utils.parseEther('1') }
    )).to.emit(uffPair, 'Swap');

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');
  });

  it('should be able to AddLiquidity with 0% after spamlist if tx comes from feeToSetter', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // await tokenOne.excludeFromFee(uffRouterLiquidity.address)
    // await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPairTwo.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    // await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await uffRouterLiquidity.spamList(tokenOne.address)

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.revertedWith('UFF ROUTER: TOKEN ADDR SPAMLISTED');

    // const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPair.getReserves();
    
    // assertBNequal(reserve0After, liquidityTokenOneAmount);
    // assertBNequal(reserve1After, liquidityBNBAmount );

    // await uffPair.whiteListRouter(uffRouterSwap.address)

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokensSupportingFeeOnTransferTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.revertedWith('UFF ROUTER: TOKEN B ADDR BLACKLISTED');

    // await expect(uffRouterSwap.swapExactETHForTokensSupportingFeeOnTransferTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   owner.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');
  });

  it('should be able to AddLiquidity with 6% after spamlist if tx comes from feeToSetter', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // await tokenOne.excludeFromFee(uffRouterLiquidity.address)
    // await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPairTwo.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await uffRouterLiquidity.spamList(tokenTwo.address)

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.revertedWith('UFF ROUTER: TOKEN ADDR SPAMLISTED');

    // const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPair.getReserves();
    
    // assertBNequal(reserve0After, liquidityTokenOneAmount);
    // assertBNequal(reserve1After, liquidityBNBAmount );

    // await uffPair.whiteListRouter(uffRouterSwap.address)

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokensSupportingFeeOnTransferTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.revertedWith('UFF ROUTER: TOKEN B ADDR BLACKLISTED');

    // await expect(uffRouterSwap.swapExactETHForTokensSupportingFeeOnTransferTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   owner.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');

    // await expect(uffRouterSwap.connect(user).swapExactETHForTokens(
    //   0,
    //   [weth.address, tokenOne.address],
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: utils.parseEther('1') }
    // )).to.emit(uffPair, 'Swap');
  });

  it('should be able to AddLiquidity BNB/TOKEN-TWO with 0% fees using Liquidity Router if excluded from fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    await tokenTwo.excludeFromFee(uffRouterLiquidity.address)
    await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityBNBAmount);
  });

  it('should be able to AddLiquidity TOKEN-ONE/TOKEN-TWO with 0% fees using Liquidity Router if excluded from fee', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    await tokenTwo.excludeFromFee(uffRouterLiquidity.address)
    await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)

    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);

    await expect(uffRouterLiquidity.connect(user).addLiquidity(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityBNBAmount);
  });

  it('should be able to RemLiquidity with 0% fees using Liquidity Router', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    // await tokenTwo.excludeFromFee(uffRouterLiquidity.address)
    // await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    // await tokenOne.mint(liquidityTokenOneAmount)
    await tokenOne.transfer(user.address, liquidityTokenOneAmount)

    const userBeforeBalanceTokenOne = await tokenOne.balanceOf(user.address);
    const userBeforeBalanceBNB = await user.getBalance()

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenOne.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPair, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPair.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityBNBAmount);

    const lpBalance = await uffPair.balanceOf(user.address)

    await tokenOne.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await uffPair.connect(user).approve(uffRouterLiquidity.address, lpBalance);
  
    // console.log(uffPairTwo.address)
    await expect(uffRouterLiquidity.connect(user).removeLiquidityETH(
      tokenOne.address,
      lpBalance,
      0,
      0,
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPair, 'Burn');

    const userAfterBalanceTokenOne = await tokenOne.balanceOf(user.address);
    const userAfterBalanceBNB = await user.getBalance()

    // assertBNequal(userBeforeBalanceBNB, userAfterBalanceBNB);
    // assertBNequal(userBeforeBalanceTokenOne, userAfterBalanceTokenOne);

    // MISSING REMOVE LIQUIDITY TEST

    // await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
    //   tokenTwo.address,
    //   liquidityTokenOneAmount,
    //   0,
    //   0,
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: liquidityBNBAmount }
    // )).to.emit(uffPairTwo, 'Mint');
  });

  it('should be able to RemLiquidity with 6% fees using Liquidity Router', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');
    // console.log(liquidityTokenOneAmount)

    await tokenTwo.excludeFromFee(uffRouterLiquidity.address)
    await tokenTwo.excludeFromFee(accounts[0].address)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await uffPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenOne.totalSupply(), totalSupply);
    assertBNequal(await uffPairTwo.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);
    // console.log(uffRouterLiquidity.address)
    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)

    const userBalanceBefore = await tokenTwo.balanceOf(user.address)
    // console.log(await utils.formatUnits(userBalanceBefore.toString()))

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    const lpBalance = await uffPairTwo.balanceOf(user.address)
    assertBNequal(reserve0After, liquidityBNBAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount );

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await uffPairTwo.connect(user).approve(uffRouterLiquidity.address, lpBalance);
  
    // console.log(uffPairTwo.address)
    await expect(uffRouterLiquidity.connect(user).removeLiquidityETHSupportingFeeOnTransferTokens(
      tokenTwo.address,
      lpBalance,
      0,
      0,
      user.address,
      new Date().getTime() + 3000
    )).to.emit(uffPairTwo, 'Burn');

    // MISSING REMOVE LIQUIDITY TEST

    // await expect(uffRouterLiquidity.connect(user).addLiquidityETH(
    //   tokenTwo.address,
    //   liquidityTokenOneAmount,
    //   0,
    //   0,
    //   user.address,
    //   new Date().getTime() + 3000,
    //   { value: liquidityBNBAmount }
    // )).to.emit(uffPairTwo, 'Mint');
  });

  

  it('should be able to do swap BNB for TOKEN-TWO with 6% fees using Swap Router', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    const liquidityBNBAmount = utils.parseEther('10');

    await tokenTwo.mint(liquidityTokenOneAmount)
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount)

    await tokenTwo.isExcludedFromFee(uffRouterLiquidity.address)

    // assertBNequal(await .getBurnFee(), 0);
    // assertBNequal(await infinity.getFee(), 0);

    // const userBalanceBefore = 

    await tokenTwo.connect(user).approve(uffRouterLiquidity.address, liquidityTokenOneAmount);
    await expect(uffRouterLiquidity.addLiquidityETH(
      tokenTwo.address,
      liquidityTokenOneAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(uffPairTwo, 'Mint');

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