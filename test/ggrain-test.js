const UffPair = require("../static/UffPair.json");
const GoldenGrain =  require("../static/GoldenGrainToken.json");
// const Ganache = require('./helpers/ganache');
const deployUffAmm = require('./helpers/deployUffAmm');
const { expect, assert, util } = require('chai');
const { ethers } = require('hardhat');

describe('ggrain protocol on UFF amm', function() {
  const bn = (input) => ethers.BigNumber.from(input);
  const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString());
  const utils = ethers.utils

  const baseUnit = 18;
  const totalSupply = utils.parseUnits('1000000', baseUnit);

  let accounts;
  let owner;
  let user;
  let feeReceiver;

  let weth;
  let uffFactory;
  let uffRouter;

  let uffPair;
  let uffPairTwo;
  let gGrainPair

  let pairAddress;
  let pairTwoAddress;

  let goldenGrain
  let tokenTwo

  beforeEach('setup others', async function() {
    accounts = await ethers.getSigners();

    owner = accounts[0];
    user = accounts[1];
    feeReceiver = accounts[2];
    userTwo = accounts[3];
    // afterEach('revert', function() { return ganache.revert(); });

    const contracts = await deployUffAmm(accounts);

    weth = contracts.weth;
    uffFactory = contracts.uffFactory;
    uffRouter = contracts.uffRouter;

    await uffFactory.setFeeTo(userTwo.address)

    // const TokenOne = await ethers.getContractFactory('Token');
    const TokenTwo = await ethers.getContractFactory('TokenFOT');
    tokenTwo = await TokenTwo.deploy();
    await tokenTwo.deployed();

    // const GoldenGrainContract = new ethers.ContractFactory(GoldenGrain.abi, GoldenGrain.bytecode, owner);

    const GoldenGrainContract = await ethers.getContractFactory('GoldenGrainToken');
    goldenGrain = await GoldenGrainContract.deploy();
    await goldenGrain.deployed();

    await uffFactory.createPair(weth.address, goldenGrain.address);
    await uffFactory.createPair(tokenTwo.address, goldenGrain.address);

    pairAddressTwo = await uffFactory.getPair(tokenTwo.address, goldenGrain.address);
    pairAddress = await uffFactory.getPair(weth.address, goldenGrain.address);

    gGrainPair = await ethers.getContractAt(UffPair.abi, pairAddress);
    uffPairTwo = await ethers.getContractAt(UffPair.abi, pairAddressTwo)

    // await gGrainPair.whiteListRouter(uffRouter.address)
    // await uffPairTwo.whiteListRouter(uffRouter.address)

    // await uffPairTwo.setFirstController();
    // await uffFactory.createPair(weth.address, tokenTwo.address);
    // pairTwoAddress = await uffFactory.getPair(weth.address, tokenTwo.address);
    // uffPairTwo = await ethers.getContractAt(UffPair.abi, pairTwoAddress);
  });

  it('should be able to check a UFF Pair UFF/GGRAIN', async function() {
    assert.strictEqual(await gGrainPair.token0(), weth.address);
    assert.strictEqual(await gGrainPair.token1(), goldenGrain.address);
    assertBNequal(await gGrainPair.totalSupply(), 0);
  });

  it('should be able to addLiquidity to GGRAIN/TOKEN-TWO pair with 6% fees', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    // const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
    // const liquidityBNBAmount = utils.parseEther('10');
    const fee = bn(600);
    const expectedFee = bn(liquidityTokenOneAmount).mul(fee).div(10000);

    await uffRouter.blackList(goldenGrain.address)
    await goldenGrain.transferLpToken(uffPairTwo.address)

    await tokenTwo.mint(liquidityTokenOneAmount);
    await goldenGrain["mint(address,uint256)"](owner.address, liquidityTokenOneAmount)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await gGrainPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenTwo.totalSupply(), liquidityTokenOneAmount);
    assertBNequal(await goldenGrain.totalSupply(), liquidityTokenOneAmount);
    assertBNequal(await gGrainPair.balanceOf(owner.address), 0);
    // assertBNequal(await tokenOne.getBurnFee(), 0);
    // assertBNequal(await tokenOne.getFee(), 0);

    await tokenTwo.approve(uffRouter.address, liquidityTokenOneAmount);
    await goldenGrain.approve(uffRouter.address, liquidityTokenOneAmount)
    await expect(uffRouter.addLiquidity(
      tokenTwo.address,
      goldenGrain.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      owner.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount.sub(expectedFee));
  });

  it('should be able to removeLiquidity GGRAIN/TOKEN-TWO pair with 6% fees', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('200', baseUnit);
    const fee = bn(600);
    const expectedFee = bn(liquidityTokenOneAmount).mul(fee).div(10000);

    const amountToSwap = utils.parseUnits('100', baseUnit);

    await uffRouter.blackList(goldenGrain.address)
    await goldenGrain.transferLpToken(uffPairTwo.address)

    await tokenTwo.mint(liquidityTokenOneAmount.add(amountToSwap).add(expectedFee));
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount.add(amountToSwap))
    await goldenGrain["mint(address,uint256)"](user.address, liquidityTokenOneAmount)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await gGrainPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenTwo.totalSupply(), liquidityTokenOneAmount.add(amountToSwap).add(expectedFee));
    assertBNequal(await goldenGrain.totalSupply(), liquidityTokenOneAmount);
    assertBNequal(await gGrainPair.balanceOf(owner.address), 0);

    await tokenTwo.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await goldenGrain.connect(user).approve(uffRouter.address, liquidityTokenOneAmount)
    await expect(uffRouter.connect(user).addLiquidity(
      tokenTwo.address,
      goldenGrain.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount.sub(expectedFee));
    assertBNequal(reserve1After, liquidityTokenOneAmount);

    await tokenTwo.mint(utils.parseUnits('200', baseUnit))
    await tokenTwo.transfer(user.address, utils.parseUnits('200', baseUnit))

    await goldenGrain["mint(address,uint256)"](user.address, utils.parseUnits('200', baseUnit))

    await tokenTwo.connect(user).approve(uffRouter.address, utils.parseUnits('999999999999', baseUnit))
    await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('999999999999', baseUnit))

    //swap
    // await tokenA.connect(accounts[2]).approve(routerAddress, )
    // await tokenB.connect(accounts[2]).approve(routerAddress, m(100))
    // for (let i=0; i<50; i++) {
    //     await router.connect(accounts[2]).swapExactTokensForTokens(m(1), m(0), [tokenA.address, tokenB.address]
    //     , accounts[2].address, deadline)
    
    //     await router.connect(accounts[2]).swapExactTokensForTokens(m(1), m(0), [tokenB.address, tokenA.address]
    //     , accounts[2].address, deadline)

    //     console.log('swapExactTokensForTokens done', i)
    // }
    const TokenTwoBeforeBalanceRaw = await tokenTwo.balanceOf(user.address)
    const tokenTwoBeforeBalance = await utils.formatUnits(TokenTwoBeforeBalanceRaw.toString())

    const GoldenGrainBeforeBalanceRaw = await goldenGrain.balanceOf(user.address)
    const GoldenGrainBeforeBalance = await utils.formatUnits(GoldenGrainBeforeBalanceRaw.toString())

    const beforeLiquidityRaw = await uffPairTwo.balanceOf(user.address)
    // console.log(utils.formatUnits(beforeLiquidityRaw.toString()))

    await uffPairTwo.connect(user).approve(uffRouter.address, utils.parseUnits(beforeLiquidityRaw.toString(),baseUnit))
    await tokenTwo.connect(user).approve(uffRouter.address, utils.parseUnits('100000000000', baseUnit))
    await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('10000000000000', baseUnit))

    await expect(uffRouter.connect(user).removeLiquidity(
        tokenTwo.address,
        goldenGrain.address,
        beforeLiquidityRaw,
        0,
        0,
        user.address,
        new Date().getTime() + 3000,
    )).to.emit(uffPairTwo, 'Burn');

  });

  it('should NOT be able to do swap BNB / GGRAIN NOR GGRAIN / BNB', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('200', baseUnit);
    const liquidityBNBAmount = utils.parseEther('100');
    const amountToSwap = utils.parseUnits('200', baseUnit);

    await uffRouter.blackList(goldenGrain.address)
    await goldenGrain.transferLpToken(gGrainPair.address)

    await goldenGrain["mint(address,uint256)"](user.address, utils.parseUnits('400', baseUnit))

    await goldenGrain.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);

    // console.log('liquidity added')
    // console.log('router address', uffRouter.address)

    await expect(uffRouter.connect(user).addLiquidityETH(
      goldenGrain.address,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
      { value: liquidityBNBAmount }
    )).to.emit(gGrainPair, 'Mint');

    await goldenGrain.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);

    await expect(uffRouter.connect(user).swapExactETHForTokens(
        0,
        [weth.address, goldenGrain.address],
        user.address,
        new Date().getTime() + 3000,
        { value: utils.parseEther('1') }
    )).to.revertedWith('UFF ROUTER: TOKEN B ADDR BLACKLISTED')

    await expect(uffRouter.connect(user).swapExactTokensForETH(
        amountToSwap,
        0,
        [goldenGrain.address, weth.address],
        user.address,
        new Date().getTime() + 3000
    )).to.revertedWith('UFF ROUTER: TOKEN A ADDR BLACKLISTED')

  });

  it('should NOT be able to do swap TOKEN-TWO / GGRAIN NOR GGRAIN / TOKEN-TWO', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('200', baseUnit);
    const fee = bn(600);
    const expectedFee = bn(liquidityTokenOneAmount).mul(fee).div(10000);

    const amountToSwap = utils.parseUnits('100', baseUnit);

    await uffRouter.blackList(goldenGrain.address)
    await goldenGrain.transferLpToken(uffPairTwo.address)

    await tokenTwo.mint(liquidityTokenOneAmount.add(amountToSwap).add(expectedFee));
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount.add(amountToSwap))
    await goldenGrain["mint(address,uint256)"](user.address, liquidityTokenOneAmount)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await gGrainPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenTwo.totalSupply(), liquidityTokenOneAmount.add(amountToSwap).add(expectedFee));
    assertBNequal(await goldenGrain.totalSupply(), liquidityTokenOneAmount);
    assertBNequal(await gGrainPair.balanceOf(owner.address), 0);

    await tokenTwo.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await goldenGrain.connect(user).approve(uffRouter.address, liquidityTokenOneAmount)
    await expect(uffRouter.connect(user).addLiquidity(
      tokenTwo.address,
      goldenGrain.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount.sub(expectedFee));

    await tokenTwo.mint(utils.parseUnits('200', baseUnit))
    await tokenTwo.transfer(user.address, utils.parseUnits('200', baseUnit))

    await goldenGrain["mint(address,uint256)"](user.address, utils.parseUnits('200', baseUnit))

    await tokenTwo.connect(user).approve(uffRouter.address, utils.parseUnits('999999999999', baseUnit))
    await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('999999999999', baseUnit))

    //swap
    // await tokenA.connect(accounts[2]).approve(routerAddress, )
    // await tokenB.connect(accounts[2]).approve(routerAddress, m(100))
    // for (let i=0; i<50; i++) {
    //     await router.connect(accounts[2]).swapExactTokensForTokens(m(1), m(0), [tokenA.address, tokenB.address]
    //     , accounts[2].address, deadline)
    
    //     await router.connect(accounts[2]).swapExactTokensForTokens(m(1), m(0), [tokenB.address, tokenA.address]
    //     , accounts[2].address, deadline)

    //     console.log('swapExactTokensForTokens done', i)
    // }
    const TokenTwoBeforeBalanceRaw = await tokenTwo.balanceOf(user.address)
    const tokenTwoBeforeBalance = await utils.formatUnits(TokenTwoBeforeBalanceRaw.toString())

    const GoldenGrainBeforeBalanceRaw = await goldenGrain.balanceOf(user.address)
    const GoldenGrainBeforeBalance = await utils.formatUnits(GoldenGrainBeforeBalanceRaw.toString())

    const beforeLiquidityRaw = await uffPairTwo.balanceOf(user.address)
    // console.log(utils.formatUnits(beforeLiquidityRaw.toString()))

    await uffPairTwo.connect(user).approve(uffRouter.address, utils.parseUnits(beforeLiquidityRaw.toString(),baseUnit))
    await tokenTwo.connect(user).approve(uffRouter.address, utils.parseUnits('100000000000', baseUnit))
    await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('10000000000000', baseUnit))

    await tokenTwo.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await expect(uffRouter.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amountToSwap.sub(expectedFee),
      0,
      [tokenTwo.address, goldenGrain.address],
      user.address,
      new Date().getTime() + 3000
    )).to.revertedWith('UFF ROUTER: TOKEN B ADDR BLACKLISTED');
    
    await goldenGrain.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await expect(uffRouter.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountToSwap.sub(expectedFee),
        0,
        [goldenGrain.address, tokenTwo.address],
        user.address,
        new Date().getTime() + 3000
    )).to.revertedWith('UFF ROUTER: TOKEN A ADDR BLACKLISTED');
  });

  it('should NOT be able to do swap TOKEN-TWO / GGRAIN NOR GGRAIN / TOKEN-TWO using LP Router WhiteList', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('200', baseUnit);
    const fee = bn(600);
    const expectedFee = bn(liquidityTokenOneAmount).mul(fee).div(10000);

    const amountToSwap = utils.parseUnits('100', baseUnit);

    // await uffRouter.blackList(goldenGrain.address)
    await goldenGrain.transferLpToken(uffPairTwo.address)

    await tokenTwo.mint(liquidityTokenOneAmount.add(amountToSwap).add(expectedFee));
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount.add(amountToSwap))
    await goldenGrain["mint(address,uint256)"](user.address, liquidityTokenOneAmount)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await gGrainPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenTwo.totalSupply(), liquidityTokenOneAmount.add(amountToSwap).add(expectedFee));
    assertBNequal(await goldenGrain.totalSupply(), liquidityTokenOneAmount);
    assertBNequal(await gGrainPair.balanceOf(owner.address), 0);

    await tokenTwo.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await goldenGrain.connect(user).approve(uffRouter.address, liquidityTokenOneAmount)
    await expect(uffRouter.connect(user).addLiquidity(
      tokenTwo.address,
      goldenGrain.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount.sub(expectedFee));
    assertBNequal(reserve1After, liquidityTokenOneAmount);

    await tokenTwo.mint(utils.parseUnits('200', baseUnit))
    await tokenTwo.transfer(user.address, utils.parseUnits('200', baseUnit))

    await goldenGrain["mint(address,uint256)"](user.address, utils.parseUnits('200', baseUnit))

    await tokenTwo.connect(user).approve(uffRouter.address, utils.parseUnits('999999999999', baseUnit))
    await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('999999999999', baseUnit))

    //swap
    // await tokenA.connect(accounts[2]).approve(routerAddress, )
    // await tokenB.connect(accounts[2]).approve(routerAddress, m(100))
    // for (let i=0; i<50; i++) {
    //     await router.connect(accounts[2]).swapExactTokensForTokens(m(1), m(0), [tokenA.address, tokenB.address]
    //     , accounts[2].address, deadline)
    
    //     await router.connect(accounts[2]).swapExactTokensForTokens(m(1), m(0), [tokenB.address, tokenA.address]
    //     , accounts[2].address, deadline)

    //     console.log('swapExactTokensForTokens done', i)
    // }
    const TokenTwoBeforeBalanceRaw = await tokenTwo.balanceOf(user.address)
    const tokenTwoBeforeBalance = await utils.formatUnits(TokenTwoBeforeBalanceRaw.toString())

    const GoldenGrainBeforeBalanceRaw = await goldenGrain.balanceOf(user.address)
    const GoldenGrainBeforeBalance = await utils.formatUnits(GoldenGrainBeforeBalanceRaw.toString())

    const beforeLiquidityRaw = await uffPairTwo.balanceOf(user.address)
    // console.log(utils.formatUnits(beforeLiquidityRaw.toString()))

    await uffPairTwo.connect(user).approve(uffRouter.address, utils.parseUnits(beforeLiquidityRaw.toString(),baseUnit))
    await tokenTwo.connect(user).approve(uffRouter.address, utils.parseUnits('100000000000', baseUnit))
    await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('10000000000000', baseUnit))

    await tokenTwo.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await expect(uffRouter.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amountToSwap.sub(expectedFee),
      0,
      [tokenTwo.address, goldenGrain.address],
      user.address,
      new Date().getTime() + 3000
    )).to.revertedWith('UFF: ROUTER ADDRESS IS NOT WHITELISTED');
    
    await goldenGrain.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await expect(uffRouter.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountToSwap.sub(expectedFee),
        0,
        [goldenGrain.address, tokenTwo.address],
        user.address,
        new Date().getTime() + 3000
    )).to.revertedWith('UFF: ROUTER ADDRESS IS NOT WHITELISTED');
  });

  it('should NOT be able to do swap TOKEN-TWO / GGRAIN NOR GGRAIN / TOKEN-TWO using LP Router WhiteList', async function() {
    const liquidityTokenOneAmount = utils.parseUnits('200', baseUnit);
    const fee = bn(600);
    const expectedFee = bn(liquidityTokenOneAmount).mul(fee).div(10000);

    const amountToSwap = utils.parseUnits('100', baseUnit);

    // await uffRouter.blackList(goldenGrain.address)
    await goldenGrain.transferLpToken(uffPairTwo.address)

    await tokenTwo.mint(liquidityTokenOneAmount.add(amountToSwap).add(expectedFee));
    await tokenTwo.transfer(user.address, liquidityTokenOneAmount.add(amountToSwap))
    await goldenGrain["mint(address,uint256)"](user.address, liquidityTokenOneAmount)

    const { _reserve0: reserve0Before, _reserve1: reserve1Before } = await gGrainPair.getReserves();
    assertBNequal(reserve0Before, 0);
    assertBNequal(reserve1Before, 0);
    assertBNequal(await tokenTwo.totalSupply(), liquidityTokenOneAmount.add(amountToSwap).add(expectedFee));
    assertBNequal(await goldenGrain.totalSupply(), liquidityTokenOneAmount);
    assertBNequal(await gGrainPair.balanceOf(owner.address), 0);

    await tokenTwo.connect(user).approve(uffRouter.address, liquidityTokenOneAmount);
    await goldenGrain.connect(user).approve(uffRouter.address, liquidityTokenOneAmount)
    await expect(uffRouter.connect(user).addLiquidity(
      tokenTwo.address,
      goldenGrain.address,
      liquidityTokenOneAmount,
      liquidityTokenOneAmount,
      0,
      0,
      user.address,
      new Date().getTime() + 3000,
    )).to.emit(uffPairTwo, 'Mint');

    const { _reserve0: reserve0After, _reserve1: reserve1After } = await uffPairTwo.getReserves();
    
    assertBNequal(reserve0After, liquidityTokenOneAmount);
    assertBNequal(reserve1After, liquidityTokenOneAmount.sub(expectedFee));

    await tokenTwo.mint(utils.parseUnits('200', baseUnit))
    await tokenTwo.transfer(user.address, utils.parseUnits('200', baseUnit))

    await goldenGrain["mint(address,uint256)"](user.address, utils.parseUnits('200', baseUnit))

    await tokenTwo.connect(user).approve(uffRouter.address, utils.parseUnits('999999999999', baseUnit))
    await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('999999999999', baseUnit))

    const TokenTwoBeforeBalanceRaw = await tokenTwo.balanceOf(user.address)
    const tokenTwoBeforeBalance = await utils.formatUnits(TokenTwoBeforeBalanceRaw.toString())

    const GoldenGrainBeforeBalanceRaw = await goldenGrain.balanceOf(user.address)
    const GoldenGrainBeforeBalance = await utils.formatUnits(GoldenGrainBeforeBalanceRaw.toString())

    const beforeLiquidityRaw = await uffPairTwo.balanceOf(user.address)
    // console.log(utils.formatUnits(beforeLiquidityRaw.toString()))

    await uffPairTwo.connect(user).approve(uffRouter.address, utils.parseUnits(beforeLiquidityRaw.toString(),baseUnit))
    await tokenTwo.connect(user).approve(uffRouter.address, utils.parseUnits('100000000000', baseUnit))
    await goldenGrain.connect(user).approve(uffRouter.address, utils.parseUnits('10000000000000', baseUnit))

    await tokenTwo.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await expect(uffRouter.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amountToSwap.sub(expectedFee),
      0,
      [tokenTwo.address, goldenGrain.address],
      user.address,
      new Date().getTime() + 3000
    )).to.revertedWith('UFF: ROUTER ADDRESS IS NOT WHITELISTED');
    
    await goldenGrain.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
    await expect(uffRouter.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amountToSwap.sub(expectedFee),
        0,
        [goldenGrain.address, tokenTwo.address],
        user.address,
        new Date().getTime() + 3000
    )).to.revertedWith('UFF: ROUTER ADDRESS IS NOT WHITELISTED');
  });

//   it.skip('should be able to do swap BNB for TOKEN-TWO with 6% fees', async function() {
//     const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
//     const liquidityBNBAmount = utils.parseEther('10');

//     const fee = bn(600);

//     await tokenTwo.mint(liquidityTokenOneAmount)

//     await tokenTwo.approve(uffRouter.address, liquidityTokenOneAmount);
//     await expect(uffRouter.addLiquidityETH(
//       tokenTwo.address,
//       liquidityTokenOneAmount,
//       0,
//       0,
//       owner.address,
//       new Date().getTime() + 3000,
//       { value: liquidityBNBAmount }
//     )).to.emit(uffPairTwo, 'Mint');

//     assertBNequal(await tokenTwo.balanceOf(user.address), 0);

//     await expect(uffRouter.connect(user).swapExactETHForTokens(
//       0,
//       [weth.address, tokenTwo.address],
//       user.address,
//       new Date().getTime() + 3000,
//       { value: utils.parseEther('1') }
//     )).to.emit(uffPairTwo, 'Swap');
//   });

//   it.skip('should be able to do swap TOKEN-TWO for BNB with 6% fees', async function() {
//     const liquidityTokenOneAmount = utils.parseUnits('10000', baseUnit);
//     const liquidityBNBAmount = utils.parseEther('10');
//     const amountToSwap = utils.parseUnits('100', baseUnit);

//     const fee = bn(600);

//     await tokenTwo.mint(liquidityTokenOneAmount.add(amountToSwap))

//     await tokenTwo.approve(uffRouter.address, liquidityTokenOneAmount);
//     await expect(uffRouter.addLiquidityETH(
//       tokenTwo.address,
//       liquidityTokenOneAmount,
//       0,
//       0,
//       owner.address,
//       new Date().getTime() + 3000,
//       { value: liquidityBNBAmount }
//     )).to.emit(uffPairTwo, 'Mint');

//     await tokenTwo.transfer(user.address, amountToSwap);
//     const expectedFee = bn(amountToSwap).mul(fee).div(10000);
//     assertBNequal(await tokenTwo.balanceOf(user.address), amountToSwap.sub(expectedFee));

//     const balanceBefore = await ethers.provider.getBalance(user.address);
//     await tokenTwo.connect(user).approve(uffRouter.address, amountToSwap.sub(expectedFee));
//     await expect(uffRouter.connect(user).swapExactTokensForTokensSupportingFeeOnTransferTokens(
//       amountToSwap.sub(expectedFee),
//       0,
//       [tokenTwo.address, weth.address],
//       user.address,
//       new Date().getTime() + 3000
//     )).to.emit(uffPairTwo, 'Swap');
//   });

//   it('should be able to check a UFF pair BNB/TOKEN-ONE', async function() {
//     assert.strictEqual(await uffPair.token0(), weth.address);
//     assert.strictEqual(await uffPair.token1(), tokenOne.address);
//     assertBNequal(await uffPair.totalSupply(), 0);
//   });

});