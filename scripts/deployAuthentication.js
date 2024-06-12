const { ethers } = require("hardhat");
const fs = require('fs');
const path = require("path");
const { generateCredential } = require('../utilities/credential'); // Import the utility functions

async function main() {
    // Use the second account (Account #1) for this operation
    const accounts = await ethers.getSigners();
    const user = accounts[1];
    const userAddress = accounts[1].address;
    const issuer = accounts[0]; // Use the first account as the issuer
    const issuerAddress = accounts[0].address;
    const issuerPrivateKey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Replace with the actual private key


    const addressesFilePath = path.join(__dirname, 'deployedAddresses.json');
    const addresses = JSON.parse(fs.readFileSync(addressesFilePath, 'utf8'));

    // Address of the deployed DID Registry contract
    const identityRegAddress = addresses.identityReg;

    // Get the DID contract factory and attach to the deployed address
    const IdentityRegistry = await ethers.getContractFactory('DID');
    const identityReg = IdentityRegistry.attach(identityRegAddress);

    // Define your DID
    const yourDID = "did:example:123456"; // Example DID

    const fingerprint1Path = path.join(__dirname, '..', 'biometrics', 'fingerprint1.json');
    const fingerprintRegistration = JSON.stringify(JSON.parse(fs.readFileSync(fingerprint1Path)));

    // Register the DID
    const tx = await identityReg.connect(user).register(userAddress, yourDID, fingerprintRegistration);
    await tx.wait(); // Wait for the transaction to be mined

    console.log("DID", yourDID, "has been registered for address", userAddress, "with the fingerprint", fingerprintRegistration);

    const credentialRegAddress = addresses.credentialReg;
    const CredentialRegistry = await ethers.getContractFactory('Credentials');
    const credentialReg = CredentialRegistry.attach(credentialRegAddress);

    // Generate the credential
    const holderInfo = { some: "info" }; // Replace with actual holder info
    const epoch = Math.floor(Date.now() / 1000); // Current timestamp as epoch
    const [credential, credentialHash, sig] = await generateCredential(holderInfo, userAddress, issuerAddress, issuerPrivateKey, epoch);

    console.log("credential:", credential);
    console.log("credentialHash:", credentialHash)
    console.log("signature:", sig);

    // Add the credential to the registry
    const addCredentialTx = await credentialReg.connect(issuer).addCredential(
        credential.id,
        credential.issuer,
        credential.holder,
        credentialHash,
        sig,
        3600, // validity (e.g., 1 hour in seconds)
        epoch
    );
    await addCredentialTx.wait(); // Wait for the transaction to be mined

    console.log(`Credential added for user: ${userAddress}`);


    // Send the request authentication transaction
    const txRequestAuth = await credentialReg.connect(user).requestCredential(userAddress, credential.id, fingerprintRegistration);
    await txRequestAuth.wait();
    //console.log(`Authentication requested for user: ${userAddress} with info: ${fingerprintRegistration}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
