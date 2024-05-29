
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DIDRegistry.sol";

contract Authentication {
    DID private didRegistry;

    constructor(address _didRegistry) {
        didRegistry = DID(_didRegistry);
    }

    function authenticate(address _id, string memory _submittedInfo) public view returns (bool) {
        string memory storedAdditionalInfo = didRegistry.getInfo(_id);
        return keccak256(abi.encodePacked(storedAdditionalInfo)) == keccak256(abi.encodePacked(_submittedInfo));
    }

/*
    function presentCredential(string memory _credId) public view returns (string memory, string memory, string memory, string memory) {
        return credentials.getCredential(_credId);
    }
    */
}
