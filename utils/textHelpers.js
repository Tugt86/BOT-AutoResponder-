// textHelpers.js

/** 
 * Capitalizes the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} The capitalized string.
 */
function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Trims whitespace from both ends of a string.
 * @param {string} str - The string to trim.
 * @returns {string} The trimmed string.
 */
function trimWhitespace(str) {
    return str.trim();
}

/**
 * Splits a string into an array of words.
 * @param {string} str - The string to split.
 * @returns {Array<string>} The array of words.
 */
function splitIntoWords(str) {
    return str.split(/\\s+/);
}

module.exports = { capitalizeFirstLetter, trimWhitespace, splitIntoWords };