'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)){ fs.mkdirSync(DATA_DIR); }

// File paths
const playersFilePath = path.join(DATA_DIR, 'players.json');
const registrationsFilePath = path.join(DATA_DIR, 'pendingRegistrations.json');
const logFilePath = path.join(DATA_DIR, 'messageLogs.json');

// Read player data
const readPlayers = () => {
    if (fs.existsSync(playersFilePath)) {
        const data = fs.readFileSync(playersFilePath, 'utf8');
        return JSON.parse(data);
    }
    return [];
};

// Write player data
const writePlayers = (data) => {
    fs.writeFileSync(playersFilePath, JSON.stringify(data, null, 2));
};

// Read pending registrations
const readPendingRegistrations = () => {
    if (fs.existsSync(registrationsFilePath)) {
        const data = fs.readFileSync(registrationsFilePath, 'utf8');
        return JSON.parse(data);
    }
    return [];
};

// Write pending registrations
const writePendingRegistrations = (data) => {
    fs.writeFileSync(registrationsFilePath, JSON.stringify(data, null, 2));
};

// Read message logs
const readMessageLogs = () => {
    if (fs.existsSync(logFilePath)) {
        const data = fs.readFileSync(logFilePath, 'utf8');
        return JSON.parse(data);
    }
    return [];
};

// Write message logs
const writeMessageLogs = (data) => {
    fs.writeFileSync(logFilePath, JSON.stringify(data, null, 2));
};

module.exports = { readPlayers, writePlayers, readPendingRegistrations, writePendingRegistrations, readMessageLogs, writeMessageLogs };
