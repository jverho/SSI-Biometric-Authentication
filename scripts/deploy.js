// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const { gen } = require("../utilities/accumulator.js");
const { initBitmap } = require("../utilities/bitmap.js");
const fs = require('fs');
const path = require('path');

var bigInt = require("big-integer");

require("@nomiclabs/hardhat-web3");

async function main() {
	let capacity = 50;
	let [n, acc] = gen();
	// when adding bytes to contract, need to concat with "0x"
	let nHex = "0x" + bigInt(n).toString(16); // convert back to bigInt with bigInt(nHex.slice(2), 16)
	let accHex = "0x" + bigInt(acc).toString(16);

	// DID Registry contract to deploy
	const IdentityRegistry = await ethers.getContractFactory('DID');
	const identityReg = await IdentityRegistry.deploy();
	await identityReg.deployed();
	console.log("DID Registry has been deployed to:", identityReg.address);

	// Deploy Authentication contract
	const Authentication = await ethers.getContractFactory('Authentication');
	const authentication = await Authentication.deploy(identityReg.address);
	await authentication.deployed();
	console.log("Authentication contract has been deployed to:", authentication.address);

	// Credential registry contract to deploy
	const CredentialRegistry = await ethers.getContractFactory('Credentials');
	const credentialReg = await CredentialRegistry.deploy(authentication.address);
	await credentialReg.deployed();
	console.log("Credentials Registry has been deployed to:", credentialReg.address);

	// admin account registry
	const AdminRegistry = await ethers.getContractFactory('AdminAccounts');
	const adminReg = await AdminRegistry.deploy();
	await adminReg.deployed();
	console.log("Admins Registry has been deployed to:", adminReg.address);

	// issuer registry
	const IssuerRegistry = await ethers.getContractFactory('IssuerRegistry');
	const issuerReg = await IssuerRegistry.deploy(adminReg.address);
	await issuerReg.deployed();
	console.log("Issuers Registry has been deployed to:", issuerReg.address);

	// // sub-accumulator
	const SubAccumulator = await ethers.getContractFactory('SubAccumulator');
	const subAcc = await SubAccumulator.deploy(issuerReg.address);
	await subAcc.deployed();
	console.log("Sub-Accumulator has been deployed to:", subAcc.address);

	// calculate how many hash function needed and update in contract
	await initBitmap(subAcc, capacity);

	const Accumulator = await ethers.getContractFactory('Accumulator');
	const globAcc = await Accumulator.deploy(issuerReg.address, subAcc.address, accHex, nHex);
	await globAcc.deployed();
	console.log("Global accumulator has been deployed to:", globAcc.address);


	//away for the moment testing registering of DID with authentication by
	/*
	const addresses = {
		identityReg: identityReg.address,
	};

	const scriptDir = path.dirname(process.argv[1]);
	const addressesFilePath = path.join(scriptDir, 'deployedAddresses.json');
	fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));
*/

	// Register a DID
	const accounts = await ethers.getSigners();
	const userAddress = accounts[1].address;
	const userDID = "did:example:123456";
	const additionalInfo = "randomString"; // This should be generated or provided

	const txRegister = await identityReg.connect(accounts[1]).register(userAddress, userDID, additionalInfo);
	await txRegister.wait();
	console.log(`DID ${userDID} has been registered for address ${userAddress}`);

	// Authenticate
	const isAuthenticated = await authentication.connect(accounts[1]).authenticate(userAddress, additionalInfo);
	console.log(`Authentication result for ${userAddress}:`, isAuthenticated);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
