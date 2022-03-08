const hre = require('hardhat')
const fs = require('fs')
const { BigNumber } = require('ethers')

var accounts = null

async function main() {
    accounts = await hre.ethers.getSigners()
    
    let factoryAbi = getAbi('./artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json')
    let factoryAddress = '0x69268B5859E0E1081254ECe7399449685235047d'
    const factory = new ethers.Contract(factoryAddress, factoryAbi, accounts[0])

    // await factory.setFeeTo(accounts[1].address)
    console.log('Factory now feeTo:', await factory.feeTo())

    //查看池子
    let allPairsLength = await factory.allPairsLength()
    console.log('allPairsLength:', allPairsLength.toNumber())
    if (allPairsLength == 0) {
        return
    }

    let pairAddress = await factory.allPairs(1)
    console.log('pairAddress:', pairAddress)

    let pairAbi = getAbi('./artifacts/contracts/UniswapV2Pair.sol/UniswapV2Pair.json')
    const pair = new ethers.Contract(pairAddress, pairAbi, accounts[0])
    let reserves = await pair.getReserves()
    console.log('reserves:', reserves[0].toString(), reserves[1].toString(), reserves[2])

    //查看lptoken
    let bal0 = await pair.balanceOf(accounts[0].address)
    console.log('bal0', e(bal0))

    let bal1 = await pair.balanceOf(accounts[1].address)
    console.log('bal1', e(bal1))

    let bal2 = await pair.balanceOf(accounts[2].address)
    console.log('bal2', e(bal2))

    // await pair.burn(accounts[0].address, {gasLimit:BigNumber.from('8000000')})

    console.log('done')
}


function e(amount) {
    return amount.div('1000000000000000000').toString()
}


function getAbi(jsonPath) {
    let file = fs.readFileSync(jsonPath)
    let abi = JSON.parse(file.toString()).abi
    return abi
}


main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })