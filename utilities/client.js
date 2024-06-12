const Web3 = require('web3');
const {ethers} = require("hardhat");
const web3 = new Web3('ws://127.0.0.1:8545'); // Use the same WebSocket provider
const contractABI = require('../artifacts/contracts/CredentialRegistry.sol/Credentials.json').abi;
const contractAddress = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'; // Replace with actual deployed address
const Credentials = new web3.eth.Contract(contractABI, contractAddress);

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

        const { user, issuer, holder, credHash, signature } = event.returnValues;
        console.log(`Credential for ${user}:`);
        console.log(`Issuer: ${issuer}`);
        console.log(`Holder: ${holder}`);
        console.log(`Credential Hash: ${credHash}`);
        console.log(`Signature: ${signature}`);
    });
    console.log("Client Receiver started and listening...");
}
// at the moment address of accounts[1].address
// Example usage
listenForCredentials('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'); // Replace with actual user address



