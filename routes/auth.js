const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['student', 'parent', 'teacher', 'admin']).withMessage('Invalid role'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role, grade, division, childStudentId, experience, subject, qualifications, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // For parent role, verify child student exists
    if (role === 'parent') {
      if (!childStudentId) {
        return res.status(400).json({ success: false, message: 'Child student ID is required for parent registration' });
      }
      
      // Search by _id first, then by studentId if not found
      let childStudent = await User.findById(childStudentId);
      if (!childStudent) {
        childStudent = await User.findOne({ studentId: childStudentId, role: 'student' });
      }
      
      if (!childStudent || childStudent.role !== 'student') {
        return res.status(400).json({ success: false, message: 'Invalid student ID. Please make sure the student exists and the ID is correct.' });
      }
    }

    // Create user object
    const userData = {
      name,
      email,
      password,
      role,
      phone
    };

    // Add role-specific fields
    if (role === 'student') {
      userData.grade = grade;
      userData.division = division;
      userData.subject = subject;
    } else if (role === 'parent') {
      userData.childStudentId = childStudentId;
    } else if (role === 'teacher') {
      userData.grade = grade;
      userData.division = division;
      userData.experience = experience;
      userData.subject = subject;
      userData.qualifications = qualifications;
    }

    const user = new User(userData);
    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: role === 'teacher' ? 'Registration successful. Awaiting admin approval.' : 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        studentId: user.studentId
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').exists().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if teacher is approved
    if (user.role === 'teacher' && !user.isApproved) {
      return res.status(403).json({ 
        success: false,
        message: 'Your teacher account is pending admin approval. Please wait for approval before logging in.',
        status: 'pending_approval'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        studentId: user.studentId
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isApproved: req.user.isApproved,
        studentId: req.user.studentId,
        grade: req.user.grade,
        childStudentId: req.user.childStudentId,
        experience: req.user.experience,
        subject: req.user.subject,
        qualifications: req.user.qualifications,
        phone: req.user.phone,
        avatar: req.user.avatar,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('phone').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, avatar } = req.body;
    const user = req.user;

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/verify-student/:studentId
// @desc    Verify if a student ID exists
// @access  Public
router.get('/verify-student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Search by _id first, then by studentId if not found
    let student = await User.findById(studentId);
    if (!student) {
      student = await User.findOne({ studentId: studentId, role: 'student' });
    }
    
    if (!student || student.role !== 'student') {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found. Please check the ID and try again.' 
      });
    }
    
    res.json({
      success: true,
      message: 'Student found',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        grade: student.grade
      }
    });
  } catch (error) {
    console.error('Error verifying student:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while verifying student' 
    });
  }
});

module.exports = router;
