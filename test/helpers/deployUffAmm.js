// Uff AMM
// const UffPair = require("../../static/UffPair.json");
const UffFactory = require("../../static/UffFactory.json");
const UffRouter =  require("../../static/UffRouter.json");
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

  const UffRouterContract = new ethers.ContractFactory(
    UffRouter.abi,
    UffRouter.bytecode,
    owner
  );
  const uffRouter = await UffRouterContract.deploy(uffFactory.address, weth.address);
  // console.log("ROUTER Deployed at: ", uffRouter.address)

  return { uffFactory, weth, uffRouter };
}

module.exports = deployUffAmm;