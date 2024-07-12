var bigInt = require("big-integer");

const { web3, assert, artifacts } = require("hardhat");
const { generateCredential } = require("../utilities/credential.js");
const { encrypt, decrypt, generateSymmetricKey} = require('../utilities/encryption');

const path = require("path");
const fs = require("fs");
const {matchFingerprints} = require("../utilities/matcher");
const { spawn } = require('child_process');
const {verifySignature} = require("../utilities/credential");

// using the following approach for testing:
// https://hardhat.org/hardhat-runner/docs/other-guides/truffle-testing

const DID = artifacts.require("DID");
const Cred = artifacts.require("Credentials");
const Admin = artifacts.require("AdminAccounts");
const Issuer = artifacts.require("IssuerRegistry");
const SubAcc = artifacts.require("SubAccumulator");
const Acc = artifacts.require("Accumulator");
const Auth = artifacts.require("Authentication");

const contractABI = require('../artifacts/contracts/CredentialRegistry.sol/Credentials.json').abi;

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
    let credential;
    let credentialHash;
    let sig;

    let listenerProcess;
    let clientProcess;

    before(async function () {
        accounts = await web3.eth.getAccounts();
        holder = accounts[1];
        // issuer = accounts[2];
        // create an account with public/private keys
        issuer_ = web3.eth.accounts.create();
        issuer_Pri = issuer_.privateKey;
        issuer = issuer_.address;

        // Start the listener process
        listenerProcess = spawn('node', ['utilities/authenticator.js']);
        listenerProcess.stdout.on('data', (data) => {
            console.log(`Listener: ${data}`);
        });
        listenerProcess.stderr.on('data', (data) => {
            console.error(`Listener error: ${data}`);
        });
    });

    after(async function () {
        listenerProcess.kill();

    });

    describe("Deployment", function () {
        it('Deploying the Admin registry contract', async () => {
            adminRegistryInstance = await Admin.new();
            await web3.eth.getBalance(adminRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
        });

        it('Deploying the Issuers Registry contract', async () => {
            console.time('Issuer Registry Deployment Time');
            issuerRegistryInstance = await Issuer.new(adminRegistryInstance.address);
            await web3.eth.getBalance(issuerRegistryInstance.address).then((balance) => {
                assert.equal(balance, 0, "check balance of the contract");
            });
            console.timeEnd('Issuer Registry Deployment Time');
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
            await issuerRegistryInstance.addIssuer(issuer);
        });
    });

    describe("Identity Register", function () {
        it('Registering the identity with contract, and half of the fingerprint', async () => {
            let now = new Date();
            let method = "example"; // The DID method you are using
            let uniqueIdentifier = web3.utils.sha3(issuer + Date.now()); // create a unique identifier
            let ubaasDID = `did:${method}:${uniqueIdentifier}`; // put the DID together

            secretKey = generateSymmetricKey();

            const fingerprint1Path = path.join(__dirname, '..', 'biometrics', 'fingerprint30Registration.json');
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
            const fingerprint2Path = path.join(__dirname, '..', 'biometrics', 'fingerprint30Authentication.json');
            fingerprintAuthentication = JSON.parse(fs.readFileSync(fingerprint2Path));

            // concatenate the encrypted seperated fingerprint and decrypt it
            const decryptedInfo = decrypt(localAdditionalInfo+registeredAdditionalInfo, secretKey);
            console.log("decrypted info:", decryptedInfo);
            let fingerprintConcatenated = JSON.parse(decryptedInfo);

            // check that the fingerprint matches
            let authenticationResult = matchFingerprints(fingerprintConcatenated, fingerprintAuthentication)
            assert.isTrue(authenticationResult, "User should be authenticated with valid biometric");
        });

        it('Not matching fingerprints', async () => {

            // select the fingerprint that does not match
            const fingerprint3Path = path.join(__dirname, '..', 'biometrics', 'fingerprint30AuthenticationNotMatching.json');
            const fingerprintNonMatch = JSON.parse(fs.readFileSync(fingerprint3Path));

            // concatenate the encrypted seperated fingerprint and decrypt it
            const decryptedInfo = decrypt(localAdditionalInfo+registeredAdditionalInfo, secretKey);
            let fingerprintConcatenated = JSON.parse(decryptedInfo);

            // check that the fingerprint does NOT match
            let authenticationResult = matchFingerprints(fingerprintConcatenated, fingerprintNonMatch);
            assert.isFalse(authenticationResult, "User should not be authenticated with invalid biometric");
        });
    });

    describe("Credential", function () {
        it('Verifying a credential', async () => {
            console.log("Issuer address:", issuerAddress);
            console.log("Holder address:", holder);
            console.log("Issuer private key:", issuerPrivateKey);
            console.log("Checking private key leads to address", web3.eth.accounts.privateKeyToAccount(issuerPrivateKey).address);

            const [credential, credentialHash, sig] = await generateCredential("some claim", holder, issuerAddress, issuerPrivateKey);

            const recoveredAddress = web3.eth.accounts.recover(credentialHash, sig);

            console.log("recovered address in test:", recoveredAddress);

            await verifySignature(credentialHash, sig, issuerAddress);
        });
    });

    describe("Listener Functionality Test", function () {
        it('Listener should handle AuthenticationRequest event correctly', async () => {

            const epoch = Math.floor(Date.now() / 1000); // Current timestamp as epoch
            const holderInfo = { some: "info" }; // Replace with actual holder info
            [credential, credentialHash, sig] = await generateCredential(holderInfo, holder, issuer, issuer_Pri, epoch);

            await credRegistryInstance.addCredential(
                credential.id,
                credential.issuer,
                credential.holder,
                credentialHash,
                sig,
            );

            // Use WebSocket provider for event subscription
            const Web3 = require('web3');
            const web3Ws = new Web3('ws://127.0.0.1:8545'); // Use the same WebSocket provider
            const contractABI = require('../artifacts/contracts/CredentialRegistry.sol/Credentials.json').abi;
            const contractAddress = credRegistryInstance.address;
            const Credentials = new web3Ws.eth.Contract(contractABI, contractAddress);

            console.log("Setting up event listener...");


            // Return a promise that resolves when the event is caught
            const eventPromise = new Promise((resolve, reject) => {
                console.log("Setup Promise...")
                Credentials.events.CredentialIssued({
                    fromBlock: 'latest'
                }, function (error, event) {
                    if (error) {
                        console.error("Event listener error:", error);
                        reject(error);
                        return;
                    }

                    console.log("Event: ", event);
                    assert.equal(event.returnValues.user, holder, "Event user should match the holder");
                    assert.equal(event.returnValues.issuer, credential.issuer, "Event issuer should match the credential issuer");
                    assert.equal(event.returnValues.holder, credential.holder, "Event holder should match the credential holder");
                    assert.equal(event.returnValues.credHash, credentialHash, "Event credential hash should match");
                    assert.equal(event.returnValues.signature, sig.signature, "Event signature should match");
                    resolve(event);
                });
            });

            await credRegistryInstance.requestCredential(holder, credential.id, fingerprintRegistration, localAdditionalInfo, secretKey);

            // Wait for the event to be caught or timeout
            const timeoutPromise = new Promise(resolve => setTimeout(resolve, 20000, 'timeout'));

            const result = await Promise.race([eventPromise, timeoutPromise]);

            assert.notEqual(result, 'timeout', "Event listener timed out");
        });
    });
});
