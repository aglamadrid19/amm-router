pragma solidity =0.6.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor(string memory _name, string memory _symbol) public ERC20(_name, _symbol) {
        _mint(msg.sender, 10000000000 ether);
    }
}