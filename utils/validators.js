// utils/validators.js

/**
 * Validate a nickname.
 * @param {string} nickname
 * @returns {boolean}
 */
function validateNickname(nickname) {
    const regex = /^[a-zA-Z0-9_]{3,25}$/;  // Allows alphanumeric characters and underscores, length between 3 and 25
    return regex.test(nickname);
}

/**
 * Validate an amount.
 * @param {number} amount
 * @returns {boolean}
 */
function validateAmount(amount) {
    return typeof amount === 'number' && amount > 0;  // Ensures the amount is a positive number
}

/**
 * Validate text input.
 * @param {string} text
 * @returns {boolean}
 */
function validateTextInput(text) {
    return typeof text === 'string' && text.trim().length > 0;  // Ensures the text is not empty or just whitespace
}

/**
 * Validate inventory management input.
 * @param {Object} item - The inventory item
 * @param {string} item.name - The name of the item
 * @param {number} item.quantity - The quantity of the item
 * @returns {boolean}
 */
function validateInventoryItem(item) {
    return validateTextInput(item.name) && validateAmount(item.quantity);  // Validates both the name and the quantity
}

module.exports = { validateNickname, validateAmount, validateTextInput, validateInventoryItem };