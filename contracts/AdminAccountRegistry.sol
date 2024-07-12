// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AdminAccounts {

    address admin;                          // current administrator of the platform

    modifier onlyAdmin() { require(msg.sender == admin); _; }

    // anyone can register as an admin - need modification 
    function registerAdmin() public {
        admin = msg.sender; 
    }

    function changeAdmin(address _newAdmin) public onlyAdmin() {
        admin = _newAdmin; 
    }

    function isAdmin(address _admin) public view returns(bool) {
        if (admin == _admin) { return true; }
        else { return false; }
    }
}