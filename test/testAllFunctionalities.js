const { web3, assert, artifacts } = require("hardhat");
const { encrypt, decrypt, generateSymmetricKey, decryptSymmetricKeyWithPrivateKey, encryptSymmetricKeyWithPublicKey} = require('../utilities/encryption');

const path = require("path");
const fs = require("fs");
const {matchFingerprints} = require("../utilities/matcher");

// using the following approach for testing:
// https://hardhat.org/hardhat-runner/docs/other-guides/truffle-testing

const DID = artifacts.require("DID");
const Cred = artifacts.require("Credentials");
const Admin = artifacts.require("AdminAccounts");
const Issuer = artifacts.require("IssuerRegistry");
const Auth = artifacts.require("Authentication");

describe("DID Registry", function() {
    let accounts;
    let holder;

    let web3Issuer;
    let issuerPrivateKey;
    let issuerAddress;

    // contract instances
    let adminRegistryInstance;
    let issuerRegistryInstance;
    let didRegistryInstance;
    let credRegistryInstance;
    let authenticatorInstance;

    let encryptedInfo;
    let registeredAdditionalInfo;
    let localAdditionalInfo;

    let symmetricKey;
    let fingerprintRegistration;
    let fingerprintAuthentication;


    before(async function () {
        accounts = await web3.eth.getAccounts();
        holder = accounts[1];

        // Create an account with public/private keys
        web3Issuer = web3.eth.accounts.create();
        issuerPrivateKey = web3Issuer.privateKey;
        issuerAddress = web3Issuer.address;

        // Log and validate the issuer's account and private key
        console.log("Generated issuer account:", web3Issuer);
        console.log("Issuer private key:", issuerPrivateKey);
        console.log("Derived issuer address from private key:", web3.eth.accounts.privateKeyToAccount(issuerPrivateKey).address);

        // Validate that the derived address matches the generated address
        if (web3.eth.accounts.privateKeyToAccount(issuerPrivateKey).address.toLowerCase() !== issuerAddress.toLowerCase()) {
            throw new Error("Mismatch between derived address and issuer address");
        }
    });

    describe("Deployment", function () {
        it('Deploying the Admin registry contract', async () => {
            adminRegistryInstance = await Admin.new();
            await web3.eth.getBalance(adminRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying the Issuers Registry contract', async () => {
            issuerRegistryInstance = await Issuer.new(adminRegistryInstance.address);
            await web3.eth.getBalance(issuerRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying the DID Registry contract', async () => {
            didRegistryInstance = await DID.new();
            await web3.eth.getBalance(didRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying the Authenticator contract', async () => {
            authenticatorInstance = await Auth.new(didRegistryInstance.address);
            await web3.eth.getBalance(authenticatorInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying the Credential Registry contract', async () => {
            credRegistryInstance = await Cred.new(authenticatorInstance.address, didRegistryInstance.address);
            await web3.eth.getBalance(credRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
            console.log(credRegistryInstance.address);
        });
    });

    describe("Add issuer to the registry", function () {
        it('Adding issuer', async () => {
            await issuerRegistryInstance.addIssuer(issuerAddress);
        });
    });

    describe("Identity Register", function () {
        it('Registering the identity with contract, and half of the fingerprint', async () => {
            let method = "example";
            let uniqueIdentifier = web3.utils.sha3(issuerAddress + Date.now()); // create a unique identifier
            let ubaasDID = `did:${method}:${uniqueIdentifier}`; // put the DID together

            // create the symmetric key
            symmetricKey = generateSymmetricKey();

            const fingerprint1Path = path.join(__dirname, '..', 'biometrics', 'fingerprint30Registration.json');
            fingerprintRegistration = JSON.stringify(JSON.parse(fs.readFileSync(fingerprint1Path)));

            // encrypt the fingerprint minutiae data (fmp1)
            encryptedInfo = encrypt(fingerprintRegistration, symmetricKey);
            console.log("fmp1:", fingerprintRegistration);
            console.log("Encrypted fmp1:", encryptedInfo);

            //split encrypted fmp1 data into share 1/2 and 2/2
            registeredAdditionalInfo = encryptedInfo.substring((encryptedInfo.length / 2));
            localAdditionalInfo = encryptedInfo.substring(0, (encryptedInfo.length / 2));

            // register the DID with the share 2/2
            await didRegistryInstance.register(holder, ubaasDID, registeredAdditionalInfo);
            await didRegistryInstance.getInfo(holder).then((result) => {
                assert.exists(result, "check if DID was generated");
            });
        });
    });

    describe("Encryption/Decryption of symmetric key", function () {
        it('Encrypting the symmetric key', async () => {

            // encrypt the symmetric key
            const encryptedSymmetricKey = encryptSymmetricKeyWithPublicKey(symmetricKey);

            // check that the symmetric key was changed (encrypted)
            assert.isFalse(encryptedSymmetricKey===symmetricKey, "Encrypted Symmetric key should be different to symmetric key");

            // decrypt the encrypted symmetric key
            const decryptedSymmetricKey = decryptSymmetricKeyWithPrivateKey(encryptedSymmetricKey);

            // check that the decrypted symmetric key is the same as the original symmetric key
            assert.isTrue(decryptedSymmetricKey===symmetricKey, "The decrypted symmetric key should be the same as the original symmetric key")
        });
    });


    describe("Match fingerprints", function () {
        it('Matching fingerprints', async () => {
            // select matching fingerprint
            const fingerprint2Path = path.join(__dirname, '..', 'biometrics', 'fingerprint30Authentication.json');
            fingerprintAuthentication = JSON.parse(fs.readFileSync(fingerprint2Path));

            // concatenate the encrypted seperated fingerprint and decrypt it with the symmetric key
            const decryptedInfo = decrypt(localAdditionalInfo + registeredAdditionalInfo, symmetricKey);
            let fingerprintConcatenated = JSON.parse(decryptedInfo);

            // check that the fingerprint matches
            console.time("Match Fingerprint Time (30 Minutiae)")
            let authenticationResult = matchFingerprints(fingerprintConcatenated, fingerprintAuthentication)
            console.timeEnd("Match Fingerprint Time (30 Minutiae)")
            assert.isTrue(authenticationResult, "User should be authenticated with valid biometric");
        });

        it('Not matching fingerprints', async () => {
            // select the fingerprint that does not match
            const fingerprint3Path = path.join(__dirname, '..', 'biometrics', 'fingerprint30AuthenticationNotMatching.json');
            const fingerprintNonMatch = JSON.parse(fs.readFileSync(fingerprint3Path));

            // concatenate the encrypted seperated fingerprint and decrypt it
            const decryptedInfo = decrypt(localAdditionalInfo + registeredAdditionalInfo, symmetricKey);
            let fingerprintConcatenated = JSON.parse(decryptedInfo);

            // check that the fingerprint does NOT match
            console.time("Match Fingerprint Time (30 Minutiae) NOT MATCHING")
            let authenticationResult = matchFingerprints(fingerprintConcatenated, fingerprintNonMatch);
            console.timeEnd("Match Fingerprint Time (30 Minutiae) NOT MATCHING")
            assert.isFalse(authenticationResult, "User should not be authenticated with invalid biometric");
        });

        it('Matching fingerprints 80 minutiae points', async () => {
            // select registration fingerprint 80 minutiae points
            const fingerprint80Registration = path.join(__dirname, '..', 'biometrics', 'fingerprint80Registration.json');
            fingerprintRegistration = JSON.parse(fs.readFileSync(fingerprint80Registration));
            console.time("Fingerprint Encryption (80 Minutiae Points)")
            const fingerprintEncrypted = encrypt(JSON.stringify(fingerprintRegistration), symmetricKey);
            console.timeEnd("Fingerprint Encryption (80 Minutiae Points)")

            // select matching fingerprint
            const fingerprint80Authentication = path.join(__dirname, '..', 'biometrics', 'fingerprint80Authentication.json');
            fingerprintAuthentication = JSON.parse(fs.readFileSync(fingerprint80Authentication));

            // check that the fingerprint matches
            console.time("Fingerprint Decryption (80 Minutiae Points)")
            const fingerprintDecrypt = decrypt(fingerprintEncrypted, symmetricKey);
            console.timeEnd("Fingerprint Decryption (80 Minutiae Points)")
            let fingerprint = JSON.parse(fingerprintDecrypt);
            console.time("Match Fingerprint Time (80 Minutiae Points)")
            let authenticationResult = matchFingerprints(fingerprint, fingerprintAuthentication)
            console.timeEnd("Match Fingerprint Time (80 Minutiae Points)")
            assert.isTrue(authenticationResult, "User should be authenticated with valid biometric");
        });
    });
})