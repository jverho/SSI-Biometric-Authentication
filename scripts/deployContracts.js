// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

// var bigInt = require("big-integer");

require("@nomiclabs/hardhat-web3");

async function main() {

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
	const credentialReg = await CredentialRegistry.deploy(authentication.address, identityReg.address);
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


	const addresses = {
		identityReg: identityReg.address,
		authentication: authentication.address,
		credentialReg: credentialReg.address,
	};

	const scriptDir = path.dirname(process.argv[1]);
	const addressesFilePath = path.join(scriptDir, 'deployedAddresses.json');
	fs.writeFileSync(addressesFilePath, JSON.stringify(addresses, null, 2));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
