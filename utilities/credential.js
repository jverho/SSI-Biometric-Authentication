// var Web3 = require('web3');

var crypto = require('crypto');
var util = require('ethereumjs-util');
const {web3} = require("hardhat");

async function generateCredential(holderInfo, holderAccount, issuerAccount, issuerPrivateKey, epoch) {

    let now = new Date(); 
    // holder info should be different to make sure hash is different for each credential
    let credentialID = web3.utils.sha3(issuerAccount + now + holderInfo); 

    // Create the credential. Whatever the id repo query responded with is now the claim.
    var credential = {
        "id": credentialID, 
        "holder": holderAccount,
        "issuer": issuerAccount, 
        "created": now.toLocaleDateString(),
        "epoch": epoch, 
        "claim": holderInfo, 
    };

    // the previous did not work, replaced with using web3 utilities sha and sign 
    let credentialHash = web3.utils.sha3(JSON.stringify(credential));
    let sig = await web3.eth.accounts.sign(credentialHash, issuerPrivateKey);
    let signature = JSON.stringify(sig);

    return [ credential, credentialHash, signature ];
}

// verify the Signature
async function verifySignature(credHash, signature, expectedIssuerAddress) {
    // Recover the signer's address from the signature and the credHash
    let recoveredAddress = web3.eth.accounts.recover(credHash, signature);
    console.log("Recovered address:", recoveredAddress);
    console.log("Expected address:", expectedIssuerAddress);

    // Compare the recovered address with the expected issuer address
    if (recoveredAddress.toLowerCase() === expectedIssuerAddress.toLowerCase()) {
        console.log('Signature is valid and matches the expected issuer address.');
    } else {
        console.log('Signature is invalid or does not match the expected issuer address.');
    }

}



module.exports = {
    generateCredential,
    verifySignature
}