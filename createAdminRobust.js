const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');

async function createAdminWithRetry(maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`🔄 Attempt ${attempt}/${maxRetries}: Connecting to MongoDB...`);
      
      // Configure mongoose
      mongoose.set('strictQuery', false);
      
      // Connection options with retry logic
      const connectionOptions = {
        serverSelectionTimeoutMS: 20000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        w: 'majority',
        maxIdleTimeMS: 30000,
        connectTimeoutMS: 20000
      };
      
      await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
      console.log('✅ Connected to MongoDB successfully!');
      
      // Check if admin already exists
      const existingAdmin = await User.findOne({ role: 'admin' });
      if (existingAdmin) {
        console.log('👑 Admin account already exists:');
        console.log('📧 Email:', existingAdmin.email);
        console.log('🔑 Use your password to login at /admin');
        return true;
      }
      
      // Create admin account
      const adminEmail = 'admin@areeb.com';
      const adminPassword = 'admin123';
      
      console.log('🔄 Creating admin account...');
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
      
      return true;
      
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 2; // Exponential backoff
        console.log(`⏳ Waiting ${waitTime} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } else {
        console.log('❌ All attempts failed. Please check:');
        console.log('   1. Internet connection');
        console.log('   2. MongoDB Atlas cluster status');
        console.log('   3. Network access settings in MongoDB Atlas');
        console.log('   4. Database user credentials');
        return false;
      }
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
      }
    }
  }
  
  return false;
}

async function main() {
  console.log('🚀 Starting robust admin account creation...');
  console.log('=====================================');
  
  const success = await createAdminWithRetry(3);
  
  if (success) {
    console.log('');
    console.log('🎉 SUCCESS! Admin account is ready!');
    console.log('You can now start your servers and login at /admin');
  } else {
    console.log('');
    console.log('❌ FAILED! Could not create admin account.');
    console.log('Please check your MongoDB Atlas configuration.');
  }
  
  process.exit(success ? 0 : 1);
}

main();
