import User from './models/User.js';
import dns from 'node:dns';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../.env')
});
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());
dns.setServers(['8.8.8.8', '1.1.1.1']);
// API health and status check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);

// Connect to MongoDB
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log('✓ Successfully connected to MongoDB Atlas');
    })
    .catch((err) => {
      console.error('✗ MongoDB connection error:', err.message);
      console.log('ℹ Make sure your MongoDB Atlas connection string is correct in .env');
    });
} else {
  console.warn('⚠️ MONGODB_URI is not defined in your .env file.');
  console.warn('ℹ Please create a .env file and set MONGODB_URI=your_atlas_connection_string');
}
app.get('/api/check-user/:email', async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.params.email
    }).select('_id email');

    res.json({
      exists: !!user,
      user: user || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Start Server
app.listen(PORT, () => {
  console.log(`✓ AttendWise backend server running on http://localhost:${PORT}`);
});
