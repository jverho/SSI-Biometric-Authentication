const { ethers } = require("hardhat");
const { web3 } = require("hardhat");
const fs = require('fs');
const path = require("path");
const { generateCredential } = require('../utilities/credential');
const { generateSymmetricKey, encrypt, splitString } = require('../utilities/encryption');

async function main() {
    const accounts = await ethers.getSigners();
    const user = accounts[1];
    const userAddress = accounts[1].address;

    // Create a new account for the issuer using web3
    const web3Issuer = web3.eth.accounts.create();
    const issuerPrivateKey = web3Issuer.privateKey;
    const issuerAddress = web3Issuer.address;

    // Create an ethers signer from the private key
    const issuer = new ethers.Wallet(issuerPrivateKey, ethers.provider);

    // Fund the issuer account from a pre-funded account
    const funder = accounts[0];
    const fund = await funder.sendTransaction({
        to: issuerAddress,
        value: ethers.utils.parseEther("1.0") // Send 1 ETH
    });
    await fund.wait();

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

    //Encrypt the fingerprint
    const secretKey = generateSymmetricKey();
    const fingerprintEncrypted = encrypt(fingerprintRegistration, secretKey);
    const [localFingerprintEncrypted, submittedFingerprintEncrypted] = splitString(fingerprintEncrypted);

    // Register the DID
    const tx = await identityReg.connect(user).register(userAddress, yourDID, submittedFingerprintEncrypted);
    await tx.wait(); // Wait for the transaction to be mined

    console.log("DID", yourDID, "has been registered for address", userAddress);

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

    // Second fingerprint for authentication
    const fingerprint2Path = path.join(__dirname, '..', 'biometrics', 'fingerprint2.json');
    const fingerprintAuthentication = JSON.stringify(JSON.parse(fs.readFileSync(fingerprint2Path)));

    // Send the request authentication transaction
    const txRequestAuth = await credentialReg.connect(user).requestCredential(userAddress, credential.id, fingerprintAuthentication, localFingerprintEncrypted, secretKey);
    await txRequestAuth.wait();
    console.log('Authentication requested for user:', userAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
