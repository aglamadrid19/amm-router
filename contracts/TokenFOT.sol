pragma solidity 0.6.6;

import "./BEP20.sol";

// UFFToken with Governance.
contract TokenFOT is BEP20 {
    // Transfer tax rate in basis points. (default 6%)
    uint16 public transferTaxRate = 600; // INMUTABLE
    mapping(address=>bool) isExcludedFromFee;

    /**z
     * @notice Constructs the UFF token contract.
     */
    constructor() public BEP20("United Farmers Finance", "UFF") {

    }

    /// @dev overrides transfer function to meet tokenomics of UFF
    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        if (isExcludedFromFee[sender] || isExcludedFromFee[recipient]) {
            super._transfer(sender, recipient, amount);
        }
        else {
            // default tax is 6% of every transfer
            uint256 taxAmount = amount.mul(transferTaxRate).div(10000);

            uint256 sendAmount = amount.sub(taxAmount);
            require(amount == sendAmount.add(taxAmount), "UFF::transfer: Tax value invalid");

            super._transfer(sender, address(this), taxAmount);
            super._transfer(sender, recipient, sendAmount);   
        }  
    }

    // UFF MOD - ADD ROUTER WHITELIST UTILS
    function excludeFromFee(address _token) public {
        require(!isExcludedFromFee[_token], "TOKENTWO: ALREADY EXCLUDED FROM FEE");
        isExcludedFromFee[_token] = true;
    }

    function removeFromWhiteList(address _token) public {
        require(isExcludedFromFee[_token], "TOKENTWO: ALREADY REMOVED FROM EXCLUDED FROM FEE");
        isExcludedFromFee[_token] = false;
    }
    
}