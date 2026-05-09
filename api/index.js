// api/index.js
// Vercel serverless entry point — wraps the Express app

// Load env vars (Vercel injects these from dashboard)
require('dotenv').config();

// Import the Express app from server
const app = require('../server/index');

// Export for Vercel serverless function
module.exports = app;