'use strict';

// Configuration constants and paths
const CONFIG = {
    apiBaseUrl: 'https://api.example.com',
    timeout: 5000,
    retryAttempts: 3,
    logLevel: 'info',
};

const PATHS = {
    dataPath: './data/',
    logsPath: './logs/',
};

module.exports = { CONFIG, PATHS };