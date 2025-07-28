const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function approveAllTeachers() {
  try {
    console.log('👨‍🏫 Approving All Teachers');
    console.log('========================');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all unapproved teachers
    const unapprovedTeachers = await User.find({ 
      role: 'teacher', 
      isApproved: false 
    });
    
    console.log(`📋 Found ${unapprovedTeachers.length} unapproved teacher(s)`);
    
    if (unapprovedTeachers.length === 0) {
      console.log('✅ All teachers are already approved!');
      return;
    }
    
    // Approve all teachers
    const updateResult = await User.updateMany(
      { role: 'teacher', isApproved: false },
      { isApproved: true }
    );
    
    console.log(`✅ Approved ${updateResult.modifiedCount} teacher(s)`);
    
    // Verify the update
    const remainingUnapproved = await User.countDocuments({ 
      role: 'teacher', 
      isApproved: false 
    });
    
    console.log(`📊 Remaining unapproved teachers: ${remainingUnapproved}`);
    
    if (remainingUnapproved === 0) {
      console.log('🎉 All teachers are now approved!');
    } else {
      console.log('⚠️  Some teachers are still unapproved');
    }
    
    // Show approved teachers
    const approvedTeachers = await User.find({ 
      role: 'teacher', 
      isApproved: true 
    }).select('name email');
    
    console.log('\n👨‍🏫 Approved Teachers:');
    approvedTeachers.forEach(teacher => {
      console.log(`   - ${teacher.name} (${teacher.email})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

approveAllTeachers(); 