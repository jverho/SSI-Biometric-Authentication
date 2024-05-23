const { ethers } = require("hardhat");
const fs = require('fs');
const path = require("path");
const crypto = require('crypto');
const { generateRandomString, encrypt, decrypt } = require('../utilities/encryption'); // Import the utility functions

async function main() {
    const addressesFilePath = path.join(__dirname, 'deployedAddresses.json');
    const addresses = JSON.parse(fs.readFileSync(addressesFilePath, 'utf8'));

    // Address of the deployed DID Registry contract
     const identityRegAddress = addresses.identityReg;

    // Get the DID contract factory and attach to the deployed address
    const IdentityRegistry = await ethers.getContractFactory('DID');
    const identityReg = IdentityRegistry.attach(identityRegAddress);

    // Use the second account (Account #1) for this operation
    const accounts = await ethers.getSigners();
    const yourAddress = accounts[1].address;

    // Define your DID
    const yourDID = "did:example:123456"; // Replace with your desired DID
    // Generate a random string as additional information
    const additionalInfo = generateRandomString(16); // Adjust the length as needed
    console.log("Random string before encryption:", additionalInfo);

    // Define a secret key for encryption (should be securely managed in real scenarios)
    const secretKey = crypto.randomBytes(32); // 256-bit key

    // Encrypt the additional information
    const encryptedInfo = encrypt(additionalInfo, secretKey);
    console.log("Encrypted information:", encryptedInfo);

    // Register the DID
    const tx = await identityReg.connect(accounts[1]).register(yourAddress, yourDID, encryptedInfo);
    await tx.wait(); // Wait for the transaction to be mined

    console.log("DID", yourDID,  "has been registered for address", yourAddress);

    // Decrypt the additional information (for demonstration)
    const decryptedInfo = decrypt(encryptedInfo, secretKey);
    console.log("Decrypted additional information:", decryptedInfo);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
