const mongoose = require('mongoose');
const logger = require('../utils/logger');

let cachedConnection = null;

const connectDB = async () => {
  // If already connected, reuse the cached connection (critical for serverless)
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  // If no cached connection but mongoose is already connecting/connected, reuse it
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    cachedConnection = mongoose.connection;
    return cachedConnection;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Below options are deprecated in Mongoose 7+ but kept for older versions
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    cachedConnection = conn;
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting reconnection...');
      cachedConnection = null;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected.');
    });

    return cachedConnection;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    // DON'T crash in serverless — just throw so the request fails gracefully
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;