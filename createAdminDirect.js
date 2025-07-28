const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Define User schema directly to avoid import issues
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'parent', 'teacher', 'admin'], default: 'student' },
  isApproved: { type: Boolean, default: false },
  studentId: { type: String },
  parentStudentId: { type: String }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdminDirectly() {
  try {
    console.log('🚀 Direct Admin Creation Script');
    console.log('================================');
    
    // Connect with minimal options
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000
    });
    
    console.log('✅ Connected to MongoDB Atlas');
    
    // Delete existing admin if any
    await User.deleteMany({ role: 'admin' });
    console.log('🧹 Cleared existing admin accounts');
    
    // Create new admin
    const adminEmail = 'admin@areeb.com';
    const adminPassword = 'admin123';
    
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    const admin = new User({
      name: 'Admin User',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      isApproved: true
    });
    
    await admin.save();
    
    console.log('✅ Admin account created successfully!');
    console.log('');
    console.log('🎯 LOGIN CREDENTIALS:');
    console.log('📧 Email: admin@areeb.com');
    console.log('🔑 Password: admin123');
    console.log('🌐 URL: http://localhost:3000/admin');
    console.log('');
    console.log('🎉 Ready to login!');
    
    // Verify the account exists
    const verifyAdmin = await User.findOne({ email: adminEmail });
    if (verifyAdmin) {
      console.log('✅ Verification: Admin account exists in database');
      console.log('👑 Role:', verifyAdmin.role);
      console.log('📅 Created:', verifyAdmin.createdAt);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('🔧 Try this instead:');
    console.log('1. Go to http://localhost:3000/register');
    console.log('2. Create account with role "Admin"');
    console.log('3. Then use http://localhost:3000/admin to login');
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

createAdminDirectly();
