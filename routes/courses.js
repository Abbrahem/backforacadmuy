const express = require('express');
const { body, validationResult } = require('express-validator');
const Course = require('../models/Course');
const Video = require('../models/Video');
const Enrollment = require('../models/Enrollment');
const { Buffer } = require('buffer');
const path = require('path');
const fs = require('fs');
const { auth, authorize, requireApproval } = require('../middleware/auth');
const { uploadImage: uploadToCloudinary } = require('../config/cloudinary');
const { uploadImage } = require('../middleware/upload');

const router = express.Router();
const Request = require('../models/Request');

// @route   GET /api/courses/approved
// @desc    Get all approved courses (for students)
// @access  Public
router.get('/approved', async (req, res) => {
  try {
    const courses = await Course.find({ isApproved: true, isActive: true })
      .populate('teacher', 'name email experience subject')
      .sort({ createdAt: -1 });
    
    // Get enrollment counts and video counts for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await Enrollment.countDocuments({ course: course._id });
        const videoCount = await Video.countDocuments({ course: course._id });
        
        return {
          ...course.toObject(),
          enrollmentCount,
          videos: Array(videoCount).fill({}) // Placeholder for video count
        };
      })
    );
    
    res.json({ success: true, courses: coursesWithStats });
  } catch (error) {
    console.error('Error fetching approved courses:', error);
    res.status(500).json({ success: false, message: 'Error fetching courses' });
  }
});

// @route   GET /api/courses/all
// @desc    Get all approved and active courses
// @access  Public
router.get('/all', async (req, res) => {
  try {
    const { subject, grade, search, limit = 10, page = 1 } = req.query;
    
    // Only show approved and active courses to public
    const filter = { isApproved: true, isActive: true };
    
    // If user is authenticated and is the teacher, show their unapproved courses too
    if (req.user && req.user.role === 'teacher') {
      filter.$or = [
        { isApproved: true, isActive: true },
        { teacher: req.user._id, isApproved: false }
      ];

// @route   GET /api/courses/teacher/my-courses
// @desc    Get all courses for the logged-in teacher
// @access  Private
router.get('/teacher/my-courses', auth, authorize('teacher'), async (req, res) => {
  try {
    const courses = await Course.find({ teacher: req.user._id })
      .sort({ createdAt: -1 });
    
    // Get enrollment counts for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await Enrollment.countDocuments({ course: course._id });
        return {
          ...course.toObject(),
          enrollmentCount
        };
      })
    );
    
    res.json(coursesWithStats);
  } catch (error) {
    console.error('Error fetching teacher courses:', error);
    res.status(500).json({ success: false, message: 'Error fetching courses' });
  }
});



// @route   GET /api/courses/teacher/courses
// @desc    Get all courses for teacher (public route for testing)
// @access  Public
router.get('/teacher/courses', async (req, res) => {
  try {
    const courses = await Course.find({})
      .populate('teacher', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, courses });
  } catch (error) {
    console.error('Error fetching teacher courses:', error);
    res.status(500).json({ success: false, message: 'Error fetching courses' });
  }
});

// @route   GET /api/courses/pending
// @desc    Get all pending courses (for admin)
// @access  Private
router.get('/pending', auth, authorize('admin'), async (req, res) => {
  try {
    const courses = await Course.find({ isApproved: false })
      .populate('teacher', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, courses });
  } catch (error) {
    console.error('Error fetching pending courses:', error);
    res.status(500).json({ success: false, message: 'Error fetching pending courses' });
  }
});

// @route   PUT /api/courses/:id/approve
// @desc    Approve a course (Admin only)
// @access  Private
router.put('/:id/approve', auth, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    course.isApproved = true;
    course.approvedAt = Date.now();
    await course.save();
    
    res.json({ success: true, message: 'Course approved successfully' });
  } catch (error) {
    console.error('Error approving course:', error);
    res.status(500).json({ success: false, message: 'Error approving course' });
  }
});

// @route   PUT /api/courses/:id/reject
// @desc    Reject a course (Admin only)
// @access  Private
router.put('/:id/reject', auth, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    course.isActive = false;
    course.rejectionReason = req.body.reason || 'Course rejected by admin';
    await course.save();
    
    res.json({ success: true, message: 'Course rejected successfully' });
  } catch (error) {
    console.error('Error rejecting course:', error);
    res.status(500).json({ success: false, message: 'Error rejecting course' });
  }
});
    }
    
    if (subject) filter.subject = subject;
    if (grade) filter.grade = grade;
    if (search) {
      filter.$text = { $search: search };
    }

    const courses = await Course.find(filter)
      .populate('teacher', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Course.countDocuments(filter);

    res.json({
      courses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/courses/latest
// @desc    Get latest 6 courses for home page
// @access  Public
router.get('/latest', async (req, res) => {
  try {
    const courses = await Course.find({ isApproved: true, isActive: true })
      .populate('teacher', 'name')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});



// @route   GET /api/courses/:id
// @desc    Get course by ID with videos
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teacher', 'name experience subject qualifications');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (!course.isApproved || !course.isActive) {
      return res.status(404).json({ message: 'Course not available' });
    }

    const videos = await Video.find({ course: course._id, isActive: true })
      .sort({ order: 1 });

    res.json({ course, videos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/courses
// @desc    Get all courses
// @access  Public
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find({ isApproved: true, isActive: true })
      .populate('teacher', 'name email')
      .sort({ createdAt: -1 });
    
    // Get enrollment counts and video counts for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await Enrollment.countDocuments({ course: course._id });
        const videoCount = await Video.countDocuments({ course: course._id });
        
        return {
          ...course.toObject(),
          enrollmentCount,
          videos: Array(videoCount).fill({}) // Placeholder for video count
        };
      })
    );
    
    res.json({ success: true, courses: coursesWithStats });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ success: false, message: 'Error fetching courses' });
  }
});

// @route   POST /api/courses
// @desc    Create a new course (Teacher only)
// @access  Private
router.post('/', [
  auth,
  authorize('teacher'),
  uploadImage,
  
  // Input validation
  body('title')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Title must be at least 3 characters'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters'),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required'),
  body('grade')
    .trim()
    .notEmpty()
    .withMessage('Grade is required'),
  
  // Custom error formatter
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array() 
      });
    }
    next();
  }
], async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, subject, grade, division, duration, difficulty, tags, price } = req.body;
    
    // Handle uploaded file
    let coverImagePath = '';
    if (req.file) {
      // Store the filename in the database
      coverImagePath = req.file.filename;
    }

    // Check if course with same title already exists for this teacher
    const existingCourse = await Course.findOne({ 
      title: { $regex: new RegExp(`^${title}$`, 'i') },
      teacher: req.user._id 
    });

    if (existingCourse) {
      return res.status(400).json({ 
        message: 'You already have a course with this title. Please choose a different title.' 
      });
    }

    const course = new Course({
      title,
      description,
      subject,
      grade,
      division,
      coverImage: coverImagePath,
      duration: duration || '4 weeks',
      difficulty: difficulty || 'beginner',
      tags: tags || [],
      price: price || 0,
      teacher: req.user._id,
      isApproved: false, // New courses require admin approval
      isActive: true
    });

    await course.save();

    // Populate teacher info for response
    const savedCourse = await Course.findById(course._id).populate('teacher', 'name email');

    res.status(201).json({
      success: true,
      message: 'Course created successfully and is pending admin approval.',
      course: savedCourse
    });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create course. Please try again.' 
    });
  }
});

// @route   PUT /api/courses/:id
// @desc    Update course (Teacher only - can only update their own courses)
// @access  Private (Teacher only)
router.put('/:id', auth, authorize('teacher'), async (req, res) => {
  try {
    const { title, description, subject, grade, price } = req.body;
    const teacherId = req.user._id;

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'الكورس غير موجود' 
      });
    }

    // Check if teacher owns this course
    if (course.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'غير مصرح لك بتعديل هذا الكورس' 
      });
    }

    // Update course fields
    course.title = title || course.title;
    course.description = description || course.description;
    course.subject = subject || course.subject;
    course.grade = grade || course.grade;
    course.price = price !== undefined ? price : course.price;

    await course.save();

    res.json({
      success: true,
      message: 'تم تحديث الكورس بنجاح',
      course
    });

  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تحديث الكورس' 
    });
  }
});

// @route   GET /api/courses/teacher/my-courses
// @desc    Get teacher's courses
// @access  Private
router.get('/teacher/my-courses', [auth, authorize('teacher')], async (req, res) => {
  try {
    const courses = await Course.find({ teacher: req.user._id })
      .sort({ createdAt: -1 });

    // Get enrollment counts for each course
    const coursesWithStats = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await Enrollment.countDocuments({ course: course._id });
        return {
          ...course.toObject(),
          enrollmentCount
        };
      })
    );

    res.json(coursesWithStats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/courses/:id
// @desc    Delete course (Teacher only - own courses)
// @access  Private
router.delete('/:id', [
  auth,
  authorize('teacher'),
  requireApproval,
], async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this course' });
    }

    course.isActive = false;
    await course.save();

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/courses/teacher/create
// @desc    Create new course (Teacher only)
// @access  Private
router.post('/teacher/create', [
  auth,
  authorize('teacher'),
  requireApproval,
  uploadImage
], [
  body('title', 'Title is required').notEmpty(),
  body('description', 'Description is required').notEmpty(),
  body('subject', 'Subject is required').notEmpty(),
  body('grade', 'Grade is required').notEmpty(),
  body('category', 'Category is required').notEmpty(),
  body('price', 'Price must be a valid number').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, subject, grade, category, price } = req.body;

    // Check if course with same title already exists for this teacher
    const existingCourse = await Course.findOne({ 
      title, 
      teacher: req.user._id 
    });
    
    if (existingCourse) {
      return res.status(400).json({ message: 'You already have a course with this title' });
    }

    let categoryImageUrl = null;
    let categoryImagePublicId = null;

    // Upload category image to Cloudinary if provided
    if (req.file) {
      try {
        const result = await uploadImage(req.file.path, {
          folder: 'courses/category-images',
          transformation: [
            { width: 400, height: 300, crop: 'fill' },
            { quality: 'auto' }
          ]
        });
        categoryImageUrl = result.secure_url;
        categoryImagePublicId = result.public_id;
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload category image' });
      }
    }

    // Create new course (pending admin approval)
    const course = new Course({
      title,
      description,
      subject,
      grade,
      category,
      price: parseFloat(price),
      teacher: req.user._id,
      categoryImage: categoryImageUrl,
      categoryImagePublicId,
      isApproved: false, // Requires admin approval
      isActive: true
    });

    await course.save();

    // Populate teacher info for response
    await course.populate('teacher', 'name email experience subject');

    res.status(201).json({
      message: 'Course created successfully and submitted for admin approval',
      course
    });
  } catch (error) {
    console.error('Course creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/courses/request
// @desc    Request to create a new course (Teacher only)
// @access  Private
router.post('/request', [
  auth,
  authorize('teacher'),
  requireApproval,
  uploadImage
], async (req, res) => {
  try {
    const { name, subject, grade, description, teacherName } = req.body;

    // Validate required fields
    if (!name || !subject || !grade || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cover image is required' 
      });
    }

    // Upload image to Cloudinary
    let coverImageUrl = '';
    let coverImagePublicId = '';
    
    try {
      const result = await uploadToCloudinary(req.file, 'course-covers');
      coverImageUrl = result.secure_url;
      coverImagePublicId = result.public_id;
    } catch (uploadError) {
      console.error('Image upload error:', uploadError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to upload cover image' 
      });
    }

    // Create a new course request
    const courseRequest = new Request({
      type: 'course_creation',
      status: 'pending',
      requestedBy: req.user._id,
      data: {
        name,
        subject,
        grade,
        description,
        teacherName: teacherName || req.user.name,
        coverImage: coverImageUrl,
        coverImagePublicId
      },
      metadata: {
        role: 'teacher'
      }
    });

    await courseRequest.save();

    // Populate the requestedBy field for the response
    await courseRequest.populate('requestedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Course creation request submitted successfully. Waiting for admin approval.',
      request: courseRequest
    });

  } catch (error) {
    console.error('Error creating course request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit course creation request',
      error: error.message 
    });
  }
});

// @route   DELETE /api/courses/:id/teacher
// @desc    Delete a course (Teacher - own courses only)
// @access  Private
router.delete('/:id/teacher', auth, authorize('teacher'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }

    // Check if teacher owns this course
    if (course.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this course' 
      });
    }

    // Delete all videos associated with this course
    const Video = require('../models/Video');
    const videos = await Video.find({ course: course._id });
    
    // Delete videos from cloudinary
    const { deleteImage } = require('../config/cloudinary');
    for (const video of videos) {
      if (video.videoPublicId) {
        try {
          await deleteImage(video.videoPublicId);
        } catch (error) {
          console.error('Error deleting video from cloudinary:', error);
        }
      }
    }

    // Delete all videos from database
    await Video.deleteMany({ course: course._id });

    // Delete all quizzes associated with this course
    const Quiz = require('../models/Quiz');
    await Quiz.deleteMany({ course: course._id });

    // Delete all enrollments associated with this course
    const Enrollment = require('../models/Enrollment');
    await Enrollment.deleteMany({ course: course._id });

    // Delete course cover image from cloudinary if exists
    if (course.coverImagePublicId) {
      try {
        await deleteImage(course.coverImagePublicId);
      } catch (error) {
        console.error('Error deleting cover image from cloudinary:', error);
      }
    }

    // Delete the course
    await Course.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Course and all associated content deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete course',
      error: error.message 
    });
  }
});

// @route   DELETE /api/courses/:id
// @desc    Delete a course (Admin only)
// @access  Private
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }

    // Delete all videos associated with this course
    const Video = require('../models/Video');
    const videos = await Video.find({ course: course._id });
    
    // Delete videos from cloudinary
    const { deleteImage } = require('../config/cloudinary');
    for (const video of videos) {
      if (video.videoPublicId) {
        try {
          await deleteImage(video.videoPublicId);
        } catch (error) {
          console.error('Error deleting video from cloudinary:', error);
        }
      }
    }

    // Delete all videos from database
    await Video.deleteMany({ course: course._id });

    // Delete all quizzes associated with this course
    const Quiz = require('../models/Quiz');
    await Quiz.deleteMany({ course: course._id });

    // Delete all enrollments associated with this course
    const Enrollment = require('../models/Enrollment');
    await Enrollment.deleteMany({ course: course._id });

    // Delete course cover image from cloudinary if exists
    if (course.coverImagePublicId) {
      try {
        await deleteImage(course.coverImagePublicId);
      } catch (error) {
        console.error('Error deleting cover image from cloudinary:', error);
      }
    }

    // Delete the course
    await Course.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Course and all associated content deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete course',
      error: error.message 
    });
  }
});

module.exports = router;
