const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'dropped'],
    default: 'active'
  },
  progress: {
    completedVideos: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video'
    }],
    completedQuizzes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz'
    }],
    totalVideos: {
      type: Number,
      default: 0
    },
    totalQuizzes: {
      type: Number,
      default: 0
    }
  },
  quizScores: {
    type: Map,
    of: Number,
    default: {}
  },
  completionDate: {
    type: Date
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, enrolledAt: -1 });
enrollmentSchema.index({ student: 1, enrolledAt: -1 });

// Virtual for completion percentage
enrollmentSchema.virtual('completionPercentage').get(function() {
  const totalItems = this.progress.totalVideos + this.progress.totalQuizzes;
  if (totalItems === 0) return 0;
  
  const completedItems = this.progress.completedVideos.length + this.progress.completedQuizzes.length;
  return Math.round((completedItems / totalItems) * 100);
});

// Method to update progress
enrollmentSchema.methods.updateProgress = function(videoId = null, quizId = null, quizScore = null) {
  if (videoId && !this.progress.completedVideos.includes(videoId)) {
    this.progress.completedVideos.push(videoId);
  }
  
  if (quizId && !this.progress.completedQuizzes.includes(quizId)) {
    this.progress.completedQuizzes.push(quizId);
    if (quizScore !== null) {
      this.quizScores.set(quizId, quizScore);
    }
  }
  
  this.lastAccessed = new Date();
  
  // Check if course is completed
  const totalItems = this.progress.totalVideos + this.progress.totalQuizzes;
  const completedItems = this.progress.completedVideos.length + this.progress.completedQuizzes.length;
  
  if (totalItems > 0 && completedItems >= totalItems) {
    this.status = 'completed';
    this.completionDate = new Date();
  }
  
  return this.save();
};

// Method to get progress statistics
enrollmentSchema.methods.getProgressStats = function() {
  const totalVideos = this.progress.totalVideos;
  const totalQuizzes = this.progress.totalQuizzes;
  const completedVideos = this.progress.completedVideos.length;
  const completedQuizzes = this.progress.completedQuizzes.length;
  
  const videoProgress = totalVideos > 0 ? (completedVideos / totalVideos) * 100 : 0;
  const quizProgress = totalQuizzes > 0 ? (completedQuizzes / totalQuizzes) * 100 : 0;
  const overallProgress = totalVideos + totalQuizzes > 0 ? 
    ((completedVideos + completedQuizzes) / (totalVideos + totalQuizzes)) * 100 : 0;
  
  return {
    videoProgress: Math.round(videoProgress),
    quizProgress: Math.round(quizProgress),
    overallProgress: Math.round(overallProgress),
    totalVideos,
    totalQuizzes,
    completedVideos,
    completedQuizzes,
    quizScores: Object.fromEntries(this.quizScores)
  };
};

module.exports = mongoose.model('Enrollment', enrollmentSchema);
