const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('./models/User');

const createDemoAccounts = async () => {
  try {
    // Configure mongoose for better Atlas compatibility
    mongoose.set('strictQuery', false);
    
    // Connect to MongoDB Atlas with supported options only
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      maxPoolSize: 10,
      maxIdleTimeMS: 30000
    };
    
    console.log('🔄 Connecting to MongoDB Atlas...');
    console.log('📍 Database:', process.env.MONGODB_URI ? 'Atlas Cloud' : 'Local');
    
    await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    console.log('✅ Connected to MongoDB Atlas successfully!');

    // Hash password
    const hashedPassword = await bcrypt.hash('password', 12);

    // Delete existing demo accounts if they exist
    await User.deleteMany({
      email: { $in: ['admin@demo.com', 'teacher@demo.com', 'student@demo.com', 'parent@demo.com'] }
    });
    console.log('Cleared existing demo accounts');

    // Create Admin Account
    const admin = new User({
      name: 'Admin User',
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'admin',
      isApproved: true
    });
    await admin.save();
    console.log('✅ Admin account created: admin@demo.com / password');

    // Create Student Account
    const student = new User({
      name: 'Demo Student',
      email: 'student@demo.com',
      password: hashedPassword,
      role: 'student',
      grade: 'Grade 10',
      dateOfBirth: new Date('2008-01-15')
    });
    await student.save();
    console.log('✅ Student account created: student@demo.com / password');
    console.log('   Student ID:', student.studentId);

    // Create Teacher Account
    const teacher = new User({
      name: 'Demo Teacher',
      email: 'teacher@demo.com',
      password: hashedPassword,
      role: 'teacher',
      subject: 'Mathematics',
      experience: '5 years',
      qualifications: 'Masters in Mathematics',
      isApproved: true
    });
    await teacher.save();
    console.log('✅ Teacher account created: teacher@demo.com / password');

    // Create Parent Account
    const parent = new User({
      name: 'Demo Parent',
      email: 'parent@demo.com',
      password: hashedPassword,
      role: 'parent',
      studentId: student.studentId,
      relationship: 'Father'
    });
    await parent.save();
    console.log('✅ Parent account created: parent@demo.com / password');
    console.log('   Linked to Student ID:', student.studentId);

    console.log('\n🎉 All demo accounts created successfully!');
    console.log('\nYou can now log in with:');
    console.log('👑 Admin: admin@demo.com / password');
    console.log('👨‍🏫 Teacher: teacher@demo.com / password');
    console.log('👨‍🎓 Student: student@demo.com / password');
    console.log('👨‍👩‍👧‍👦 Parent: parent@demo.com / password');

  } catch (error) {
    console.error('❌ Error creating demo accounts:');
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('🔌 Connection Error: Cannot reach MongoDB Atlas');
      console.error('💡 Possible solutions:');
      console.error('   • Check your internet connection');
      console.error('   • Verify MongoDB Atlas cluster is running');
      console.error('   • Check if your IP is whitelisted in Atlas');
    } else if (error.message.includes('bad auth') || error.message.includes('Authentication failed')) {
      console.error('🔐 Authentication Error: Invalid credentials');
      console.error('💡 Possible solutions:');
      console.error('   • Verify username and password in MongoDB Atlas');
      console.error('   • Check if user has proper database permissions');
      console.error('   • Ensure database name matches Atlas configuration');
    } else if (error.code === 'ENOTFOUND') {
      console.error('🌐 DNS Error: Cannot resolve MongoDB Atlas hostname');
      console.error('💡 Possible solutions:');
      console.error('   • Check your internet connection');
      console.error('   • Verify the cluster URL is correct');
    } else {
      console.error('📋 Full error details:', error.message);
    }
    
    console.error('\n🔍 Connection string being used:');
    console.error('   ', process.env.MONGODB_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
    
  } finally {
    try {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    } catch (disconnectError) {
      console.error('⚠️  Error during disconnect:', disconnectError.message);
    }
    process.exit(0);
  }
};

createDemoAccounts();
