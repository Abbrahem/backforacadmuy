const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

async function setupAdmin() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully!');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('👑 Admin account already exists:');
      console.log('📧 Email:', existingAdmin.email);
      console.log('🔑 Use your existing password to login at /admin');
      return;
    }
    
    // Create admin account
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
    console.log('🎯 Admin Login Details:');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('');
    console.log('🚀 Access your admin panel at: http://localhost:3000/admin');
    
  } catch (error) {
    console.error('❌ Error setting up admin:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

setupAdmin();
