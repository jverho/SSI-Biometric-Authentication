// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AdminAccountRegistry.sol"; 

contract IssuerRegistry {

    mapping(address => bool) public registry;

    address adminRegistryAddress; 

    constructor(address _adminRegistryAddress) {
        adminRegistryAddress = _adminRegistryAddress; 
    }

    // modifier onlyAdmin() { require(AdminAccounts(adminRegistryAddress).isAdmin(msg.sender)); _; }

    // Admin rights could be implemented
    function addIssuer(address _address) public /*onlyAdmin()*/ {
        registry[_address] = true; 
    }

    function deleteIssuer(address _address) public /*onlyAdmin()*/ {
        delete registry[_address]; 
    }

    function checkIssuer(address _address) external view returns(bool) {
        if (registry[_address]) { return true; }
        return false; 
    }

}