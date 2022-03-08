const hre = require('hardhat')
const fs = require('fs')
const { BigNumber } = require('ethers')

const UffFactory = require("../static/UffFactory.json");
const UffPair = require("../static/UffPair.json");
const UffRouter =  require("../static/UffRouter.json");
const WETH = require("../static/WBNB.json");

async function main() {
    var accounts = await hre.ethers.getSigners()

    //创建token
    const ERC20 = await hre.ethers.getContractFactory('BEP20')

    const tokenA = await ERC20.deploy("Token1", "TK1")
    await tokenA.deployed()
    console.log('TK1 deployed to:', tokenA.address)
    await tokenA.mint(m(200))
    await tokenA.transfer(accounts[2].address, m(200))
    
    const tokenB = await ERC20.deploy("Token2", "TK2")
    await tokenB.deployed()
    console.log('TK2 deployed to:', tokenB.address)
    await tokenB.mint(m(200))
    await tokenB.transfer(accounts[2].address, m(200))

    const WethFactory = new hre.ethers.ContractFactory(WETH.abi, WETH.bytecode, accounts[0]);
    const weth = await WethFactory.deploy();
    await weth.deployed()

    const UffFactoryContract = new hre.ethers.ContractFactory(UffFactory.abi, UffFactory.bytecode, accounts[0]);
    const uffFactory = await UffFactoryContract.deploy(accounts[0].address);
    await uffFactory.deployed()

    //获取swap合约
    // let routerAddress = '0xB468647B04bF657C9ee2de65252037d781eABafD'
    const RouterContract = await hre.ethers.getContractFactory('UffRouter')
    // const RouterContract = new hre.ethers.ContractFactory(UffRouter.abi, UffRouter.bytecode, accounts[0])
    const router = await RouterContract.deploy(uffFactory.address, weth.address)
    await router.deployed()

    const routerAddress = router.address
    console.log('router', routerAddress)
    // const router = new ethers.Contract(routerAddress, routerAbi, accounts[0])
    // let factoryAddress = await router.factory()
    // console.log('factoryAddress:', factoryAddress)

    await uffFactory.setFeeTo(accounts[0].address)
    console.log('Factory now feeTo:', await uffFactory.feeTo())

    let blockNumber = await hre.ethers.provider.getBlockNumber()
    let block = await hre.ethers.provider.getBlock(blockNumber)
    let deadline = BigNumber.from(block.timestamp + 3600 * 24)

    // await uffFactory.createPair(tokenA.address, tokenB.address);
    // let pairAdr = await router.pairFor(tokenA.address, tokenB.address)
    // console.log('pairAdr', pairAdr)

    // console.log('pairAddress:', pairAddress)

    // if (pairAddress != pairAdr) {
    //     console.log('pair wrong !')
    //     return
    // }

    //添加流动性
    await tokenA.connect(accounts[2]).approve(routerAddress, m(100))
    await tokenB.connect(accounts[2]).approve(routerAddress, m(100))

    await router.connect(accounts[2]).addLiquidity(
        tokenA.address, 
        tokenB.address, 
        m(100),
        m(100),
        m(0),
        m(0),
        accounts[2].address,
        deadline
    )

    let pairAddress = await uffFactory.allPairs(0)

    console.log('addLiquidity done')

    const pair = new ethers.Contract(pairAddress, UffPair.abi, accounts[0])
    let lptokenBal = await pair.balanceOf(accounts[2].address)
    console.log('lptokenBal:', d(lptokenBal))

    //查看余额
    let reserves = await pair.getReserves()
    console.log('token Address:', await pair.token0(), await pair.token1())
    console.log('reserves:', d(reserves[0]), d(reserves[1]))
    await balance([tokenA.address, tokenB.address, pairAddress])
    
    //swap
    await tokenA.connect(accounts[2]).approve(routerAddress, m(100))
    await tokenB.connect(accounts[2]).approve(routerAddress, m(100))
    for (let i=0; i<50; i++) {
        await router.connect(accounts[2]).swapExactTokensForTokens(m(1), m(0), [tokenA.address, tokenB.address]
        , accounts[2].address, deadline)
    
        await router.connect(accounts[2]).swapExactTokensForTokens(m(1), m(0), [tokenB.address, tokenA.address]
        , accounts[2].address, deadline)

        console.log('swapExactTokensForTokens done', i)
    }
    
    //查看余额
    reserves = await pair.getReserves()
    console.log('reserves:', d(reserves[0]), d(reserves[1]))
    await balance([tokenA.address, tokenB.address, pairAddress])

    //移除流动性，授权给router，router会调用transferFrom用自己的额度打给pair
    await pair.connect(accounts[2]).approve(router.address, lptokenBal)
    console.log('allowance:', (await pair.allowance(accounts[0].address, router.address)).toString())

    await router.connect(accounts[2]).removeLiquidity(await pair.token0(), await pair.token1(), lptokenBal, m(0), m(0)
    , accounts[2].address, deadline)
    console.log('removeLiquidity done')

    //手动移除流动性，打给pair
    // await pair.transfer(pair.address, lptokenBal)
    // await pair.burn(accounts[0].address)

    //查看余额
    reserves = await pair.getReserves()
    console.log('reserves:', d(reserves[0]), d(reserves[1]))
    await balance([tokenA.address, tokenB.address, pairAddress])

    console.log('all done')
}


async function balance(addressArr) {
    var accounts = await hre.ethers.getSigners()

    let ERC20abi = require('../artifacts/contracts/BEP20.sol/BEP20.json')

    for (let tokenAAddress of addressArr) {
        console.log('token ' + tokenAAddress)
        let tokanA = new ethers.Contract(tokenAAddress, ERC20abi.abi, accounts[0])
        console.log('account0 balance', d(await tokanA.balanceOf(accounts[0].address)))
        console.log('account1 balance', d(await tokanA.balanceOf(accounts[1].address)))
        console.log('account2 balance', d(await tokanA.balanceOf(accounts[2].address)))
        console.log('')
    }
}


function getAbi(jsonPath) {
    let file = fs.readFileSync(jsonPath)
    let abi = JSON.parse(file.toString()).abi
    return abi
}

function m(num) {
    return BigNumber.from('1000000000000000000').mul(num)
}

function d(bn) {
    return bn.div('1000000000').toNumber() / 1000000000
}

function test() {
    let bn = BigNumber.from('1414213562373095047801')
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })