const express = require('express');
const { body, validationResult } = require('express-validator');
const Quiz = require('../models/Quiz');
const Video = require('../models/Video');
const Enrollment = require('../models/Enrollment');
const { auth, authorize, requireApproval } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/quizzes/:id
// @desc    Get quiz by ID
// @access  Private (Enrolled students only)
router.get('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('course');
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is enrolled (for students)
    if (req.user.role === 'student') {
      const enrollment = await Enrollment.findOne({
        student: req.user._id,
        course: quiz.course._id
      });

      if (!enrollment) {
        return res.status(403).json({ message: 'Not enrolled in this course' });
      }
    }

    // Debug: Log quiz data
    console.log('Quiz Data:', quiz);
    console.log('Questions:', quiz.questions);
    console.log('First Question:', quiz.questions[0]);

    // Randomize question order and option order for students
    if (req.user.role === 'student') {
      const shuffledQuiz = {
        ...quiz.toObject(),
        questions: quiz.questions.map(question => ({
          ...question,
          options: shuffleArray([...question.options]),
          correctAnswer: undefined // Don't send correct answer to students
        }))
      };
      console.log('Shuffled Quiz:', shuffledQuiz);
      return res.json({ quiz: shuffledQuiz });
    }

    res.json({ quiz });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/quizzes/video/:videoId
// @desc    Get quiz for a video
// @access  Private (Enrolled students only)
router.get('/video/:videoId', auth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if user is enrolled (for students)
    if (req.user.role === 'student') {
      const enrollment = await Enrollment.findOne({
        student: req.user._id,
        course: video.course
      });

      if (!enrollment) {
        return res.status(403).json({ message: 'Not enrolled in this course' });
      }

      // Check if video is watched
      const videoWatched = enrollment.progress.videosWatched.find(
        watch => watch.video.toString() === req.params.videoId
      );

      if (!videoWatched) {
        return res.status(403).json({ message: 'Please watch the video first' });
      }
    }

    const quiz = await Quiz.findOne({ video: req.params.videoId, isActive: true });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found for this video' });
    }

    // Randomize question order and option order for students
    if (req.user.role === 'student') {
      const shuffledQuiz = {
        ...quiz.toObject(),
        questions: quiz.questions.map(question => ({
          ...question,
          options: shuffleArray([...question.options]),
          correctAnswer: undefined // Don't send correct answer to students
        }))
      };
      return res.json({ quiz: shuffledQuiz });
    }

    res.json({ quiz });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/quizzes/create
// @desc    Create a new quiz for a course (Teacher only)
// @access  Private
router.post('/create', [
  auth,
  authorize('teacher'),
  requireApproval
], async (req, res) => {
  try {
    const { title, description, courseId, questions, passingScore, timeLimit, attempts } = req.body;

    // Validate required fields
    if (!title || !courseId || !questions) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, course, and questions are required' 
      });
    }

    if (!Array.isArray(questions) || questions.length !== 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Quiz must have exactly 8 questions' 
      });
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.question || !Array.isArray(question.options) || question.options.length !== 4) {
        return res.status(400).json({ 
          success: false, 
          message: `Question ${i + 1} must have a question and exactly 4 options` 
        });
      }
    }

    // Check if course exists and belongs to teacher
    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }

    if (course.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to create quiz for this course' 
      });
    }

    // Create new quiz
    const quiz = new Quiz({
      title,
      description: description || '',
      course: courseId,
      video: null, // Set video to null for course-level quizzes
      questions,
      passingScore: passingScore || 60,
      timeLimit: timeLimit || 15,
      attempts: attempts || 3,
      isActive: true
    });

    await quiz.save();

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully',
      quiz
    });

  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create quiz',
      error: error.message 
    });
  }
});

// @route   POST /api/quizzes
// @desc    Create a new quiz (Teacher only)
// @access  Private
router.post('/', [
  auth,
  authorize('teacher'),
  requireApproval,
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('video').isMongoId().withMessage('Valid video ID is required'),
  body('questions').isArray({ min: 8, max: 8 }).withMessage('Quiz must have exactly 8 questions'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, video, questions, passingScore, timeLimit, attempts } = req.body;

    // Validate video exists and belongs to teacher
    const videoDoc = await Video.findById(video).populate('course');
    if (!videoDoc) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (videoDoc.course.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to create quiz for this video' });
    }

    // Check if quiz already exists for this video
    const existingQuiz = await Quiz.findOne({ video });
    if (existingQuiz) {
      return res.status(400).json({ message: 'Quiz already exists for this video' });
    }

    // Validate questions format
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.question || !question.options || question.options.length !== 4) {
        return res.status(400).json({ 
          message: `Question ${i + 1} must have a question text and exactly 4 options` 
        });
      }
      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        return res.status(400).json({ 
          message: `Question ${i + 1} must have a correct answer between 0 and 3` 
        });
      }
    }

    const quiz = new Quiz({
      title,
      video,
      course: videoDoc.course._id,
      questions,
      passingScore: passingScore || 60,
      timeLimit: timeLimit || 15,
      attempts: attempts || 3
    });

    await quiz.save();

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/quizzes/:id/submit
// @desc    Submit quiz answers
// @access  Private (Student only)
router.post('/:id/submit', [
  auth,
  authorize('student'),
  body('answers').isArray().withMessage('Answers must be an array'),
  body('timeTaken').optional().isNumeric().withMessage('Time taken must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { answers, timeTaken } = req.body;
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Validate answers array length
    if (!answers || answers.length !== quiz.questions.length) {
      return res.status(400).json({ 
        message: `Must provide exactly ${quiz.questions.length} answers` 
      });
    }

    // Check enrollment
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: quiz.course
    });

    if (!enrollment) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    // Initialize progress if not exists
    if (!enrollment.progress) {
      enrollment.progress = {
        completedVideos: [],
        completedQuizzes: [],
        quizScores: {},
        quizzesTaken: []
      };
    }

    if (!enrollment.progress.quizzesTaken) {
      enrollment.progress.quizzesTaken = [];
    }

    // Check if quiz already exists in progress
    let quizProgress = enrollment.progress.quizzesTaken.find(
      qt => qt.quiz.toString() === quiz._id.toString()
    );

    if (!quizProgress) {
      quizProgress = {
        quiz: quiz._id,
        attempts: [],
        bestScore: 0,
        passed: false
      };
      enrollment.progress.quizzesTaken.push(quizProgress);
    }

    // Check attempt limit
    if (quizProgress.attempts.length >= quiz.attempts) {
      return res.status(400).json({ message: 'Maximum attempts reached' });
    }

    // Calculate score
    let correctAnswers = 0;
    const attemptAnswers = answers.map((answer, index) => {
      const question = quiz.questions[index];
      const questionData = question._doc || question; // Handle Mongoose documents
      const isCorrect = questionData.correctAnswer === answer;
      if (isCorrect) correctAnswers++;
      
      return {
        questionIndex: index,
        selectedOption: answer,
        isCorrect
      };
    });

    const score = Math.round((correctAnswers / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;

    // Add attempt
    quizProgress.attempts.push({
      score,
      answers: attemptAnswers,
      timeTaken,
      completedAt: new Date()
    });

    // Update best score and passed status
    if (score > quizProgress.bestScore) {
      quizProgress.bestScore = score;
    }
    if (passed) {
      quizProgress.passed = true;
      // Add to completed quizzes if not already there
      if (!enrollment.progress.completedQuizzes.includes(quiz._id)) {
        enrollment.progress.completedQuizzes.push(quiz._id);
      }
    }

    // Update quiz scores
    if (!enrollment.quizScores) {
      enrollment.quizScores = new Map();
    }
    enrollment.quizScores.set(quiz._id.toString(), score);

    await enrollment.save();

    res.json({
      success: true,
      message: 'Quiz submitted successfully',
      score,
      passed,
      correctAnswers,
      totalQuestions: quiz.questions.length,
      bestScore: quizProgress.bestScore,
      attemptsLeft: quiz.attempts - quizProgress.attempts.length
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

// @route   PUT /api/quizzes/:id
// @desc    Update quiz (Teacher only)
// @access  Private
router.put('/:id', [
  auth,
  authorize('teacher'),
  requireApproval,
], async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate({
      path: 'video',
      populate: { path: 'course' }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (quiz.video.course.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this quiz' });
    }

    const { title, questions, passingScore, timeLimit, attempts } = req.body;

    if (title) quiz.title = title;
    if (questions) {
      // Validate questions format
      if (questions.length !== 8) {
        return res.status(400).json({ message: 'Quiz must have exactly 8 questions' });
      }
      quiz.questions = questions;
    }
    if (passingScore) quiz.passingScore = passingScore;
    if (timeLimit) quiz.timeLimit = timeLimit;
    if (attempts) quiz.attempts = attempts;

    await quiz.save();

    res.json({
      message: 'Quiz updated successfully',
      quiz
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/quizzes/teacher/create
// @desc    Create new quiz (Teacher only)
// @access  Private
router.post('/teacher/create', [
  auth,
  authorize('teacher'),
  requireApproval,
  [
    body('title', 'Title is required').notEmpty(),
    body('description', 'Description is required').notEmpty(),
    body('courseId', 'Course ID is required').notEmpty(),
    body('questions', 'Questions are required').isArray({ min: 8, max: 8 }),
    body('questions.*.question', 'Question text is required').notEmpty(),
    body('questions.*.options', 'Question options are required').isArray({ min: 4, max: 4 }),
    body('questions.*.correctAnswer', 'Correct answer is required').isInt({ min: 0, max: 3 })
  ]
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, courseId, questions } = req.body;

    // Verify the course belongs to the teacher
    const Course = require('../models/Course');
    const course = await Course.findOne({ 
      _id: courseId, 
      teacher: req.user._id,
      isApproved: true 
    });
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found or not approved' });
    }

    // Validate questions structure
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.question || !Array.isArray(question.options) || question.options.length !== 4) {
        return res.status(400).json({ 
          message: `Question ${i + 1} must have text and exactly 4 options` 
        });
      }
      if (question.correctAnswer < 0 || question.correctAnswer > 3) {
        return res.status(400).json({ 
          message: `Question ${i + 1} must have a valid correct answer (0-3)` 
        });
      }
    }

    // Check if quiz with same title already exists for this course
    const existingQuiz = await Quiz.findOne({ 
      title, 
      course: courseId 
    });
    
    if (existingQuiz) {
      return res.status(400).json({ message: 'A quiz with this title already exists for this course' });
    }

    // Create new quiz
    const quiz = new Quiz({
      title,
      description,
      course: courseId,
      questions: questions.map((q, index) => ({
        questionNumber: index + 1,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer
      })),
      totalQuestions: 8,
      passingScore: 60, // Default passing score
      timeLimit: 30, // Default 30 minutes
      isActive: true
    });

    await quiz.save();

    // Populate course info for response
    await quiz.populate('course', 'title subject grade');

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz
    });
  } catch (error) {
    console.error('Quiz creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/quizzes/teacher/my-quizzes
// @desc    Get teacher's quizzes
// @access  Private
router.get('/teacher/my-quizzes', [auth, authorize('teacher')], async (req, res) => {
  try {
    const Course = require('../models/Course');
    
    // Get teacher's courses first
    const teacherCourses = await Course.find({ 
      teacher: req.user._id,
      isApproved: true 
    }).select('_id');
    
    const courseIds = teacherCourses.map(course => course._id);
    
    // Get quizzes for teacher's courses
    const quizzes = await Quiz.find({ 
      course: { $in: courseIds },
      isActive: true 
    })
    .populate('course', 'title subject grade')
    .sort({ createdAt: -1 });

    res.json(quizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/quizzes/course/:courseId
// @desc    Get all quizzes for a course
// @access  Public
router.get('/course/:courseId', async (req, res) => {
  try {
    const quizzes = await Quiz.find({ 
      course: req.params.courseId, 
      isActive: true 
    }).sort({ createdAt: 1 });
    
    res.json({ 
      success: true, 
      quizzes 
    });
  } catch (error) {
    console.error('Error fetching course quizzes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching quizzes' 
    });
  }
});

// Helper function to shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = router;
