import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import LoginInfo from '../models/LoginInfo.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'attendwise_default_secret_key_change_me_in_env';

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'Unknown';
}

function getUserAgent(req) {
  return req.headers['user-agent'] || 'Unknown';
}

/**
 * POST /api/auth/register
 * Create a new user account.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, rollNo } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in instead.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      rollNo: rollNo ? String(rollNo).trim() : '',
      password: hashedPassword,
    });

    await user.save();

    // Log the initial successful registration login
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    await LoginInfo.create({
      userId: user._id,
      email: user.email,
      status: 'SUCCESS',
      failureReason: null,
      ipAddress,
      userAgent,
    });

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        rollNo: user.rollNo,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Server error during registration.',
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and record login attempt info in MongoDB.
 */
router.post('/login', async (req, res) => {
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both email and password.',
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Record failed login attempt: unknown user
      await LoginInfo.create({
        userId: null,
        email: normalizedEmail,
        status: 'FAILED',
        failureReason: 'User not found',
        ipAddress,
        userAgent,
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Record failed login attempt: incorrect password
      await LoginInfo.create({
        userId: user._id,
        email: user.email,
        status: 'FAILED',
        failureReason: 'Incorrect password',
        ipAddress,
        userAgent,
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Record successful login attempt
    await LoginInfo.create({
      userId: user._id,
      email: user.email,
      status: 'SUCCESS',
      failureReason: null,
      ipAddress,
      userAgent,
    });

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        rollNo: user.rollNo,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile and recent login activity.
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const recentLogins = await LoginInfo.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    return res.json({
      success: true,
      user: req.user,
      recentLogins,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
});

/**
 * GET /api/auth/logins
 * Get full login activity history for the current authenticated user.
 */
router.get('/logins', authenticateToken, async (req, res) => {
  try {
    const logins = await LoginInfo.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      logins,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch login history.' });
  }
});

export default router;
