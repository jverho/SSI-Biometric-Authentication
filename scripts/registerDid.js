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
    const yourDID = "did:example:123456"; // Example DID

   // Generate a random string as additional information
    const additionalInfo = generateRandomString(16); // Adjust the length as needed
    // console.log("Random string before encryption:", additionalInfo);
    const additionalInfo1 = additionalInfo.substring(0, (additionalInfo.length/2));
    const additionalInfo2 = additionalInfo.substring((additionalInfo.length/2));
    console.log("Info 1/2:", additionalInfo1);
    console.log("Info 2/2:", additionalInfo2);

    /*
    // For testing of facial landmarks
    const landmarks = [{ x: 123, y: 456 }, { x: 789, y: 321 }];
    const additionalInfo = JSON.stringify(landmarks);
    console.log('Landmarks as string:', additionalInfo);
     */

    // Define a secret key for encryption (should be securely managed in real scenarios)
    const secretKey = crypto.randomBytes(32); // 256-bit key
    console.log("secret key:", secretKey);

    // Encrypt the additional information 2
    const encryptedInfo = encrypt(additionalInfo2, secretKey);
    console.log("Encrypted information:", encryptedInfo);

    // Register the DID
    const tx = await identityReg.connect(accounts[1]).register(yourAddress, yourDID, encryptedInfo);
    await tx.wait(); // Wait for the transaction to be mined

    console.log("DID", yourDID,  "has been registered for address", yourAddress);

    // Decrypt the additional information (for demonstration)
    const decryptedInfo = decrypt(encryptedInfo, secretKey);
    console.log("Decrypted additional information:", decryptedInfo);

    // Concatenate additionalInfo1 and decryptedInfo
    const concatenatedInfo = additionalInfo1 + decryptedInfo;

    // Compare concatenatedInfo with original additionalInfo
    const isMatch = (concatenatedInfo === additionalInfo);

    if (isMatch) {
        console.log("The decrypted information matches the original additional information.");
        return true;
    } else {
        console.log("The decrypted information does not match the original additional information.");
        return false;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
