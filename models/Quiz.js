const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [{
    type: String,
    required: true
  }],
  correctAnswer: {
    type: Number, // Index of correct option (0-3)
    required: true,
    min: 0,
    max: 3
  }
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: false // Make video optional
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function(questions) {
        return questions.length === 8;
      },
      message: 'Quiz must have exactly 8 questions'
    }
  },
  passingScore: {
    type: Number,
    default: 60, // Percentage
    min: 0,
    max: 100
  },
  timeLimit: {
    type: Number, // Time limit in minutes
    default: 15
  },
  isActive: {
    type: Boolean,
    default: true
  },
  attempts: {
    type: Number,
    default: 3 // Maximum attempts allowed
  }
}, {
  timestamps: true
});

// Ensure one quiz per video
quizSchema.index({ video: 1 }, { unique: true });

module.exports = mongoose.model('Quiz', quizSchema);
