const { ethers } = require("hardhat");
const { gen } = require("../utilities/accumulator.js");
const { initBitmap } = require("../utilities/bitmap.js");
const fs = require('fs');
const path = require('path');

var bigInt = require("big-integer");

require("@nomiclabs/hardhat-web3");

async function main() {
    let capacity = 50;
    let [n, acc] = gen();
    let nHex = "0x" + bigInt(n).toString(16);
    let accHex = "0x" + bigInt(acc).toString(16);

    const IdentityRegistry = await ethers.getContractFactory('DID');
    const identityReg = await IdentityRegistry.deploy();
    await identityReg.deployed();
    console.log("DID Registry has been deployed to:", identityReg.address);

    const Authentication = await ethers.getContractFactory('Authentication');
    const authentication = await Authentication.deploy(identityReg.address);
    await authentication.deployed();
    console.log("Authentication contract has been deployed to:", authentication.address);

    const CredentialRegistry = await ethers.getContractFactory('Credentials');
    const credentialReg = await CredentialRegistry.deploy(authentication.address);
    await credentialReg.deployed();
    console.log("Credentials Registry has been deployed to:", credentialReg.address);

    const AdminRegistry = await ethers.getContractFactory('AdminAccounts');
    const adminReg = await AdminRegistry.deploy();
    await adminReg.deployed();
    console.log("Admins Registry has been deployed to:", adminReg.address);

    const IssuerRegistry = await ethers.getContractFactory('IssuerRegistry');
    const issuerReg = await IssuerRegistry.deploy(adminReg.address);
    await issuerReg.deployed();
    console.log("Issuers Registry has been deployed to:", issuerReg.address);

    const accounts = await ethers.getSigners();
    const userAddress = accounts[1].address;
    const userDID = "did:example:123456";
    const additionalInfo = "randomString"; // This should be generated or provided

    const txRegister = await identityReg.connect(accounts[1]).register(userAddress, userDID, additionalInfo);
    await txRegister.wait();
    console.log(`DID ${userDID} has been registered for address ${userAddress}`);

    const isAuthenticated = await authentication.connect(accounts[1]).authenticate(userAddress, additionalInfo);
    console.log(`Authentication result for ${userAddress}:`, isAuthenticated);

    if (isAuthenticated) {
        const credId = "credential-123";
        const credIssuer = "issuer-123";
        const credHolder = userDID;
        const credHash = "hash-of-credential";
        const credSignature = "signature-of-issuer";
        const credValidity = 3600; // 1 hour
        const credEpoch = Math.floor(Date.now() / 1000); // Current epoch time

        const txAddCredential = await credentialReg.addCredential(credId, credIssuer, credHolder, credHash, credSignature, credValidity, credEpoch);
        await txAddCredential.wait();
        console.log(`Credential ${credId} has been added for DID ${userDID}`);

        // Use the correct function to present the credential
        const presentedCredential = await credentialReg.connect(accounts[1]).presentCredential(credId, additionalInfo);
        console.log(`Presented Credential for ${credId}:`, presentedCredential);
    } else {
        console.log(`Authentication failed for user ${userAddress}. Cannot present credential.`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
