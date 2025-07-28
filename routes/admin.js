const express = require('express');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Video = require('../models/Video');
const Quiz = require('../models/Quiz');
const Request = require('../models/Request');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', [auth, authorize('admin')], async (req, res) => {
  try {
    // Get current date and date 30 days ago
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));

    const stats = {
      users: {
        total: await User.countDocuments(),
        students: await User.countDocuments({ role: 'student' }),
        teachers: await User.countDocuments({ role: 'teacher' }),
        parents: await User.countDocuments({ role: 'parent' }),
        pendingTeachers: await User.countDocuments({ role: 'teacher', isApproved: false }),
        newToday: await User.countDocuments({ 
          createdAt: { $gte: today } 
        }),
        newThisMonth: await User.countDocuments({ 
          createdAt: { $gte: thirtyDaysAgo } 
        })
      },
      courses: {
        total: await Course.countDocuments(),
        approved: await Course.countDocuments({ isApproved: true }),
        pending: await Course.countDocuments({ isApproved: false }),
        active: await Course.countDocuments({ isActive: true }),
        newToday: await Course.countDocuments({ 
          createdAt: { $gte: today } 
        }),
        newThisMonth: await Course.countDocuments({ 
          createdAt: { $gte: thirtyDaysAgo } 
        })
      },
      enrollments: {
        total: await Enrollment.countDocuments(),
        active: await Enrollment.countDocuments({ status: 'active' }),
        completed: await Enrollment.countDocuments({ status: 'completed' }),
        newToday: await Enrollment.countDocuments({ 
          enrolledAt: { $gte: today } 
        }),
        newThisMonth: await Enrollment.countDocuments({ 
          enrolledAt: { $gte: thirtyDaysAgo } 
        })
      },
      content: {
        videos: await Video.countDocuments(),
        quizzes: await Quiz.countDocuments(),
        newVideosToday: await Video.countDocuments({ 
          createdAt: { $gte: today } 
        }),
        newQuizzesToday: await Quiz.countDocuments({ 
          createdAt: { $gte: today } 
        })
      },
      activity: {
        totalVideoViews: await Enrollment.aggregate([
          { $unwind: '$progress.completedVideos' },
          { $group: { _id: null, total: { $sum: 1 } } }
        ]).then(result => result[0]?.total || 0),
        totalQuizAttempts: await Enrollment.aggregate([
          { $unwind: '$progress.completedQuizzes' },
          { $group: { _id: null, total: { $sum: 1 } } }
        ]).then(result => result[0]?.total || 0),
        averageCompletionRate: await Enrollment.aggregate([
          { $match: { status: 'active' } },
          { $group: { 
            _id: null, 
            avgCompletion: { $avg: '$completionPercentage' } 
          } }
        ]).then(result => Math.round(result[0]?.avgCompletion || 0))
      },
      recentActivity: {
        recentEnrollments: await Enrollment.find()
          .populate('student', 'name')
          .populate('course', 'title')
          .sort({ enrolledAt: -1 })
          .limit(5),
        recentCourseRequests: await Request.find({ type: 'course_creation' })
          .populate('requestedBy', 'name')
          .sort({ createdAt: -1 })
          .limit(5)
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'خطأ في جلب إحصائيات الأدمن' });
  }
});

// @route   GET /api/admin/comprehensive-stats
// @desc    Get comprehensive admin statistics with detailed activity
// @access  Private (Admin only)
router.get('/comprehensive-stats', [auth, authorize('admin')], async (req, res) => {
  try {
    // Get current date and date 30 days ago
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Basic counts
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalParents = await User.countDocuments({ role: 'parent' });
    const totalCourses = await Course.countDocuments();
    const totalEnrollments = await Enrollment.countDocuments();

    // Detailed activity statistics
    const videoActivity = await Enrollment.aggregate([
      { $unwind: '$progress.completedVideos' },
      { 
        $group: { 
          _id: '$progress.completedVideos',
          count: { $sum: 1 },
          students: { $addToSet: '$student' }
        } 
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const quizActivity = await Enrollment.aggregate([
      { $unwind: '$progress.quizzesTaken' },
      { 
        $group: { 
          _id: '$progress.quizzesTaken.quiz',
          totalAttempts: { $sum: 1 },
          passedAttempts: { 
            $sum: { 
              $cond: ['$progress.quizzesTaken.passed', 1, 0] 
            } 
          },
          averageScore: { 
            $avg: { 
              $max: '$progress.quizzesTaken.attempts.score' 
            } 
          }
        } 
      },
      { $sort: { totalAttempts: -1 } },
      { $limit: 10 }
    ]);

    // Student progress statistics
    const studentProgress = await Enrollment.aggregate([
      {
        $group: {
          _id: '$student',
          totalCourses: { $sum: 1 },
          completedCourses: { 
            $sum: { $cond: ['$status', 1, 0] } 
          },
          totalVideosWatched: { 
            $sum: { $size: '$progress.completedVideos' } 
          },
          totalQuizzesTaken: { 
            $sum: { $size: '$progress.quizzesTaken' } 
          },
          averageQuizScore: {
            $avg: {
              $avg: '$progress.quizzesTaken.attempts.score'
            }
          }
        }
      },
      { $sort: { totalVideosWatched: -1 } },
      { $limit: 10 }
    ]);

    // Course popularity
    const coursePopularity = await Enrollment.aggregate([
      {
        $group: {
          _id: '$course',
          enrollmentCount: { $sum: 1 },
          averageCompletion: {
            $avg: {
              $divide: [
                { $size: '$progress.completedVideos' },
                { $add: [{ $size: '$progress.completedVideos' }, 1] }
              ]
            }
          }
        }
      },
      { $sort: { enrollmentCount: -1 } },
      { $limit: 10 }
    ]);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    const recentEnrollments = await Enrollment.find({
      enrolledAt: { $gte: sevenDaysAgo }
    })
    .populate('student', 'name email')
    .populate('course', 'title subject')
    .sort({ enrolledAt: -1 })
    .limit(10);

    const recentVideoCompletions = await Enrollment.aggregate([
      { $unwind: '$progress.completedVideos' },
      { $match: { 'progress.completedVideos.completedAt': { $gte: sevenDaysAgo } } },
      {
        $lookup: {
          from: 'videos',
          localField: 'progress.completedVideos',
          foreignField: '_id',
          as: 'video'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $sort: { 'progress.completedVideos.completedAt': -1 } },
      { $limit: 10 }
    ]);

    const recentQuizAttempts = await Enrollment.aggregate([
      { $unwind: '$progress.quizzesTaken' },
      { $unwind: '$progress.quizzesTaken.attempts' },
      { $match: { 'progress.quizzesTaken.attempts.completedAt': { $gte: sevenDaysAgo } } },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'progress.quizzesTaken.quiz',
          foreignField: '_id',
          as: 'quiz'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $sort: { 'progress.quizzesTaken.attempts.completedAt': -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      overview: {
        totalUsers,
        totalStudents,
        totalTeachers,
        totalParents,
        totalCourses,
        totalEnrollments
      },
      activity: {
        videoActivity,
        quizActivity,
        studentProgress,
        coursePopularity
      },
      recentActivity: {
        recentEnrollments,
        recentVideoCompletions,
        recentQuizAttempts
      }
    });

  } catch (error) {
    console.error('Comprehensive stats error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب الإحصائيات الشاملة' });
  }
});

// @route   GET /api/admin/pending-teachers
// @desc    Get teachers pending approval
// @access  Private (Admin only)
router.get('/pending-teachers', [auth, authorize('admin')], async (req, res) => {
  try {
    const pendingTeachers = await User.find({ 
      role: 'teacher', 
      isApproved: false 
    }).select('-password').sort({ createdAt: -1 });

    res.json(pendingTeachers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/approve-teacher/:id
// @desc    Approve or reject teacher
// @access  Private (Admin only)
router.put('/approve-teacher/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const { approved } = req.body;
    const teacher = await User.findById(req.params.id);

    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    teacher.isApproved = approved;
    await teacher.save();

    res.json({
      message: `Teacher ${approved ? 'approved' : 'rejected'} successfully`,
      teacher
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/pending-courses
// @desc    Get all pending course requests
// @access  Private (Admin only)
router.get('/pending-courses', auth, authorize('admin'), async (req, res) => {
  try {
    const requests = await Request.find({ 
      type: 'course_creation', 
      status: 'pending' 
    })
    .populate('requestedBy', 'name email')
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map(request => ({
      _id: request._id,
      title: request.data.name,
      description: request.data.description,
      subject: request.data.subject,
      grade: request.data.grade,
      coverImage: request.data.coverImage,
      teacherName: request.data.teacherName || request.requestedBy?.name,
      teacherEmail: request.requestedBy?.email,
      createdAt: request.createdAt,
      requestId: request._id
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error('Error fetching pending course requests:', error);
    res.status(500).json({ success: false, message: 'Error fetching pending requests' });
  }
});

// @route   PUT /api/admin/approve-course/:requestId
// @desc    Approve or reject a course creation request
// @access  Private (Admin only)
router.put('/approve-course/:requestId', auth, authorize('admin'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { approved, adminNotes } = req.body;
    
    const request = await Request.findById(requestId)
      .populate('requestedBy', 'name email');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }

    // Update request status
    request.status = approved ? 'approved' : 'rejected';
    request.adminNotes = adminNotes || '';
    request.processedBy = req.user._id;
    request.processedAt = new Date();

    await request.save();

    let course = null;
    
    if (approved) {
      // Create the actual course
      course = new Course({
        title: request.data.name,
        description: request.data.description,
        subject: request.data.subject,
        grade: request.data.grade || 'عام',
        price: 0, // Free courses
        teacher: request.requestedBy._id,
        coverImage: request.data.coverImage || '',
        coverImagePublicId: request.data.coverImagePublicId || '',
        isApproved: true,
        isActive: true,
        approvalDate: new Date()
      });

      await course.save();
    }

    res.json({ 
      success: true, 
      message: `Course request ${approved ? 'approved' : 'rejected'} successfully`,
      courseId: approved ? course._id : null
    });

  } catch (error) {
    console.error('Error processing course request:', error);
    res.status(500).json({ success: false, message: 'Error processing request' });
  }
});

// @route   GET /api/admin/course-requests
// @desc    Get all course requests with status
// @access  Private (Admin only)
router.get('/course-requests', auth, authorize('admin'), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const filter = { type: 'course_creation' };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await Request.find(filter)
      .populate('requestedBy', 'name email')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Request.countDocuments(filter);

    const formattedRequests = requests.map(request => ({
      _id: request._id,
      title: request.data.name,
      description: request.data.description,
      subject: request.data.subject,
      camera: request.data.camera,
      teacherName: request.data.teacherName || request.requestedBy?.name,
      teacherEmail: request.requestedBy?.email,
      status: request.status,
      adminNotes: request.adminNotes,
      createdAt: request.createdAt,
      processedAt: request.processedAt,
      processedBy: request.processedBy?.name
    }));

    res.json({
      success: true,
      requests: formattedRequests,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Error fetching course requests:', error);
    res.status(500).json({ success: false, message: 'Error fetching requests' });
  }
});

// @route   GET /api/admin/dashboard-stats
// @desc    Get dashboard statistics for admin
// @access  Private (Admin only)
router.get('/dashboard-stats', auth, authorize('admin'), async (req, res) => {
  try {
    const [
      totalUsers,
      totalCourses,
      pendingRequests,
      approvedRequests,
      rejectedRequests
    ] = await Promise.all([
      User.countDocuments(),
      Course.countDocuments(),
      Request.countDocuments({ type: 'course_creation', status: 'pending' }),
      Request.countDocuments({ type: 'course_creation', status: 'approved' }),
      Request.countDocuments({ type: 'course_creation', status: 'rejected' })
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalCourses,
        pendingRequests,
        approvedRequests,
        rejectedRequests
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination
// @access  Private (Admin only)
router.get('/users', [auth, authorize('admin')], async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query;
    const filter = {};
    
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/user/:id
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/user/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin user' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/courses
// @desc    Get all courses with pagination
// @access  Private (Admin only)
router.get('/courses', [auth, authorize('admin')], async (req, res) => {
  try {
    const { page = 1, limit = 10, approved } = req.query;
    const filter = {};
    
    if (approved !== undefined) filter.isApproved = approved === 'true';

    const courses = await Course.find(filter)
      .populate('teacher', 'name email')
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

// @route   GET /api/admin/courses/:id
// @desc    Get course details by ID
// @access  Private (Admin only)
router.get('/courses/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teacher', 'name email');

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'الكورس غير موجود' 
      });
    }

    res.json({
      success: true,
      course
    });

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب بيانات الكورس' 
    });
  }
});

// @route   PUT /api/admin/courses/:id
// @desc    Update course by ID
// @access  Private (Admin only)
router.put('/courses/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { title, description, subject, grade, teacher, isApproved, isActive, price } = req.body;

    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'الكورس غير موجود' 
      });
    }

    // Update course fields
    course.title = title || course.title;
    course.description = description || course.description;
    course.subject = subject || course.subject;
    course.grade = grade || course.grade;
    course.teacher = teacher || course.teacher;
    course.isApproved = isApproved !== undefined ? isApproved : course.isApproved;
    course.isActive = isActive !== undefined ? isActive : course.isActive;
    course.price = price !== undefined ? price : course.price;

    await course.save();

    // Populate teacher info for response
    await course.populate('teacher', 'name email');

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

// @route   GET /api/admin/teachers
// @desc    Get all teachers for admin
// @access  Private (Admin only)
router.get('/teachers', auth, authorize('admin'), async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher', isApproved: true })
      .select('name email');

    res.json({
      success: true,
      teachers
    });

  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب قائمة المدرسين' 
    });
  }
});

// @route   DELETE /api/admin/course/:id
// @desc    Delete course
// @access  Private (Admin only)
router.delete('/course/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Delete related videos and quizzes
    await Video.deleteMany({ course: req.params.id });
    await Quiz.deleteMany({ course: req.params.id });
    await Enrollment.deleteMany({ course: req.params.id });
    await Course.findByIdAndDelete(req.params.id);

    res.json({ message: 'Course and related content deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/recent-enrollments
// @desc    Get recent enrollments for admin dashboard
// @access  Private (Admin only)
router.get('/recent-enrollments', auth, authorize('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const enrollments = await Enrollment.find({})
      .populate('student', 'name email')
      .populate('course', 'title subject grade')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      enrollments
    });
  } catch (error) {
    console.error('Error fetching recent enrollments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent enrollments'
    });
  }
});

// @route   GET /api/admin/enrollments
// @desc    Get all enrollments with pagination and filters
// @access  Private (Admin only)
router.get('/enrollments', auth, authorize('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    
    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { 'student.name': { $regex: search, $options: 'i' } },
        { 'course.title': { $regex: search, $options: 'i' } },
        { 'student._id': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status !== 'all') {
      query.status = status;
    }
    
    const enrollments = await Enrollment.find(query)
      .populate('student', 'name email')
      .populate('course', 'title subject grade')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Enrollment.countDocuments(query);

    res.json({
      success: true,
      enrollments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enrollments'
    });
  }
});

// @route   GET /api/admin/enrollment-stats
// @desc    Get enrollment statistics for admin dashboard
// @access  Private (Admin only)
router.get('/enrollment-stats', auth, authorize('admin'), async (req, res) => {
  try {
    const totalEnrollments = await Enrollment.countDocuments();
    const activeStudents = await Enrollment.distinct('student').countDocuments();
    
    // Get this month's enrollments
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const thisMonth = await Enrollment.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    
    // Get popular courses (courses with most enrollments)
    const popularCourses = await Enrollment.aggregate([
      {
        $group: {
          _id: '$course',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalEnrollments,
        activeStudents,
        thisMonth,
        popularCourses: popularCourses.length
      }
    });
  } catch (error) {
    console.error('Error fetching enrollment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enrollment stats'
    });
  }
});

// @route   DELETE /api/admin/enrollments/:id
// @desc    Delete an enrollment
// @access  Private (Admin only)
router.delete('/enrollments/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }
    
    await Enrollment.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Enrollment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting enrollment'
    });
  }
});

// @route   GET /api/admin/performance-stats
// @desc    Get performance statistics for admin dashboard
// @access  Private (Admin only)
router.get('/performance-stats', auth, authorize('admin'), async (req, res) => {
  try {
    console.log('=== ADMIN PERFORMANCE STATS ENDPOINT CALLED ===');
    
    // Get all enrollments with populated data
    const enrollments = await Enrollment.find()
      .populate('student', 'name email')
      .populate('course', 'title subject')
      .populate('course.teacher', 'name');

    console.log('Total enrollments found:', enrollments.length);

    // Get all videos and quizzes
    const videos = await Video.find();
    const quizzes = await Quiz.find();

    console.log('Total videos found:', videos.length);
    console.log('Total quizzes found:', quizzes.length);

    let totalEnrollments = enrollments.length;
    let completedEnrollments = 0;
    let totalVideos = videos.length;
    let watchedVideos = 0;
    let totalQuizzes = quizzes.length;
    let passedQuizzes = 0;
    let totalQuizScore = 0;
    let quizAttempts = 0;
    let activeStudents = 0;
    let studentScores = [];

    // Process each enrollment
    enrollments.forEach((enrollment, index) => {
      console.log(`Processing enrollment ${index + 1}:`, enrollment._id);
      
      if (enrollment.progress) {
        // Count watched videos
        if (enrollment.progress.completedVideos && Array.isArray(enrollment.progress.completedVideos)) {
          watchedVideos += enrollment.progress.completedVideos.length;
        }
        
        // Count passed quizzes and calculate scores
        if (enrollment.progress.completedQuizzes && Array.isArray(enrollment.progress.completedQuizzes)) {
          passedQuizzes += enrollment.progress.completedQuizzes.length;
          
          // Calculate quiz scores
          enrollment.progress.completedQuizzes.forEach(quizId => {
            const score = enrollment.quizScores?.get?.(quizId) || enrollment.quizScores?.[quizId];
            if (score !== undefined) {
              totalQuizScore += score;
              quizAttempts++;
            }
          });
        }

        // Check if student is active (has any progress)
        if ((enrollment.progress.completedVideos && enrollment.progress.completedVideos.length > 0) ||
            (enrollment.progress.completedQuizzes && enrollment.progress.completedQuizzes.length > 0)) {
          activeStudents++;
        }

        // Calculate individual student performance
        const courseVideos = videos.filter(v => v.course.toString() === enrollment.course._id.toString());
        const courseQuizzes = quizzes.filter(q => q.course.toString() === enrollment.course._id.toString());
        
        const completedVideos = enrollment.progress.completedVideos?.length || 0;
        const completedQuizzes = enrollment.progress.completedQuizzes?.length || 0;
        
        const completionRate = (courseVideos.length + courseQuizzes.length) > 0 
          ? Math.round(((completedVideos + completedQuizzes) / (courseVideos.length + courseQuizzes.length)) * 100)
          : 0;

        // Calculate average quiz score for this student
        let studentQuizScore = 0;
        let studentQuizCount = 0;
        if (enrollment.progress.completedQuizzes) {
          enrollment.progress.completedQuizzes.forEach(quizId => {
            const score = enrollment.quizScores?.get?.(quizId) || enrollment.quizScores?.[quizId];
            if (score !== undefined) {
              studentQuizScore += score;
              studentQuizCount++;
            }
          });
        }
        
        const averageScore = studentQuizCount > 0 ? Math.round(studentQuizScore / studentQuizCount) : 0;
        
        // Calculate overall rating (weighted average of completion rate and quiz score)
        const overallRating = Math.round((completionRate * 0.6) + (averageScore * 0.4));

        studentScores.push({
          _id: enrollment._id,
          studentName: enrollment.student?.name || 'غير محدد',
          courseTitle: enrollment.course?.title || 'غير محدد',
          completionRate,
          averageScore,
          overallRating,
          completedVideos,
          completedQuizzes,
          totalCourseContent: courseVideos.length + courseQuizzes.length
        });

        // Check if course is completed
        if (completedVideos >= courseVideos.length && completedQuizzes >= courseQuizzes.length) {
          completedEnrollments++;
        }
      }
    });

    // Calculate overall statistics
    const overallCompletionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;
    const quizSuccessRate = totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0;
    const averageQuizScore = quizAttempts > 0 ? Math.round(totalQuizScore / quizAttempts) : 0;
    const studentActivityRate = totalEnrollments > 0 ? Math.round((activeStudents / totalEnrollments) * 100) : 0;

    // Calculate overall rating
    const overallRating = Math.round(
      (overallCompletionRate * 0.3) + 
      (quizSuccessRate * 0.3) + 
      (averageQuizScore * 0.2) + 
      (studentActivityRate * 0.2)
    );

    // Get top performers (sort by overall rating)
    const topPerformers = studentScores
      .filter(student => student.overallRating > 0)
      .sort((a, b) => b.overallRating - a.overallRating)
      .slice(0, 10);

    console.log('Final performance stats calculated');
    console.log('=== ADMIN PERFORMANCE STATS ENDPOINT COMPLETED ===');

    res.json({
      success: true,
      overallCompletionRate,
      quizSuccessRate,
      averageQuizScore,
      studentActivityRate,
      overallRating,
      topPerformers,
      summary: {
        totalEnrollments,
        completedEnrollments,
        totalVideos,
        watchedVideos,
        totalQuizzes,
        passedQuizzes,
        activeStudents
      }
    });

  } catch (error) {
    console.error('=== ADMIN PERFORMANCE STATS ERROR ===');
    console.error('Get performance stats error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب إحصائيات الأداء',
      error: error.message 
    });
  }
});

// @route   GET /api/admin/course-performance
// @desc    Get course performance statistics
// @access  Private (Admin only)
router.get('/course-performance', auth, authorize('admin'), async (req, res) => {
  try {
    console.log('=== COURSE PERFORMANCE ENDPOINT CALLED ===');
    
    // Get all courses with teacher info
    const courses = await Course.find({ isApproved: true })
      .populate('teacher', 'name');

    console.log('Total approved courses found:', courses.length);

    // Get all enrollments, videos, and quizzes
    const enrollments = await Enrollment.find();
    const videos = await Video.find();
    const quizzes = await Quiz.find();

    const coursePerformance = [];

    // Calculate performance for each course
    for (const course of courses) {
      console.log(`Processing course: ${course.title}`);
      
      // Get enrollments for this course
      const courseEnrollments = enrollments.filter(e => e.course.toString() === course._id.toString());
      
      // Get videos and quizzes for this course
      const courseVideos = videos.filter(v => v.course.toString() === course._id.toString());
      const courseQuizzes = quizzes.filter(q => q.course.toString() === course._id.toString());
      
      let totalCompletionRate = 0;
      let totalQuizScore = 0;
      let quizAttempts = 0;
      let activeEnrollments = 0;

      // Calculate performance for each enrollment in this course
      courseEnrollments.forEach(enrollment => {
        if (enrollment.progress) {
          const completedVideos = enrollment.progress.completedVideos?.length || 0;
          const completedQuizzes = enrollment.progress.completedQuizzes?.length || 0;
          
          // Calculate completion rate for this enrollment
          const totalContent = courseVideos.length + courseQuizzes.length;
          if (totalContent > 0) {
            const enrollmentCompletionRate = Math.round(((completedVideos + completedQuizzes) / totalContent) * 100);
            totalCompletionRate += enrollmentCompletionRate;
            activeEnrollments++;
          }
          
          // Calculate quiz scores for this enrollment
          if (enrollment.progress.completedQuizzes) {
            enrollment.progress.completedQuizzes.forEach(quizId => {
              const score = enrollment.quizScores?.get?.(quizId) || enrollment.quizScores?.[quizId];
              if (score !== undefined) {
                totalQuizScore += score;
                quizAttempts++;
              }
            });
          }
        }
      });

      // Calculate averages
      const averageCompletionRate = activeEnrollments > 0 ? Math.round(totalCompletionRate / activeEnrollments) : 0;
      const averageQuizScore = quizAttempts > 0 ? Math.round(totalQuizScore / quizAttempts) : 0;
      
      // Calculate overall rating for this course
      const overallRating = Math.round((averageCompletionRate * 0.6) + (averageQuizScore * 0.4));

      coursePerformance.push({
        _id: course._id,
        title: course.title,
        subject: course.subject,
        teacherName: course.teacher?.name || 'غير محدد',
        enrollmentCount: courseEnrollments.length,
        activeEnrollments,
        completionRate: averageCompletionRate,
        averageScore: averageQuizScore,
        overallRating,
        totalVideos: courseVideos.length,
        totalQuizzes: courseQuizzes.length
      });
    }

    // Sort by overall rating (descending)
    coursePerformance.sort((a, b) => b.overallRating - a.overallRating);

    console.log('Course performance calculated for', coursePerformance.length, 'courses');
    console.log('=== COURSE PERFORMANCE ENDPOINT COMPLETED ===');

    res.json({
      success: true,
      coursePerformance
    });

  } catch (error) {
    console.error('=== COURSE PERFORMANCE ERROR ===');
    console.error('Get course performance error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب أداء الكورسات',
      error: error.message 
    });
  }
});

module.exports = router;
