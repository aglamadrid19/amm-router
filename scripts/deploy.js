const hre = require('hardhat')
const { BigNumber } = require('ethers')
// const deployUffAmm = require('../test/helpers/deployUffAmm');

async function main() {
	const UFF_ADDRESS = "0x3993a8f82F5e1a5381E678Fc237a3da668C1F4eB"
	const UFF_ROUTER = "0x701e3959e95a674f87e2d06c00d8872a0b1a939c"
	const UFF_FACTORY = "0x75a843cdb1ddc40ad16092c43a67a5fadccd9c8e"

	// const accounts = await hre.ethers.getSigners()

	// const contracts = await deployUffAmm(accounts);

	// console.log("CORE AMM Contracts Deployed")

	// const uffFactory = contracts.uffFactory
	// const uffRouter = contracts.uffRouter
	// const WBNB = contracts.weth

	// await uffFactory.setFeeTo(accounts[0].address)

	// console.log("UFF ROUTER FEE TO: ", accounts[0].address)

	const GoldenGrainContract = await ethers.getContractFactory('GoldenGrainToken');
    const goldenGrain = await GoldenGrainContract.deploy();
    await goldenGrain.deployed();

	console.log("GOLDEN GRAIN DEPLOYED: ", goldenGrain.address)

	// await uffFactory.createPair(UFF_ADDRESS, goldenGrain.address);

	// console.log("UFF FACTORY PAIR CREATED")

	// const pairAddress = await uffFactory.getPair(UFF_ADDRESS, goldenGrain.address);
	
	// await uffRouter.blackList(goldenGrain.address)
	// await goldenGrain.transferLpToken(pairAddress)

	// const WETH = await hre.ethers.getContractFactory('WBNB')
	// const weth = await WETH.deploy()
	// await weth.deployed()
	// console.log('WETH deployed to:', weth.address)

	// // const woktAddress = '0x2219845942d28716c0f7c605765fabdca1a7d9e0' //okex_testnet
	// const woktAddress = '0x70c1c53E991F31981d592C2d865383AC0d212225' //okex_testnet
    // console.log('woktAddress:', woktAddress)

	// const Router = await hre.ethers.getContractFactory('UffRouter')
	// const factoryAddress = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
	// const router = await Router.deploy(factoryAddress, weth.address)
	// await router.deployed()

	// console.log('Router deployed to:', router.address)

	// await hre.run("verify:verify", {
	// 	address: '0x75a843CDb1dDc40ad16092C43a67A5fADCcd9C8e',
	// 	constructorArguments: [
	// 		'0x307Dbd74260d8e92c2f6EdfB23E46B4a692946a2',
	// 		// '0x7Ba8Af7c12A4E5CedDa768663301459a40cA7344'
	// 	],
	// });
}


// async function deployERC() {
//     let totalSupply = m(100000000) //1个亿
//     let amount = m(20000)
//     let user1 = '0x662546Dcc9f158a9ABb4d1c3B369B07bC67969D6'
//     let user2 = '0x3A40066D1dC27d14C721e4135cF02DCb20C9AFE0'
//     let user3 = '0x011EBb673b8e7e042C42121CCA062FB7b27BdCFE'
//     const ERC20 = await hre.ethers.getContractFactory('ERC20')

//     let token = await ERC20.deploy('OKB', totalSupply, 18)
//     await token.deployed()
//     console.log('OKB deployed to:', token.address)
//     await token.transfer(user1, amount)
//     await token.transfer(user2, amount)
//     await token.transfer(user3, amount)

//     token = await ERC20.deploy('NAS', totalSupply, 18)
//     await token.deployed()
//     console.log('NAS deployed to:', token.address)
//     await token.transfer(user1, amount)
//     await token.transfer(user2, amount)
//     await token.transfer(user3, amount)
    
//     token = await ERC20.deploy('DAI', totalSupply, 18)
//     await token.deployed()
//     console.log('DAI deployed to:', token.address)
//     await token.transfer(user1, amount)
//     await token.transfer(user2, amount)
//     await token.transfer(user3, amount)

//     totalSupply = totalSupply.div(1000000000000)
//     token = await ERC20.deploy('USDT', totalSupply, 6)
//     await token.deployed()
//     console.log('USDT deployed to:', token.address)
//     amount = amount.div(1000000000000)
//     await token.transfer(user1, amount)
//     await token.transfer(user2, amount)
//     await token.transfer(user3, amount)

// 	console.log('decimals', await token.decimals())
// 	console.log('balance', await token.balanceOf(user3).toString())

//     //okex_testnet
//     // OKB deployed to: 0xf8542108F7922A7ef71BF3C7Fd60B81d3245eD31
// 	// NAS deployed to: 0x6FD9dB63dbC6BE452ae7B0Fe9995c81d967870Bb
// 	// DAI deployed to: 0x0586e702605d7206edD283D4311B38AEB579d7BC
// 	// USDT deployed to: 0xB53CB1feEbea105C30982e7f2Ed803a2195DA922

//     //bsc_testnet
//     // USDT deployed to: 0x072777f02Ad827079F188D8175FB155b0e75343D
//     // DAI deployed to: 0x36c2A57bdb0cE4082Da82a1a8E84aE5f490f0134
//     // UNI deployed to: 0x9e9835e736199C72fc481D13339F3817B9cC8dAD
//     // AAVE deployed to: 0xb01C941902a76553EEe31848c830b6552eD96679
// }

// function m(num) {
//     return BigNumber.from('1000000000000000000').mul(num)
// }

// function d(bn) {
//     return bn.div('1000000000').toNumber() / 1000000000
// }

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error)
		process.exit(1)
	})