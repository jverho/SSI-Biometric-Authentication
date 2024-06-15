// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Authenticator.sol";
import "./DIDRegistry.sol";

contract Credentials {
    Authentication private authentication;
    DID private didRegistry;

    event CredentialIssued(address indexed user, string issuer, string holder, string credHash, string signature);
    event AuthenticationRequest(address indexed user, string _credId, string submittedInfo, string storedInfo, string localInfo, string key);


    constructor(address _authentication, address _didRegistry) {
        authentication = Authentication(_authentication);
        didRegistry = DID(_didRegistry);
    }

    struct Credential {             // verifiable claim 
        string id;              
        string issuer; 
        string holder; 
        string credHash; 
        string signature;           // issuer signature of the credential 
        uint256 validity;
        uint256 epoch;              // during which epoch the credential has been issued
        bool uploaded;              // true: the ID is used and infromation uploaded
    }

    address DIDRegistry;
    address issuerRegistry; 
    address owner; 

    mapping (string => Credential) private credential; 

    // do we need to keep validity variable? 
    function addCredential(string memory _id, string memory _issuer, string memory _holder, string memory _credHash, string memory _signature, uint256 _validity, uint256 _epoch) public {
        require (credential[_id].uploaded == false, "credential already exists");
        credential[_id].id = _id;
        credential[_id].issuer = _issuer; 
        credential[_id].holder = _holder; 
        credential[_id].credHash = _credHash;
        credential[_id].signature = _signature; 
        credential[_id].validity = _validity; 
        credential[_id].epoch = _epoch; 
        credential[_id].uploaded = true; 
    }

    function getCredential(string memory _id) public view returns (string memory, string memory, string memory, string memory) {
        return (credential[_id].issuer, credential[_id].holder, credential[_id].credHash, credential[_id].signature);
    }


    function presentCredential(string memory _credId, string memory _submittedInfo) public view returns (string memory, string memory, string memory, string memory) {
        require(authentication.authenticate(msg.sender, _submittedInfo), "User is not authenticated");
        return getCredential(_credId);
    }

    function presentCredentialSeparated(string memory _credId, string memory _submittedInfo, string memory _localInfo) public view returns (string memory, string memory, string memory, string memory) {
        require(authentication.authenticateSeparated(msg.sender, _submittedInfo, _localInfo), "User is not authenticated");
        return getCredential(_credId);
    }

    function requestCredential(address _id, string memory _credId, string memory _submittedInfo, string memory localInfo, string memory key) public {
        string memory storedAdditionalInfo = didRegistry.getInfo(msg.sender);
        emit AuthenticationRequest(_id, _credId, _submittedInfo, storedAdditionalInfo, localInfo, key);
    }

    function handleAuthenticationResult(address _id, string memory _credId, bool _result) public {
        // maybe add later for security
        //require(msg.sender == address(this), "Unauthorized");

        if (_result) {
            // Logic to return the credential to the user
            emit CredentialIssued(_id, credential[_credId].issuer , credential[_credId].holder, credential[_credId].credHash, credential[_credId].signature);
        }
    }


}