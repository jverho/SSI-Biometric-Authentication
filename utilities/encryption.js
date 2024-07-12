const crypto = require('crypto');
const fs = require("fs");

// Generate an RSA key pair (only once, and store them in respective files)
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

const PUBLIC_KEY = fs.readFileSync("utilities/rsa_public_key.pem");
const PRIVATE_KEY = fs.readFileSync("utilities/rsa_private_key.pem");


function generateRandomString(length) {
    return crypto.randomBytes(length).toString('hex');
}

// Function to generate a symmetric key
function generateSymmetricKey() {
    return crypto.randomBytes(32).toString('hex'); // 256-bit key in hex string format
}

// Function to encrypt data with symmetric key
function encrypt(data, secretKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey, 'hex'), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Function to decrypt data with symmetric key
function decrypt(data, secretKey) {
    let parts = data.split(':');
    let iv = Buffer.from(parts.shift(), 'hex');
    let encryptedText = Buffer.from(parts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// Function to split a string into two parts
function splitString(str) {
    const midpoint = Math.ceil(str.length / 2);
    const part1 = str.substring(0, midpoint);
    const part2 = str.substring(midpoint);
    return [part1, part2];
}

// Function to encrypt a symmetric key with the public key
function encryptSymmetricKeyWithPublicKey(symmetricKey) {
    const buffer = Buffer.from(symmetricKey, 'hex');
    const encryptedKey = crypto.publicEncrypt(
        {
            key: PUBLIC_KEY,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        buffer
    );
    return encryptedKey.toString('base64');
}

// Function to decrypt a symmetric key with the private key
function decryptSymmetricKeyWithPrivateKey(encryptedKey) {
    const buffer = Buffer.from(encryptedKey, 'base64');
    const decryptedKey = crypto.privateDecrypt(
        {
            key: PRIVATE_KEY,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        buffer
    );
    return decryptedKey.toString('hex');
}

module.exports = {
    generateRandomString,
    generateSymmetricKey,
    encrypt,
    decrypt,
    splitString,
    encryptSymmetricKeyWithPublicKey,
    decryptSymmetricKeyWithPrivateKey
};
