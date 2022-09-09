// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IWeightedPool
{
    function getPoolId() external view returns (bytes32);
    function balanceOf(address account) external view returns (uint256);
}