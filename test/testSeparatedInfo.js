const { web3, assert, artifacts } = require("hardhat");
const { generateCredential } = require("../utilities/credential.js");

const { generateRandomString, encrypt, decrypt } = require('../utilities/encryption');

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
    let issuer;

    let issuer_;
    let issuer_Pri;

    // contract instances
    let adminRegistryInstance;
    let issuerRegistryInstance;
    let didRegistryInstance;
    let credRegistryInstance;
    let authenticatorInstance;

    let additionalInfo;
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
            credRegistryInstance = await Cred.new(authenticatorInstance.address, didRegistryInstance.address);
            await web3.eth.getBalance(credRegistryInstance.address).then((balance) => {
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

            additionalInfo = generateRandomString(16);
            console.log("Complete info:", additionalInfo);
            registeredAdditionalInfo =  additionalInfo.substring((additionalInfo.length/2));
            localAdditionalInfo = additionalInfo.substring(0, (additionalInfo.length/2));

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
            let isAuthenticated = await authenticatorInstance.authenticateSeparated(holder, additionalInfo, localAdditionalInfo);
            assert.isTrue(isAuthenticated, "User should be authenticated with valid additional info");
        });

        it('Fail to authenticate user with invalid additional info', async () => {
            let isAuthenticated = await authenticatorInstance.authenticateSeparated(holder, "wrongInfo", localAdditionalInfo);
            assert.isFalse(isAuthenticated, "User should not be authenticated with invalid additional info");
        });
    });

    describe("Present Credential", function() {
        it('Present a valid credential for an authenticated user, separated Info', async () => {

            // Generate a credential
            const holderInfo = "Some credential information"; // Adjust this to match your use case
            const [credential, credentialHash, signature] = await generateCredential(holderInfo, holder, issuer, "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

            // Add the credential to the registry
            await credRegistryInstance.addCredential(credential.id, credential.issuer, credential.holder, credentialHash, signature);

            const presentedCredential = await credRegistryInstance.presentCredentialSeparated(credential.id, additionalInfo, localAdditionalInfo, { from: holder });
            console.log(presentedCredential);
            assert.equal(presentedCredential[0], credential.issuer, "Presented credential should match the generated credential");

        });
    });

});
