const express = require('express');
const { body, validationResult } = require('express-validator');
const Video = require('../models/Video');
const Course = require('../models/Course');
const { auth, authorize, requireApproval } = require('../middleware/auth');
const { uploadVideo } = require('../middleware/upload');
const { uploadVideo: uploadToCloudinary } = require('../config/cloudinary');

const router = express.Router();

// @route   GET /api/videos/course/:courseId
// @desc    Get all videos for a course
// @access  Public
router.get('/course/:courseId', async (req, res) => {
  try {
    const videos = await Video.find({ 
      course: req.params.courseId, 
      isActive: true 
    }).sort({ order: 1 });

    res.json(videos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/videos/:id
// @desc    Get video by ID
// @access  Private (Enrolled students only)
router.get('/:id', auth, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('course', 'title teacher');

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if user is enrolled in the course (for students)
    if (req.user.role === 'student') {
      const Enrollment = require('../models/Enrollment');
      const enrollment = await Enrollment.findOne({
        student: req.user._id,
        course: video.course._id
      });

      if (!enrollment) {
        return res.status(403).json({ message: 'Not enrolled in this course' });
      }
    }

    // Check if user is the teacher of this course
    if (req.user.role === 'teacher' && video.course.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this video' });
    }

    res.json(video);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/videos/upload
// @desc    Upload a new video (Teacher only)
// @access  Private
router.post('/upload', [
  auth,
  authorize('teacher'),
  requireApproval,
  uploadVideo
], async (req, res) => {
  try {
    const { title, description, courseId } = req.body;

    // Validate required fields
    if (!title || !description || !courseId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, description, and course are required' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video file is required' 
      });
    }

    // Check if course exists and belongs to teacher
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
        message: 'Not authorized to add videos to this course' 
      });
    }

    // Upload video to Cloudinary
    let videoUrl = '';
    let thumbnailUrl = '';
    
    try {
      const result = await uploadToCloudinary(req.file, 'course-videos');
      videoUrl = result.secure_url;
      thumbnailUrl = result.thumbnail_url;
    } catch (uploadError) {
      console.error('Video upload error:', uploadError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to upload video' 
      });
    }

    // Get the next order number for this course
    const lastVideo = await Video.findOne({ course: courseId }).sort({ order: -1 });
    const order = lastVideo ? lastVideo.order + 1 : 1;

    // Create new video
    const video = new Video({
      title,
      description,
      videoUrl,
      thumbnail: thumbnailUrl,
      course: courseId,
      teacher: req.user._id,
      order,
      duration: 0, // Will be updated by Cloudinary
      isActive: true
    });

    await video.save();

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      video
    });

  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload video',
      error: error.message 
    });
  }
});

// @route   POST /api/videos
// @desc    Create a new video (Teacher only)
// @access  Private
router.post('/', [
  auth,
  authorize('teacher'),
  requireApproval,
  body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('videoUrl').isURL().withMessage('Valid video URL is required'),
  body('duration').isNumeric().withMessage('Duration must be a number'),
  body('course').isMongoId().withMessage('Valid course ID is required'),
  body('order').isNumeric().withMessage('Order must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, videoUrl, thumbnail, duration, course, order } = req.body;

    // Check if course exists and belongs to teacher
    const courseDoc = await Course.findById(course);
    if (!courseDoc) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (courseDoc.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to add videos to this course' });
    }

    // Check if order already exists for this course
    const existingVideo = await Video.findOne({ course, order });
    if (existingVideo) {
      return res.status(400).json({ message: 'Video order already exists for this course' });
    }

    const video = new Video({
      title,
      description,
      videoUrl,
      thumbnail,
      duration,
      course,
      order
    });

    await video.save();

    res.status(201).json({
      message: 'Video created successfully',
      video
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/videos/:id
// @desc    Update video (Teacher only - own videos)
// @access  Private
router.put('/:id', [
  auth,
  authorize('teacher'),
  requireApproval,
], async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('course');

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (video.course.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this video' });
    }

    const { title, description, videoUrl, thumbnail, duration, order } = req.body;

    if (title) video.title = title;
    if (description) video.description = description;
    if (videoUrl) video.videoUrl = videoUrl;
    if (thumbnail) video.thumbnail = thumbnail;
    if (duration) video.duration = duration;
    if (order && order !== video.order) {
      // Check if new order already exists
      const existingVideo = await Video.findOne({ 
        course: video.course._id, 
        order,
        _id: { $ne: video._id }
      });
      if (existingVideo) {
        return res.status(400).json({ message: 'Video order already exists for this course' });
      }
      video.order = order;
    }

    await video.save();

    res.json({
      message: 'Video updated successfully',
      video
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/videos/:id
// @desc    Delete video (Teacher only - own videos)
// @access  Private
router.delete('/:id', [
  auth,
  authorize('teacher'),
  requireApproval,
], async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('course');

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (video.course.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this video' });
    }

    // Delete related quiz if exists
    const Quiz = require('../models/Quiz');
    await Quiz.findOneAndDelete({ video: video._id });

    video.isActive = false;
    await video.save();

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
