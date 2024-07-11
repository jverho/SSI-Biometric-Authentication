// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Authenticator.sol";
import "./DIDRegistry.sol";

contract Credentials {
    Authentication private authentication;
    DID private didRegistry;

    event CredentialIssued(bool result, address indexed user, string issuer, string holder, string credHash, string signature);
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
        bool uploaded;              // true: the ID is used and information uploaded
    }

    mapping (string => Credential) private credential; 

    // do we need to keep validity variable? 
    function addCredential(string memory _id, string memory _issuer, string memory _holder, string memory _credHash, string memory _signature) public {
        require (credential[_id].uploaded == false, "credential already exists");
        credential[_id].id = _id;
        credential[_id].issuer = _issuer; 
        credential[_id].holder = _holder; 
        credential[_id].credHash = _credHash;
        credential[_id].signature = _signature;
        credential[_id].uploaded = true; 
    }

    function presentCredential(string memory _credId, string memory _submittedInfo) public view returns (string memory, string memory, string memory, string memory) {
        require(authentication.authenticate(msg.sender, _submittedInfo), "User is not authenticated");
        return (credential[_credId].issuer, credential[_credId].holder, credential[_credId].credHash, credential[_credId].signature);
    }

    function presentCredentialSeparated(string memory _credId, string memory _submittedInfo, string memory _localInfo) public view returns (string memory, string memory, string memory, string memory) {
        require(authentication.authenticateSeparated(msg.sender, _submittedInfo, _localInfo), "User is not authenticated");
        return (credential[_credId].issuer, credential[_credId].holder, credential[_credId].credHash, credential[_credId].signature);
    }

    function requestCredential(address _id, string memory _credId, string memory _submittedInfo, string memory localInfo, string memory key) public {
        string memory storedAdditionalInfo = didRegistry.getInfo(msg.sender);
        emit AuthenticationRequest(_id, _credId, _submittedInfo, storedAdditionalInfo, localInfo, key);
    }

    function handleAuthenticationResult(address _id, string memory _credId, bool _result) public {
        if (_result) {
            // Logic to return the credential to the user
            emit CredentialIssued(_result, _id, credential[_credId].issuer , credential[_credId].holder, credential[_credId].credHash, credential[_credId].signature);
        }
        else{
            emit CredentialIssued(false, _id, "-" , "-", "-", "-");
        }
    }
}