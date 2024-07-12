# SSI with Biometric Authentication

The project consists JavaScript files and smart contracts enabeling the biometric authentication in an SSi system.

# How to Run

First, we need to compile and deploy smart contracts to the testnet. To do this, make sure Hardhat is installed on your environment or install using `npm install --save-dev hardhat` command. Once installed we can deploy contracts.  

To deploy, start the hardhat node with `npx hardhat node`. 

In another terminal window, the authenticator node needs to be started using `node utilities/authenticator.js` command.
In a new thrid terminal window, the client listner node needs to be started using `node utilities/clientListener.js`.

Open another terminal window and deploy the contracts using `npx hardhat run --network localhost scripts/deployContracts.js` command.  

Once the contracts deployed you can see the contract address in the node terminal (e.g., `0x5fbdb2315678afecb367f032d93f642f64180aa3`). 

In the same terminal the authencation process can be deployed with the command `npx hardhat run --network localhost scripts/deployAuthentication30.js` or `npx hardhat run --network localhost scripts/deployAuthentication80.js` respectively, depending on which biometric fingerprint information (30 or 80 minutiae points) should be used.


# Hardhat Commands 

```shell
npx hardhat help
npx hardhat test
GAS_REPORT=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deployContracts.js
```

# References 
- [Hardhat Guides](https://hardhat.org/hardhat-runner/docs/guides/project-setup) to compile and deploy smart contracts.
- [Hardhat Boilerplate Project](https://hardhat.org/tutorial/boilerplate-project) featuring smart contracts and frontend files structure. 

## Code Base 
- The original CredChain code based was developed by Yue Liu. It was update by Daria Schumm to the latest Solidity (^0.8.0) version, utilises new deployment and testing framework (Hardhat and Truffle). The code is changed to feature the functionalites enableing biometric authentication.
