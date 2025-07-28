const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  order: {
    type: Number,
    required: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Cloudinary specific fields
  cloudinaryPublicId: {
    type: String
  },
  fileSize: {
    type: Number // in bytes
  },
  format: {
    type: String
  }
}, {
  timestamps: true
});

// Ensure unique order within a course
videoSchema.index({ course: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('Video', videoSchema);
