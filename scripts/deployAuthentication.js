const { ethers, web3} = require("hardhat");
const fs = require('fs');
const path = require("path");
const { generateCredential } = require('../utilities/credential');
const { generateSymmetricKey, encrypt, splitString, encryptSymmetricKeyWithPublicKey} = require('../utilities/encryption');

async function main() {
    const accounts = await ethers.getSigners();
    const user = accounts[1];
    const userAddress = accounts[1].address;

    const web3Issuer = web3.eth.accounts.create();
    const issuerPrivateKey = web3Issuer.privateKey;
    const issuerAddress = web3Issuer.address;

    const issuer = new ethers.Wallet(issuerPrivateKey, ethers.provider);

    const funder = accounts[0];
    const fund = await funder.sendTransaction({
        to: issuerAddress,
        value: ethers.utils.parseEther("1.0")
    });
    await fund.wait();

    const addressesFilePath = path.join(__dirname, 'deployedAddresses.json');
    const addresses = JSON.parse(fs.readFileSync(addressesFilePath, 'utf8'));

    const identityRegAddress = addresses.identityReg;
    const IdentityRegistry = await ethers.getContractFactory('DID');
    const identityReg = IdentityRegistry.attach(identityRegAddress);

    const yourDID = "did:example:123456";

    const fingerprint1Path = path.join(__dirname, '..', 'biometrics', 'fingerprint1.json');
    const fingerprintRegistration = JSON.stringify(JSON.parse(fs.readFileSync(fingerprint1Path)));

    const secretKey = generateSymmetricKey();
    const fingerprintEncrypted = encrypt(fingerprintRegistration, secretKey);
    const [localFingerprintEncrypted, submittedFingerprintEncrypted] = splitString(fingerprintEncrypted);

    const encryptedSecretKey = encryptSymmetricKeyWithPublicKey(secretKey);

    const tx = await identityReg.connect(user).register(userAddress, yourDID, submittedFingerprintEncrypted);
    await tx.wait();

    const credentialRegAddress = addresses.credentialReg;
    const CredentialRegistry = await ethers.getContractFactory('Credentials');
    const credentialReg = CredentialRegistry.attach(credentialRegAddress);

    const holderInfo = { some: "info" };
    const epoch = Math.floor(Date.now() / 1000);
    const [credential, credentialHash, sig] = await generateCredential(holderInfo, userAddress, issuerAddress, issuerPrivateKey, epoch);

    const addCredentialTx = await credentialReg.connect(issuer).addCredential(
        credential.id,
        credential.issuer,
        credential.holder,
        credentialHash,
        sig
    );
    await addCredentialTx.wait();

    const fingerprint2Path = path.join(__dirname, '..', 'biometrics', 'fingerprint2.json');
    const fingerprintAuthentication = JSON.stringify(JSON.parse(fs.readFileSync(fingerprint2Path)));

    const fingerprintAuthEncrypted = encrypt(fingerprintAuthentication, secretKey);

    const txRequestAuth = await credentialReg.connect(user).requestCredential(userAddress, credential.id, fingerprintAuthEncrypted, localFingerprintEncrypted, encryptedSecretKey);
    const receipt = await ethers.provider.waitForTransaction(txRequestAuth.hash);
    const gasUsed = receipt.gasUsed;
    const gasPrice = await web3.eth.getGasPrice();
    const gasCostETH = web3.utils.fromWei((gasUsed * gasPrice).toString(), 'ether');
    console.log('Authentication requested for user:', userAddress);
    console.log(`Request Credential Authentication Gas Used: ${gasUsed.toString()}`);
    console.log(`Gas Cost in ETH: ${gasCostETH}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
