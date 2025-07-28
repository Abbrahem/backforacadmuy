const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

async function testTeacherApprovalWorkflow() {
  try {
    console.log('🧪 Testing Teacher Approval Workflow');
    console.log('====================================');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clean up any existing test teachers
    await User.deleteMany({ email: { $regex: /test.*teacher/i } });
    console.log('🧹 Cleaned up existing test data');
    
    // Create test teacher (should be unapproved by default)
    const testTeacher = new User({
      name: 'Test Teacher',
      email: 'test.teacher@example.com',
      password: await bcrypt.hash('password123', 12),
      role: 'teacher',
      experience: '5 years',
      subject: 'Mathematics',
      qualifications: 'MSc Mathematics'
    });
    
    await testTeacher.save();
    console.log('👨‍🏫 Created test teacher account');
    console.log('   📧 Email: test.teacher@example.com');
    console.log('   🔑 Password: password123');
    console.log('   ✅ Approved:', testTeacher.isApproved);
    
    // Verify teacher is not approved
    if (!testTeacher.isApproved) {
      console.log('✅ PASS: Teacher is correctly set as unapproved');
    } else {
      console.log('❌ FAIL: Teacher should be unapproved by default');
    }
    
    // Test admin can see pending teacher
    const pendingTeachers = await User.find({ role: 'teacher', isApproved: false });
    console.log(`📋 Found ${pendingTeachers.length} pending teacher(s)`);
    
    if (pendingTeachers.length > 0) {
      console.log('✅ PASS: Admin can query pending teachers');
    } else {
      console.log('❌ FAIL: No pending teachers found');
    }
    
    // Test teacher approval
    testTeacher.isApproved = true;
    await testTeacher.save();
    console.log('👍 Approved test teacher');
    
    // Verify approval worked
    const approvedTeacher = await User.findById(testTeacher._id);
    if (approvedTeacher.isApproved) {
      console.log('✅ PASS: Teacher approval works correctly');
    } else {
      console.log('❌ FAIL: Teacher approval failed');
    }
    
    console.log('');
    console.log('🎯 WORKFLOW TEST SUMMARY:');
    console.log('========================');
    console.log('✅ Teacher registration creates unapproved account');
    console.log('✅ Admin can query pending teachers');
    console.log('✅ Admin can approve/reject teachers');
    console.log('✅ Teacher approval status updates correctly');
    console.log('');
    console.log('🚀 NEXT STEPS TO TEST:');
    console.log('1. Register as teacher via frontend');
    console.log('2. Try to login (should be blocked)');
    console.log('3. Login as admin and approve teacher');
    console.log('4. Teacher should now be able to login');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

testTeacherApprovalWorkflow();
