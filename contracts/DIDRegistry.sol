// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract DID {
    
    struct DDO {                                // DID Document
        address id;                             // ethereum address of identity owner 
        address owner;                          // original identity owner

        string did;                             // did method

        string additionalInfo;                  // field to store additional information for authentication
    }

    mapping (address => DDO) private identity;  // DID has a single DDO
    mapping (address => bool) registered;

    modifier onlyOwner (address _id) { require(msg.sender == identity[_id].owner); _; }


    /* DID DOCUMENT FUNCTIONS ----------------------------------------------------------------------------------------- */

    function register(address _id, string memory _did, string memory _additionalInfo) public {
        require(registered[_id] == false, "the DID document already exists");
        registered[_id] = true;
        identity[_id].id = _id;
        identity[_id].owner = msg.sender;
        identity[_id].did = _did;
        identity[_id].additionalInfo = _additionalInfo; // Store the additional information
    }


    function getInfo(address _id) public view returns(string memory) {
        return  identity[_id].additionalInfo;
    }


    function getDID(address _id) public view returns(string memory) {
        return (identity[_id].did); 
    }
}