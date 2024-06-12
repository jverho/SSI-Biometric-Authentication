const Web3 = require('web3');
const web3 = new Web3('ws://127.0.0.1:8545'); // Use IPv4 explicitly
const contractABI = require('../artifacts/contracts/CredentialRegistry.sol/Credentials.json').abi; // Adjust the path as necessary
const contractAddress = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'; // Replace with actual deployed address
const CredentialRegistry = new web3.eth.Contract(contractABI, contractAddress);
const { matchFingerprints } = require('./matcher'); // Import the matching function
const fs = require('fs');
const path = require('path');

async function startListener() {
    try {
        const accounts = await web3.eth.getAccounts();
        const credentialRegistryAccount = accounts[0];

        // Listen for the AuthenticationRequest event
        CredentialRegistry.events.AuthenticationRequest({
            fromBlock: 0
        }, async function(error, event) {
            if (error) {
                console.error(error);
                return;
            }

            const { user, _credId, submittedInfo, storedInfo } = event.returnValues;

            // Parse the JSON strings into JavaScript objects
            const submittedFingerprint = JSON.parse(submittedInfo);
            const storedFingerprint = JSON.parse(storedInfo);

            // Perform the matching off-chain
            const success = matchFingerprints(storedFingerprint, submittedFingerprint);
            console.log("Match Result:", success);

            // Send the authentication result back to the contract
            CredentialRegistry.methods.handleAuthenticationResult(user, _credId, success)
                .send({ from: credentialRegistryAccount })
                .on('receipt', function(receipt) {
                    console.log('Authentication result sent:', receipt);
                })
                .on('error', console.error);
        });

        console.log('Listener started, waiting for events...');
    } catch (error) {
        console.error('Error starting listener:', error);
    }
}

startListener();
