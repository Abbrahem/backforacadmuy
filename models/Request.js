const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['course_creation', 'teacher_approval', 'course_approval']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  data: {
    name: String,
    subject: String,
    description: String,
    teacherName: String,
    grade: String,
    coverImage: String,
    coverImagePublicId: String,
    price: Number
  },
  metadata: {
    role: String,
    additionalInfo: mongoose.Schema.Types.Mixed
  },
  adminNotes: {
    type: String,
    default: ''
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient querying
requestSchema.index({ type: 1, status: 1, requestedBy: 1 });
requestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Request', requestSchema); 