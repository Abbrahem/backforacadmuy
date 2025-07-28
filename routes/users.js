const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/student/:studentId
// @desc    Get student by student ID (for parent verification)
// @access  Public
router.get('/student/:studentId', async (req, res) => {
  try {
    const student = await User.findOne({ 
      studentId: req.params.studentId, 
      role: 'student' 
    }).select('name studentId grade');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/teachers
// @desc    Get all approved teachers
// @access  Public
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await User.find({ 
      role: 'teacher', 
      isApproved: true 
    }).select('name experience subject qualifications avatar');

    res.json(teachers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
