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
    let sig = await web3.eth.accounts.sign(credentialHash, '0x' + issuerPrivateKey);

    return [ credential, credentialHash, sig ];
}


module.exports = { generateCredential }