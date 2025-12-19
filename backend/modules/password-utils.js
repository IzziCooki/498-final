// modules/password-utils.js
const argon2 = require('argon2');

// Argon2 configuration options
const ARGON2_OPTIONS = {
    type: argon2.argon2id,  // hybrid approach
    memoryCost: 65536,      // 64 MB memory cost
    timeCost: 3,            // Number of iterations
    parallelism: 4          // Number of parallel threads
};

// Validates a password against defined security criteria
function validatePassword(password) {
    const errors = [];

    if (!password) {
        errors.push('Password is required');
        return { valid: false, errors };
    }

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

// hash a password.
async function hashPassword(password) {
    return await argon2.hash(password, ARGON2_OPTIONS);
}


// Compares a plain text password with a hashed password
async function comparePassword(password, hash) {
    return await argon2.verify(hash, password);
}

module.exports = {
    validatePassword,
    hashPassword,
    comparePassword
};
