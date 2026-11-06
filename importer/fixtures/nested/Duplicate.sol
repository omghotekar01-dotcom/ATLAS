// SPDX-License-Identifier: MIT
// Authored for ATLAS importer tests. Not copied from any third-party source.
pragma solidity ^0.8.24;

interface IDuplicate {
    event Transfer(address indexed from, address indexed to, uint256 value);

    function transfer(address to, uint256 amount) external returns (bool);
}
