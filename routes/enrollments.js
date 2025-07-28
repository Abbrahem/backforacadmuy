const express = require('express');
const router = express.Router();
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const { auth, authorize } = require('../middleware/auth');
const Video = require('../models/Video');
const Quiz = require('../models/Quiz');

// @route   POST /api/enrollments/enroll
// @desc    Enroll student in a course
// @access  Private (Student only)
router.post('/enroll', auth, authorize('student'), async (req, res) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user._id;

    // Check if course exists and is approved
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'الكورس غير موجود' });
    }

    if (!course.isApproved) {
      return res.status(400).json({ success: false, message: 'الكورس غير متاح للتسجيل' });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    });

    if (existingEnrollment) {
      return res.status(400).json({ success: false, message: 'أنت مسجل بالفعل في هذا الكورس' });
    }

    // Get total videos and quizzes for this course
    
    const totalVideos = await Video.countDocuments({ course: courseId });
    const totalQuizzes = await Quiz.countDocuments({ course: courseId });
    
    console.log(`Course ${courseId} has ${totalVideos} videos and ${totalQuizzes} quizzes`);

    // Create new enrollment
    const enrollment = new Enrollment({
      student: studentId,
      course: courseId,
      enrolledAt: new Date(),
      status: 'active',
      progress: {
        completedVideos: [],
        completedQuizzes: [],
        totalVideos: totalVideos,
        totalQuizzes: totalQuizzes
      }
    });

    await enrollment.save();

    // Populate course details for response
    await enrollment.populate('course', 'title description subject');

    res.status(201).json({
      success: true,
      message: 'تم التسجيل في الكورس بنجاح',
      enrollment
    });

  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ success: false, message: 'خطأ في التسجيل' });
  }
});

// @route   GET /api/enrollments/check/:courseId
// @desc    Check if student is enrolled in a course
// @access  Private (Student only)
router.get('/check/:courseId', auth, authorize('student'), async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id;

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    });

    res.json({
      success: true,
      isEnrolled: !!enrollment,
      enrollment: enrollment || null
    });

  } catch (error) {
    console.error('Check enrollment error:', error);
    res.status(500).json({ success: false, message: 'خطأ في التحقق من التسجيل' });
  }
});

// @route   GET /api/enrollments/my-enrollments
// @desc    Get student's enrolled courses
// @access  Private (Student only)
router.get('/my-enrollments', auth, authorize('student'), async (req, res) => {
  try {
    const studentId = req.user._id;
    console.log('Fetching enrollments for student:', studentId);

    const enrollments = await Enrollment.find({ student: studentId })
      .populate('course', 'title description subject coverImage')
      .populate('course.teacher', 'name')
      .sort({ enrolledAt: -1 });

    console.log('Found enrollments:', enrollments.length);
    console.log('Enrollments data:', enrollments);

    res.json({
      success: true,
      enrollments
    });

  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب التسجيلات' });
  }
});

// @route   GET /api/enrollments/student-stats
// @desc    Get detailed student statistics
// @access  Private (Student only)
router.get('/student-stats', auth, authorize('student'), async (req, res) => {
  try {
    console.log('=== STUDENT STATS ENDPOINT CALLED ===');
    const studentId = req.user._id;
    console.log('Getting stats for student:', studentId);

    // Check if studentId is valid
    if (!studentId) {
      console.log('ERROR: Student ID is missing');
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    console.log('Finding enrollments for student:', studentId);
    const enrollments = await Enrollment.find({ student: studentId })
      .populate('course', 'title subject')
      .populate('course.teacher', 'name');

    console.log('Found enrollments:', enrollments.length);

    let totalCourses = enrollments.length;
    let completedCourses = 0;
    let totalVideos = 0;
    let watchedVideos = 0;
    let totalQuizzes = 0;
    let passedQuizzes = 0;
    let totalQuizScore = 0;
    let quizAttempts = 0;

    // Get all videos and quizzes for enrolled courses
    const courseIds = enrollments.map(e => e.course._id);
    console.log('Course IDs:', courseIds);
    
    if (courseIds.length > 0) {
      try {
        console.log('Finding videos for courses:', courseIds);
        const videos = await Video.find({ course: { $in: courseIds } });
        console.log('Finding quizzes for courses:', courseIds);
        const quizzes = await Quiz.find({ course: { $in: courseIds } });

        console.log('Total videos found:', videos.length);
        console.log('Total quizzes found:', quizzes.length);

        enrollments.forEach((enrollment, index) => {
          console.log(`Processing enrollment ${index + 1}:`, enrollment._id);
          console.log('Enrollment progress:', enrollment.progress);
          
          if (enrollment.progress) {
            // Videos - using completedVideos array
            if (enrollment.progress.completedVideos && Array.isArray(enrollment.progress.completedVideos)) {
              watchedVideos += enrollment.progress.completedVideos.length;
              console.log('Completed videos for this enrollment:', enrollment.progress.completedVideos.length);
            }
            
            // Quizzes - using completedQuizzes array
            if (enrollment.progress.completedQuizzes && Array.isArray(enrollment.progress.completedQuizzes)) {
              totalQuizzes += enrollment.progress.completedQuizzes.length;
              passedQuizzes += enrollment.progress.completedQuizzes.length; // All completed quizzes are considered passed
              
              console.log('Completed quizzes for this enrollment:', enrollment.progress.completedQuizzes.length);
              
              // Calculate average quiz score from quizScores Map
              enrollment.progress.completedQuizzes.forEach(quizId => {
                const score = enrollment.quizScores.get(quizId);
                if (score !== undefined) {
                  totalQuizScore += score;
                  quizAttempts++;
                  console.log('Quiz score found:', score);
                }
              });
            }

            // Check if course is completed
            const courseVideos = videos.filter(v => v.course.toString() === enrollment.course._id.toString());
            const courseQuizzes = quizzes.filter(q => q.course.toString() === enrollment.course._id.toString());
            
            console.log('Course videos count:', courseVideos.length);
            console.log('Course quizzes count:', courseQuizzes.length);
            
            if (enrollment.progress.completedVideos && 
                enrollment.progress.completedVideos.length >= courseVideos.length &&
                enrollment.progress.completedQuizzes && 
                enrollment.progress.completedQuizzes.length >= courseQuizzes.length) {
              completedCourses++;
              console.log('Course marked as completed');
            }
          }
        });

        totalVideos = videos.length;
        totalQuizzes = quizzes.length;
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Continue with default values
      }
    }

    const averageQuizScore = quizAttempts > 0 ? Math.round(totalQuizScore / quizAttempts) : 0;

    // Calculate overall completion rate
    const totalContent = totalVideos + totalQuizzes;
    const completedContent = watchedVideos + passedQuizzes;
    const completionRate = totalContent > 0 ? Math.round((completedContent / totalContent) * 100) : 0;
    
    // Calculate student performance rating
    let performanceRating = 'جيد';
    let performanceColor = 'green';
    
    if (completionRate >= 90 && averageQuizScore >= 85) {
      performanceRating = 'ممتاز';
      performanceColor = 'gold';
    } else if (completionRate >= 75 && averageQuizScore >= 70) {
      performanceRating = 'جيد جداً';
      performanceColor = 'blue';
    } else if (completionRate >= 50 && averageQuizScore >= 60) {
      performanceRating = 'جيد';
      performanceColor = 'green';
    } else if (completionRate >= 25) {
      performanceRating = 'مقبول';
      performanceColor = 'orange';
    } else {
      performanceRating = 'يحتاج تحسين';
      performanceColor = 'red';
    }
    
    const stats = {
      totalCourses,
      completedCourses,
      totalVideos,
      watchedVideos,
      totalQuizzes,
      passedQuizzes,
      averageQuizScore,
      completionRate,
      performanceRating,
      performanceColor
    };

    console.log('Final stats:', stats);
    console.log('=== STUDENT STATS ENDPOINT COMPLETED ===');

    res.json({
      success: true,
      stats,
      recentActivity: enrollments.slice(0, 5).map(enrollment => ({
        courseTitle: enrollment.course.title,
        subject: enrollment.course.subject,
        teacherName: enrollment.course.teacher?.name || 'غير محدد',
        lastActivity: enrollment.updatedAt,
        progress: enrollment.progress
      }))
    });

  } catch (error) {
    console.error('=== STUDENT STATS ERROR ===');
    console.error('Get student stats error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'خطأ في جلب إحصائيات الطالب', error: error.message });
  }
});

// @route   GET /api/enrollments/parent/child-progress
// @desc    Get child's progress (Parent only)
// @access  Private (Parent only)
router.get('/parent/child-progress', auth, authorize('parent'), async (req, res) => {
  try {
    const parentId = req.user._id;
    
    // Find the child (student) associated with this parent
    const User = require('../models/User');
    const child = await User.findOne({ parent: parentId, role: 'student' });
    
    if (!child) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على الطالب المرتبط بهذا الحساب' });
    }

    const enrollments = await Enrollment.find({ student: child._id })
      .populate('course', 'title subject')
      .populate('course.teacher', 'name');

    let totalCourses = enrollments.length;
    let completedCourses = 0;
    let totalVideos = 0;
    let watchedVideos = 0;
    let totalQuizzes = 0;
    let passedQuizzes = 0;
    let totalQuizScore = 0;
    let quizAttempts = 0;

    // Get all videos and quizzes for enrolled courses
    const courseIds = enrollments.map(e => e.course._id);
    const videos = await Video.find({ course: { $in: courseIds } });
    const quizzes = await Quiz.find({ course: { $in: courseIds } });

    enrollments.forEach(enrollment => {
      if (enrollment.progress) {
        // Videos
        if (enrollment.progress.completedVideos && Array.isArray(enrollment.progress.completedVideos)) {
          watchedVideos += enrollment.progress.completedVideos.length;
        }
        
        // Quizzes
        if (enrollment.progress.completedQuizzes && Array.isArray(enrollment.progress.completedQuizzes)) {
          passedQuizzes += enrollment.progress.completedQuizzes.length; // All completed quizzes are considered passed
          
          // Calculate average quiz score from quizScores
          enrollment.progress.completedQuizzes.forEach(quizId => {
            const score = enrollment.quizScores.get(quizId);
            if (score !== undefined) {
              totalQuizScore += score;
              quizAttempts++;
            }
          });
        }

        // Check if course is completed
        const courseVideos = videos.filter(v => v.course.toString() === enrollment.course._id.toString());
        const courseQuizzes = quizzes.filter(q => q.course.toString() === enrollment.course._id.toString());
        
        if (enrollment.progress.completedVideos && 
            enrollment.progress.completedVideos.length >= courseVideos.length &&
            enrollment.progress.completedQuizzes && 
            enrollment.progress.completedQuizzes.length >= courseQuizzes.length) {
          completedCourses++;
        }
      }
    });

    totalVideos = videos.length;
    totalQuizzes = quizzes.length;

    const averageQuizScore = quizAttempts > 0 ? Math.round(totalQuizScore / quizAttempts) : 0;

    // Calculate overall completion rate
    const totalContent = totalVideos + totalQuizzes;
    const completedContent = watchedVideos + passedQuizzes;
    const completionRate = totalContent > 0 ? Math.round((completedContent / totalContent) * 100) : 0;

    // Calculate student performance rating
    let performanceRating = 'جيد';
    let performanceColor = 'green';
    
    if (completionRate >= 90 && averageQuizScore >= 85) {
      performanceRating = 'ممتاز';
      performanceColor = 'gold';
    } else if (completionRate >= 75 && averageQuizScore >= 70) {
      performanceRating = 'جيد جداً';
      performanceColor = 'blue';
    } else if (completionRate >= 50 && averageQuizScore >= 60) {
      performanceRating = 'جيد';
      performanceColor = 'green';
    } else if (completionRate >= 25) {
      performanceRating = 'مقبول';
      performanceColor = 'orange';
    } else {
      performanceRating = 'يحتاج تحسين';
      performanceColor = 'red';
    }

    res.json({
      success: true,
      child: {
        name: child.name,
        email: child.email,
        grade: child.grade,
        subject: child.subject
      },
      stats: {
        totalCourses,
        completedCourses,
        totalVideos,
        watchedVideos,
        totalQuizzes,
        passedQuizzes,
        averageQuizScore,
        completionRate,
        performanceRating,
        performanceColor
      },
      recentActivity: enrollments.slice(0, 5).map(enrollment => ({
        courseTitle: enrollment.course.title,
        subject: enrollment.course.subject,
        teacherName: enrollment.course.teacher?.name || 'غير محدد',
        lastActivity: enrollment.updatedAt,
        progress: enrollment.progress
      }))
    });

  } catch (error) {
    console.error('Get child progress error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب تقدم الطالب' });
  }
});

// @route   GET /api/enrollments/course/:courseId/students
// @desc    Get all students enrolled in a course (Teacher only)
// @access  Private (Teacher only)
router.get('/course/:courseId/students', auth, authorize('teacher'), async (req, res) => {
  try {
    const { courseId } = req.params;
    const teacherId = req.user._id;

    // Verify teacher owns this course
    const course = await Course.findById(courseId);
    if (!course || course.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بعرض طلاب هذا الكورس' });
    }

    const enrollments = await Enrollment.find({ course: courseId })
      .populate('student', 'name email')
      .sort({ enrolledAt: -1 });

    res.json({
      success: true,
      enrollments
    });

  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({ success: false, message: 'خطأ في جلب طلاب الكورس' });
  }
});

// @route   PUT /api/enrollments/:enrollmentId/progress
// @desc    Update student progress in a course
// @access  Private (Student only)
router.put('/:enrollmentId/progress', auth, authorize('student'), async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { completedVideo, completedQuiz, quizScore } = req.body;
    const studentId = req.user._id;

    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'التسجيل غير موجود' });
    }

    if (enrollment.student.toString() !== studentId.toString()) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتحديث هذا التسجيل' });
    }

    // Update progress
    if (completedVideo && !enrollment.progress.completedVideos.includes(completedVideo)) {
      enrollment.progress.completedVideos.push(completedVideo);
    }

    if (completedQuiz && !enrollment.progress.completedQuizzes.includes(completedQuiz)) {
      enrollment.progress.completedQuizzes.push(completedQuiz);
      
      // Update quiz scores
      if (!enrollment.quizScores) {
        enrollment.quizScores = {};
      }
      enrollment.quizScores[completedQuiz] = quizScore;
    }

    await enrollment.save();

    res.json({
      success: true,
      message: 'تم تحديث التقدم بنجاح',
      enrollment
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ success: false, message: 'خطأ في تحديث التقدم' });
  }
});

// @route   GET /api/enrollments/:enrollmentId/progress
// @desc    Get enrollment progress
// @access  Private
router.get('/:enrollmentId/progress', auth, async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.enrollmentId);

    if (!enrollment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Enrollment not found' 
      });
    }

    // Check if user owns this enrollment or is admin
    if (enrollment.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view this enrollment' 
      });
    }

    res.json({
      success: true,
      progress: enrollment.progress || {
        completedVideos: [],
        completedQuizzes: [],
        quizScores: {},
        quizzesTaken: []
      }
    });
  } catch (error) {
    console.error('Error fetching enrollment progress:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// @route   POST /api/enrollments/watch-video/:videoId
// @desc    Mark video as watched and update progress
// @access  Private (Student only)
router.post('/watch-video/:videoId', auth, authorize('student'), async (req, res) => {
  try {
    const { videoId } = req.params;
    const { watchTime } = req.body;
    
    // Find the video to get course info
    const video = await Video.findById(videoId).populate('course');
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }
    
    // Check if student is enrolled in this course
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: video.course._id
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }
    
    // Update progress
    const progress = enrollment.progress || {};
    const completedVideos = progress.completedVideos || [];
    
    if (!completedVideos.includes(videoId)) {
      completedVideos.push(videoId);
    }
    
    // Calculate overall progress
    const courseVideos = await Video.countDocuments({ course: video.course._id });
    const courseQuizzes = await Quiz.countDocuments({ course: video.course._id });
    const totalContent = courseVideos + courseQuizzes;
    
    const completedQuizzes = progress.completedQuizzes || [];
    const overallProgress = totalContent > 0 
      ? Math.round(((completedVideos.length + completedQuizzes.length) / totalContent) * 100)
      : 0;
    
    // Update enrollment
    await Enrollment.findByIdAndUpdate(enrollment._id, {
      'progress.completedVideos': completedVideos,
      'progress.overallProgress': overallProgress,
      'progress.lastUpdated': new Date()
    });
    
    res.json({
      success: true,
      message: 'Video marked as watched',
      progress: {
        completedVideos: completedVideos.length,
        overallProgress
      }
    });
  } catch (error) {
    console.error('Error marking video as watched:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking video as watched'
    });
  }
});

// @route   POST /api/enrollments/complete-quiz/:quizId
// @desc    Mark quiz as completed and update progress
// @access  Private (Student only)
router.post('/complete-quiz/:quizId', auth, authorize('student'), async (req, res) => {
  try {
    const { quizId } = req.params;
    const { score, answers } = req.body;
    
    // Find the quiz to get course info
    const quiz = await Quiz.findById(quizId).populate('course');
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }
    
    // Check if student is enrolled in this course
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: quiz.course._id
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }
    
    // Update progress
    const progress = enrollment.progress || {};
    const completedQuizzes = progress.completedQuizzes || [];
    const quizScores = progress.quizScores || {};
    
    if (!completedQuizzes.includes(quizId)) {
      completedQuizzes.push(quizId);
    }
    
    quizScores[quizId] = score;
    
    // Calculate overall progress
    const courseVideos = await Video.countDocuments({ course: quiz.course._id });
    const courseQuizzes = await Quiz.countDocuments({ course: quiz.course._id });
    const totalContent = courseVideos + courseQuizzes;
    
    const completedVideos = progress.completedVideos || [];
    const overallProgress = totalContent > 0 
      ? Math.round(((completedVideos.length + completedQuizzes.length) / totalContent) * 100)
      : 0;
    
    // Update enrollment
    await Enrollment.findByIdAndUpdate(enrollment._id, {
      'progress.completedQuizzes': completedQuizzes,
      'progress.quizScores': quizScores,
      'progress.overallProgress': overallProgress,
      'progress.lastUpdated': new Date()
    });
    
    res.json({
      success: true,
      message: 'Quiz completed',
      score,
      passed: score >= quiz.passingScore,
      progress: {
        completedQuizzes: completedQuizzes.length,
        overallProgress
      }
    });
  } catch (error) {
    console.error('Error completing quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing quiz'
    });
  }
});

// @route   PUT /api/enrollments/update-video-progress
// @desc    Update video progress for enrolled student
// @access  Private
router.put('/update-video-progress', auth, async (req, res) => {
  try {
    const { courseId, videoId } = req.body;
    const studentId = req.user._id;

    // Validate input
    if (!courseId || !videoId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and Video ID are required'
      });
    }

    // Check if student is enrolled in the course
    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    }).populate('course');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'You are not enrolled in this course'
      });
    }

    // Check if video exists and belongs to the course
    const video = await Video.findOne({
      _id: videoId,
      course: courseId
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found in this course'
      });
    }

    // Update progress
    await enrollment.updateProgress(videoId);

    // Get updated enrollment with populated data
    const updatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate('course')
      .populate('progress.completedVideos');

    res.json({
      success: true,
      message: 'Video progress updated successfully',
      enrollment: updatedEnrollment,
      completionPercentage: updatedEnrollment.completionPercentage
    });

  } catch (error) {
    console.error('Error updating video progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update video progress'
    });
  }
});

// @route   GET /api/enrollments/student-progress/:courseId
// @desc    Get student progress for a specific course
// @access  Private
router.get('/student-progress/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user._id;

    const enrollment = await Enrollment.findOne({
      student: studentId,
      course: courseId
    }).populate('course progress.completedVideos');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Get all videos for the course
    const videos = await Video.find({ course: courseId }).sort('order');

    // Mark which videos are completed
    const videosWithProgress = videos.map(video => ({
      ...video.toObject(),
      isCompleted: enrollment.progress.completedVideos.some(
        completedVideo => completedVideo._id.toString() === video._id.toString()
      )
    }));

    res.json({
      success: true,
      enrollment,
      videos: videosWithProgress,
      completionPercentage: enrollment.completionPercentage
    });

  } catch (error) {
    console.error('Error getting student progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get student progress'
    });
  }
});

// @route   GET /api/enrollments/student/:studentId
// @desc    Get all enrollments for a specific student (for parent view)
// @access  Private (Parent only)
router.get('/student/:studentId', auth, authorize('parent'), async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Verify that the parent is authorized to view this student's data
    // This could be enhanced with a parent-student relationship model
    
    const enrollments = await Enrollment.find({ student: studentId })
      .populate('course', 'title subject grade description coverImage')
      .populate('student', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      enrollments
    });
  } catch (error) {
    console.error('Error fetching student enrollments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student enrollments'
    });
  }
});

// @route   GET /api/enrollments/teacher/students
// @desc    Get all students enrolled in teacher's courses
// @access  Private (Teacher only)
router.get('/teacher/students', auth, async (req, res) => {
  try {
    const teacherId = req.user._id;

    // Get all courses by this teacher
    const teacherCourses = await Course.find({ teacher: teacherId }).select('_id title');
    const courseIds = teacherCourses.map(course => course._id);

    // Get all enrollments for these courses
    const enrollments = await Enrollment.find({ 
      course: { $in: courseIds } 
    })
    .populate('student', 'name email grade')
    .populate('course', 'title subject grade')
    .sort({ enrolledAt: -1 });

    // Group enrollments by course
    const studentsByCourse = {};
    teacherCourses.forEach(course => {
      studentsByCourse[course._id] = {
        course: course,
        students: []
      };
    });

    enrollments.forEach(enrollment => {
      if (studentsByCourse[enrollment.course._id]) {
        studentsByCourse[enrollment.course._id].students.push({
          student: enrollment.student,
          enrolledAt: enrollment.enrolledAt,
          progress: enrollment.progress,
          completionPercentage: enrollment.completionPercentage
        });
      }
    });

    res.json({
      success: true,
      studentsByCourse: Object.values(studentsByCourse),
      totalStudents: enrollments.length
    });

  } catch (error) {
    console.error('Error fetching teacher students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrolled students'
    });
  }
});

module.exports = router;
