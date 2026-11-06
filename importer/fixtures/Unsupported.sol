// SPDX-License-Identifier: MIT
// Authored for ATLAS importer tests. Not copied from any third-party source.
pragma solidity ^0.8.24;

contract Unsupported {
    struct Point {
        uint256 x;
        uint256 y;
    }

    function move(Point memory point) external {}

    function callback(function(uint256) external returns (uint256) fn) external {}

    function constantLength(uint256[N] calldata values) external {}
}
