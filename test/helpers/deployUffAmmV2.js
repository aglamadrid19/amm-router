// Uff AMM
// const UffPair = require("../../static/UffPair.json");
const UffFactory = require("../../static/UffFactory.json");
// const UffRouter =  require("../../static/UffRouter.json");
const WETH = require("../../static/WBNB.json");

async function deployUffAmm(accounts) {
  const owner = accounts[0];
  // const feeToAddress = accounts[4]

  const WethFactory = new ethers.ContractFactory(WETH.abi, WETH.bytecode, owner);
  const weth = await WethFactory.deploy();
  // console.log("WETH Deployed at: ", weth.address)
  
  const UffFactoryContract = new ethers.ContractFactory(UffFactory.abi, UffFactory.bytecode, owner);
  const uffFactory = await UffFactoryContract.deploy(owner.address);
  
  // console.log("FACTORY Deployed at: ", uffFactory.address)

  // const UffRouterContract = new ethers.ContractFactory(
  //   UffRouter.abi,
  //   UffRouter.bytecode,
  //   owner
  // );

  const uffRouterSwapContract = await ethers.getContractFactory('UffRouterSwap');
  const uffRouterSwap = await uffRouterSwapContract.deploy(uffFactory.address, weth.address);

  const uffRouterLiquidityContract = await ethers.getContractFactory('UffRouterLiquidity');
  const uffRouterLiquidity = await uffRouterLiquidityContract.deploy(uffFactory.address, weth.address);

  // const uffRouter = await UffRouterContract.deploy(uffFactory.address, weth.address);
  // console.log("ROUTER Deployed at: ", uffRouter.address)

  await uffFactory.setWbnb(weth.address)
  await uffFactory.setSwapRouter(uffRouterSwap.address)
  await uffFactory.setLiquidityRouter(uffRouterLiquidity.address)

  return { uffFactory, weth, uffRouterSwap, uffRouterLiquidity };
}

module.exports = deployUffAmm;