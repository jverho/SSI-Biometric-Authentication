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
            credRegistryInstance = await Cred.new(authenticatorInstance.address);
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
        it('Registering the identity with contract, 1/2 saved locally', async () => {
            let now = new Date();
            let method = "example"; // The DID method you are using
            let uniqueIdentifier = web3.utils.sha3(issuer + Date.now()); // create a unique identifier
            let ubaasDID = `did:${method}:${uniqueIdentifier}`; // put the DID together

            const secretKey = crypto.randomBytes(32); // 256-bit key

            additionalInfo = generateRandomString(16);

            encryptedInfo = encrypt(additionalInfo, secretKey);
            console.log("Additional info:", additionalInfo);
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

    describe("Authentication", function () {
        it('Authenticate user with valid additional info', async () => {
            let isAuthenticated = await authenticatorInstance.authenticateSeperated(holder, encryptedInfo, localAdditionalInfo);
            assert.isTrue(isAuthenticated, "User should be authenticated with valid additional info");
        });

        it('Fail to authenticate user with invalid additional info', async () => {
            let isAuthenticated = await authenticatorInstance.authenticateSeperated(holder, "wrongInfo", localAdditionalInfo);
            assert.isFalse(isAuthenticated, "User should not be authenticated with invalid additional info");
        });
    });

    describe("Present Credential", function() {
        it('Present a valid credential for an authenticated user, seperated Info', async () => {

            // Generate a credential
            const holderInfo = "Some credential information"; // Adjust this to match your use case
            const epoch = Math.floor(Date.now() / 1000); // Current epoch time
            const issuerPrivateKey = web3.eth.accounts.create().privateKey; // Generate a private key for the issuer
            const [credential, credentialHash, signature] = await generateCredential(holderInfo, holder, issuer, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", epoch);

            // Add the credential to the registry
            await credRegistryInstance.addCredential(credential.id, credential.issuer, credential.holder, credentialHash, signature, 3600, epoch);

            // users submit information in order to authenticate themselves and be able to present the credential
            const presentedCredential = await credRegistryInstance.presentCredentialSeperated(credential.id, encryptedInfo, localAdditionalInfo, { from: holder });
            console.log(presentedCredential);
            assert.equal(presentedCredential[0], credential.issuer, "Presented credential should match the generated credential");

        });
    });

});
