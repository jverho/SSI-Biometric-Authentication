var bigInt = require("big-integer");

const { web3, assert, artifacts } = require("hardhat");
const { generateCredential } = require("../utilities/credential.js");
const { gen, hashToPrime } = require("../utilities/accumulator.js");
const { initBitmap, addToBitmap, getBitmapData, getStaticAccData, checkInclusionBitmap, checkInclusionGlobal } = require("../utilities/bitmap.js");
const { storeEpochPrimes } = require("../utilities/epoch.js");
const { emptyProducts, emptyStaticAccData } = require("../utilities/product");
const { generateRandomString, encrypt, decrypt } = require('../utilities/encryption');

const { revoke, verify } = require("../revocation/revocation");
const {consoleLogToString} = require("hardhat/internal/hardhat-network/stack-traces/consoleLogger");
const crypto = require('crypto');
const path = require("path");
const fs = require("fs");
const {matchFingerprints} = require("../utilities/matcher");

// using the following approach for testing:
// https://hardhat.org/hardhat-runner/docs/other-guides/truffle-testing

const DID = artifacts.require("DID");
const Cred = artifacts.require("Credentials");
const Admin = artifacts.require("AdminAccounts");
const Issuer = artifacts.require("IssuerRegistry");
const SubAcc = artifacts.require("SubAccumulator");
const Acc = artifacts.require("Accumulator");
const Auth = artifacts.require("Authentication");


describe("DID Registry", function() {
    let accounts;
    let holder;
    let issuer;

    let issuer_;
    let issuer_Pri;

    // bitmap capacity
    let capacity = 30; // up to uin256 max elements

    // contract instances
    let adminRegistryInstance;
    let issuerRegistryInstance;
    let didRegistryInstance;
    let credRegistryInstance;
    let subAccInstance;
    let accInstance;
    let authenticatorInstance;

    let additionalInfo;
    let encryptedInfo;
    let registeredAdditionalInfo;
    let localAdditionalInfo;

    let secretKey;
    let fingerprintRegistration;
    let fingerprintAuthentication;

    before(async function () {
        accounts = await web3.eth.getAccounts();
        holder = accounts[1];
        // issuer = accounts[2];
        // create an account with public/private keys
        issuer_ = web3.eth.accounts.create();
        issuer_Pri = issuer_.privateKey;
        issuer = issuer_.address;
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
        });


        it('Deploying and generating bitmap', async () => {
            subAccInstance = await SubAcc.new(issuerRegistryInstance.address /*, accInstance.address*/);
            await web3.eth.getBalance(subAccInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });

            // calculate how many hash function needed and update in contract
            await initBitmap(subAccInstance, capacity);

            // clean up from previous tests
            emptyProducts();
            emptyStaticAccData();
        });

        it('Deploying and generating global accumulator', async () => {
            let [n, g] = gen();
            // when adding bytes to contract, need to concat with "0x"
            let nHex = "0x" + bigInt(n).toString(16); // convert back to bigInt with bigInt(nHex.slice(2), 16)
            let gHex = "0x" + bigInt(g).toString(16);

            accInstance = await Acc.new(issuerRegistryInstance.address, subAccInstance.address, gHex, nHex);
            await web3.eth.getBalance(accInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });
    });

    describe("Add issuer to the registry", function () {
        it('Adding issuer', async () => {
            await issuerRegistryInstance.addIssuer(issuer);
        });
    });

    describe("Identity Register", function () {
        it('Registering the identity with contract, and half of the fingerprint', async () => {
            let now = new Date();
            let method = "example"; // The DID method you are using
            let uniqueIdentifier = web3.utils.sha3(issuer + Date.now()); // create a unique identifier
            let ubaasDID = `did:${method}:${uniqueIdentifier}`; // put the DID together

            secretKey = crypto.randomBytes(32); // 256-bit key

            const fingerprint1Path = path.join(__dirname, '..', 'biometrics', 'fingerprint1.json');
            fingerprintRegistration = JSON.stringify(JSON.parse(fs.readFileSync(fingerprint1Path)));

            encryptedInfo = encrypt(fingerprintRegistration, secretKey);
            console.log("Additional info:", fingerprintRegistration);
            console.log("Encrypted info:", encryptedInfo);
            registeredAdditionalInfo =  encryptedInfo.substring((encryptedInfo.length/2)); //changed to encrypted
            localAdditionalInfo = encryptedInfo.substring(0, (encryptedInfo.length/2)); //changed to encrypted

            await didRegistryInstance.register(holder, ubaasDID, registeredAdditionalInfo);
            await didRegistryInstance.getInfo(holder).then((result) => {
                console.log("DID additional info:", result);
                assert.exists(result, "check if did was generated");
            });
            console.log("local info:", localAdditionalInfo);
        });
    });

    describe("Match fingerprints", function () {
        it('Matching fingerprints', async () => {

            // select matching fingerprint
            const fingerprint2Path = path.join(__dirname, '..', 'biometrics', 'fingerprint2.json');
            fingerprintAuthentication = JSON.parse(fs.readFileSync(fingerprint2Path));

            // concatenate the encrypted seperated fingerprint and decrypt it
            // do I need to get the registeredAdditionalInfo from the DID to simulate it more realistically?
            const decryptedInfo = decrypt(localAdditionalInfo+registeredAdditionalInfo, secretKey);
            console.log("decrypted info:", decryptedInfo);
            let fingerprintConcatenated = JSON.parse(decryptedInfo);

            // check that the fingerprint matches
            let authenticationResult = matchFingerprints(fingerprintConcatenated, fingerprintAuthentication)
            assert.isTrue(authenticationResult, "User should be authenticated with valid biometric");
        });

        it('Not matching fingerprints', async () => {

            // select the fingerprint that does not match
            const fingerprint3Path = path.join(__dirname, '..', 'biometrics', 'fingerprint3.json');
            const fingerprintNonMatch = JSON.parse(fs.readFileSync(fingerprint3Path));

            // concatenate the encrypted seperated fingerprint and decrypt it
            // do I need to het the registeredAdditionalInfo from the DID to simulate it more realistically?
            const decryptedInfo = decrypt(localAdditionalInfo+registeredAdditionalInfo, secretKey);
            let fingerprintConcatenated = JSON.parse(decryptedInfo);

            // check that the fingerprint does NOT match
            let authenticationResult = matchFingerprints(fingerprintConcatenated, fingerprintNonMatch);
            assert.isFalse(authenticationResult, "User should not be authenticated with invalid biometric");
        });
    });

});
