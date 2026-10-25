import mongoose from 'mongoose';

const loginInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED'],
    required: true,
  },
  failureReason: {
    type: String,
    default: null,
  },
  ipAddress: {
    type: String,
    default: 'Unknown',
  },
  userAgent: {
    type: String,
    default: 'Unknown',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

loginInfoSchema.index({ userId: 1, timestamp: -1 });
loginInfoSchema.index({ email: 1, timestamp: -1 });

const LoginInfo = mongoose.model('LoginInfo', loginInfoSchema);
export default LoginInfo;
