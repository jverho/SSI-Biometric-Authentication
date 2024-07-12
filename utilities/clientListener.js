const Web3 = require('web3');
const web3 = new Web3('ws://127.0.0.1:8545'); // Use IPv4 explicitly
const contractABI = require('../artifacts/contracts/CredentialRegistry.sol/Credentials.json').abi;
const contractAddress = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'; // Credential Registry address
const Credentials = new web3.eth.Contract(contractABI, contractAddress);
const { verifySignature } = require('./credential');

async function listenForCredentials(userAddress) {
    // Listen for the credential issuance event
    Credentials.events.CredentialIssued({
        filter: { user: userAddress },
        fromBlock: 'latest'
    }, function(error, event) {
        if (error) {
            console.error(error);
            return;
        }

        // getting the return values from the event
        const { result, user, issuer, holder, credHash, signature } = event.returnValues;
        // console.log(Date.now());

        // if the result is true receive the credential and verify it
        if (result) {
            let sig = JSON.parse(signature);
            console.log(`Credential for ${user}:`);
            console.log(`Issuer: ${issuer}`);
            console.log(`Holder: ${holder}`);
            //console.log(`Credential Hash: ${credHash}`);
            console.log(`Signature: ${JSON.stringify(sig)}`);
            // credential is received by the client device and could be given to verifier

            // verifier verifies the credential
            verifySignature(credHash, sig.signature, issuer);
        }
        else{
            console.log("Authentication did not work! Biometrics did not match!")
        }
    });
    console.log("Client Receiver started and waiting for events...");
}

listenForCredentials('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'); // User address



