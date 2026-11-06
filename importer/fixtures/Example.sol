// SPDX-License-Identifier: MIT
// Authored for ATLAS importer tests. Not copied from any third-party source.
pragma solidity ^0.8.24;

interface IExample {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
    function deposit() external payable;
    function fixedArray(uint256[2] calldata values) external;
    function dynamicArray(bytes32[] memory values) external;
    function many_msg_babbage(bytes1 value) external;
}

abstract contract BaseExample {
    function internalOnly() internal {}

    function privateOnly() private {}

    function publicEntry(address payable recipient) public payable {}

    fallback() external {}

    receive() external payable {}
}
