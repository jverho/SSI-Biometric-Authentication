const { ethers, web3} = require("hardhat");
const fs = require('fs');
const path = require("path");
const { generateCredential } = require('../utilities/credential');
const { generateSymmetricKey, encrypt, splitString, encryptSymmetricKeyWithPublicKey} = require('../utilities/encryption');

async function main() {
    // creating the user account
    const accounts = await ethers.getSigners();
    const user = accounts[1];
    const userAddress = accounts[1].address;

    // creating an issuer account
    const web3Issuer = web3.eth.accounts.create();
    const issuerPrivateKey = web3Issuer.privateKey;
    const issuerAddress = web3Issuer.address;
    const issuer = new ethers.Wallet(issuerPrivateKey, ethers.provider);

    // sending funds to the issuer account
    const funder = accounts[0];
    const fund = await funder.sendTransaction({
        to: issuerAddress,
        value: ethers.utils.parseEther("1.0")
    });
    await fund.wait();

    // getting the addresses from the deployed smart contracts
    const addressesFilePath = path.join(__dirname, 'deployedAddresses.json');
    const addresses = JSON.parse(fs.readFileSync(addressesFilePath, 'utf8'));

    // setting up the DID Registry
    const identityRegAddress = addresses.identityReg;
    const IdentityRegistry = await ethers.getContractFactory('DID');
    const identityReg = IdentityRegistry.attach(identityRegAddress);

    // setting up the fingerprint information for registration
    const fingerprint1Path = path.join(__dirname, '..', 'biometrics', 'fingerprint80Registration.json');
    const fingerprintRegistration = JSON.stringify(JSON.parse(fs.readFileSync(fingerprint1Path)));

    // generating the symmetric key, encrypting the fingerprint and splitting the encrypted string
    const secretKey = generateSymmetricKey();
    const fingerprintEncrypted = encrypt(fingerprintRegistration, secretKey);
    const [localFingerprintEncrypted, submittedFingerprintEncrypted] = splitString(fingerprintEncrypted);

    // encrypt the symmetric key
    const encryptedSecretKey = encryptSymmetricKeyWithPublicKey(secretKey);

    // registering a DID
    const gasPrice = await web3.eth.getGasPrice();
    let receipt, gasUsed, gasCostETH;
    const yourDID = "did:example:123456";
    const tx = await identityReg.connect(user).register(userAddress, yourDID, submittedFingerprintEncrypted);
    receipt = await ethers.provider.waitForTransaction(tx.hash);
    gasUsed = receipt.gasUsed;
    gasCostETH = web3.utils.fromWei((gasUsed * gasPrice).toString(), 'ether');
    console.log(`DID Registered to the address: ${userAddress}`);
    // console.log(`Registering of DID Gas Usage: ${gasUsed.toString()}`);
    // console.log(`Registering of DID Gas Cost in ETH: ${gasCostETH}`);

    // setting up the Credential Registry
    const credentialRegAddress = addresses.credentialReg;
    const CredentialRegistry = await ethers.getContractFactory('Credentials');
    const credentialReg = CredentialRegistry.attach(credentialRegAddress);

    // generating a credential for the DID
    const holderInfo = { some: "info" };
    const [credential, credentialHash, sig] = await generateCredential(holderInfo, userAddress, issuerAddress, issuerPrivateKey);

    // adding a credential to the DID
    const addCredentialTx = await credentialReg.connect(issuer).addCredential(
        credential.id,
        credential.issuer,
        credential.holder,
        credentialHash,
        sig
    );
    receipt = await ethers.provider.waitForTransaction(addCredentialTx.hash);
    gasUsed = receipt.gasUsed;
    gasCostETH = web3.utils.fromWei((gasUsed * gasPrice).toString(), 'ether');
    console.log(`Credential added to the DID: ${credential.holder}`);
    // console.log(`Adding Credential Gas Usage: ${gasUsed.toString()}`);
    // console.log(`Adding Credential Gas Cost in ETH: ${gasCostETH}`);

    // setting up the fingerprint information for the authentication
    const fingerprint2Path = path.join(__dirname, '..', 'biometrics', 'fingerprint80Authentication.json');
    const fingerprintAuthentication = JSON.stringify(JSON.parse(fs.readFileSync(fingerprint2Path)));
    const fingerprintAuthEncrypted = encrypt(fingerprintAuthentication, secretKey);

    // requesting a credential, thereby requesting authentication
    // console.log(Date.now());
    const txRequestAuth = await credentialReg.connect(user).requestCredential(userAddress, credential.id, fingerprintAuthEncrypted, localFingerprintEncrypted, encryptedSecretKey);
    receipt = await ethers.provider.waitForTransaction(txRequestAuth.hash);
    gasUsed = receipt.gasUsed;
    gasCostETH = web3.utils.fromWei((gasUsed * gasPrice).toString(), 'ether');
    console.log('Authentication requested for user:', userAddress);
    // console.log(`Request Credential Authentication Gas Used: ${gasUsed.toString()}`);
    // console.log(`Gas Cost in ETH: ${gasCostETH}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
