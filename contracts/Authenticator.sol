// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./DIDRegistry.sol";

// Authenticator contract used for authentication with strings used for matching
// This contract is not needed for the biometric authentication
contract Authentication {
    DID private didRegistry;

    constructor(address _didRegistry) {
        didRegistry = DID(_didRegistry);
    }

    function authenticate(address _id, string memory _submittedInfo) public view returns (bool) {
        string memory storedAdditionalInfo = didRegistry.getInfo(_id);
        return keccak256(abi.encodePacked(storedAdditionalInfo)) == keccak256(abi.encodePacked(_submittedInfo));
    }

    function authenticateSeparated(address _id, string memory _submittedInfo, string memory _localInfo) public view returns (bool) {
        string  memory storedAdditionalInfo = didRegistry.getInfo(_id);
        string  memory wholeInfo = string(abi.encodePacked(_localInfo, storedAdditionalInfo));
        return keccak256(abi.encodePacked(wholeInfo)) == keccak256(abi.encodePacked(_submittedInfo));
    }

}
