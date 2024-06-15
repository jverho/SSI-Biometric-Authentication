const crypto = require('crypto');

// Function to generate a random string
function generateRandomString(length) {
    return crypto.randomBytes(length).toString('hex');
}

// Function to generate a symmetric key as a string
function generateSymmetricKey() {
    const secretKey = crypto.randomBytes(32).toString('hex'); // 256-bit key in hex string format
    return secretKey;
}

// Function to encrypt data
function encrypt(data, secretKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey, 'hex'), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Function to decrypt data
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


module.exports = {
    generateRandomString,
    generateSymmetricKey,
    encrypt,
    decrypt,
    splitString,
};
