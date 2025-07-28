const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Course = require('./models/Course');

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/areeb', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB for seeding');

    // Clear existing demo accounts
    await User.deleteMany({
      email: { $in: ['admin@demo.com', 'teacher@demo.com', 'student@demo.com', 'parent@demo.com'] }
    });
    console.log('🧹 Cleared existing demo accounts');

    // Hash password for all demo accounts
    const hashedPassword = await bcrypt.hash('password', 12);

    // Create Admin Account
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'admin',
      isApproved: true,
      createdAt: new Date()
    });
    await adminUser.save();
    console.log('👑 Created admin account: admin@demo.com / password');

    // Create Teacher Account
    const teacherUser = new User({
      name: 'Demo Teacher',
      email: 'teacher@demo.com',
      password: hashedPassword,
      role: 'teacher',
      subject: 'Mathematics',
      experience: '5 years',
      qualifications: 'Masters in Mathematics Education',
      isApproved: true, // Pre-approved for demo
      createdAt: new Date()
    });
    await teacherUser.save();
    console.log('👨‍🏫 Created teacher account: teacher@demo.com / password');

    // Create Student Account
    const studentUser = new User({
      name: 'Demo Student',
      email: 'student@demo.com',
      password: hashedPassword,
      role: 'student',
      grade: 'Grade 10',
      dateOfBirth: new Date('2008-01-15'),
      createdAt: new Date()
    });
    await studentUser.save();
    console.log('👨‍🎓 Created student account: student@demo.com / password');
    console.log(`📝 Student ID: ${studentUser.studentId}`);

    // Create Parent Account (linked to student)
    const parentUser = new User({
      name: 'Demo Parent',
      email: 'parent@demo.com',
      password: hashedPassword,
      role: 'parent',
      studentId: studentUser.studentId,
      relationship: 'Father',
      createdAt: new Date()
    });
    await parentUser.save();
    console.log('👨‍👩‍👧‍👦 Created parent account: parent@demo.com / password');
    console.log(`🔗 Linked to student ID: ${studentUser.studentId}`);

    // Create a demo course by the teacher
    const demoCourse = new Course({
      title: 'Introduction to Algebra',
      description: 'Learn the fundamentals of algebra with practical examples and exercises.',
      subject: 'Mathematics',
      grade: 'Grade 10',
      teacher: teacherUser._id,
      price: 99.99,
      duration: 8,
      level: 'Beginner',
      isApproved: true,
      isActive: true,
      coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
      createdAt: new Date()
    });
    await demoCourse.save();
    console.log('📚 Created demo course: Introduction to Algebra');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Demo Accounts Created:');
    console.log('👑 Admin: admin@demo.com / password');
    console.log('👨‍🏫 Teacher: teacher@demo.com / password (approved)');
    console.log('👨‍🎓 Student: student@demo.com / password');
    console.log('👨‍👩‍👧‍👦 Parent: parent@demo.com / password');
    console.log('\n🚀 You can now log in with any of these accounts!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seeding
seedDatabase();
