const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 MongoDB Connection Diagnostic Tool');
  console.log('=====================================');
  
  const uri = process.env.MONGODB_URI;
  console.log('📍 Connection URI:', uri.replace(/:[^:@]*@/, ':***@'));
  
  try {
    console.log('\n🔄 Step 1: Testing basic connection...');
    
    // Configure mongoose with minimal options
    mongoose.set('strictQuery', false);
    
    const connectionOptions = {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    };
    
    console.log('⚙️ Connection options:', JSON.stringify(connectionOptions, null, 2));
    
    // Attempt connection
    await mongoose.connect(uri, connectionOptions);
    console.log('✅ Successfully connected to MongoDB Atlas!');
    
    // Test database operations
    console.log('\n🔄 Step 2: Testing database operations...');
    
    // List databases
    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('📊 Available databases:', dbs.databases.map(db => db.name));
    
    // Test collection access
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Collections in academyDB:', collections.map(col => col.name));
    
    // Test simple write operation
    const testCollection = mongoose.connection.db.collection('connectionTest');
    const testDoc = { 
      timestamp: new Date(), 
      test: 'MongoDB connection successful',
      ip: require('os').networkInterfaces()
    };
    
    await testCollection.insertOne(testDoc);
    console.log('✅ Write operation successful!');
    
    // Clean up test document
    await testCollection.deleteOne({ test: 'MongoDB connection successful' });
    console.log('🧹 Cleanup completed');
    
    console.log('\n🎉 MongoDB connection is working perfectly!');
    console.log('✅ All tests passed - ready to create admin account');
    
  } catch (error) {
    console.log('\n❌ Connection failed!');
    console.log('📋 Error details:');
    console.log('   Type:', error.name);
    console.log('   Message:', error.message);
    
    if (error.code) {
      console.log('   Code:', error.code);
    }
    
    console.log('\n🔧 Troubleshooting suggestions:');
    
    if (error.message.includes('bad auth')) {
      console.log('   🔐 Authentication Issue:');
      console.log('      - Check username/password in connection string');
      console.log('      - Verify database user exists in MongoDB Atlas');
      console.log('      - Ensure user has proper permissions');
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
      console.log('   🌐 Network Issue:');
      console.log('      - Check internet connection');
      console.log('      - Verify IP address is whitelisted in MongoDB Atlas');
      console.log('      - Try adding 0.0.0.0/0 to IP whitelist temporarily');
    }
    
    if (error.message.includes('connection') && error.message.includes('closed')) {
      console.log('   🔌 Connection Issue:');
      console.log('      - MongoDB Atlas cluster might be paused');
      console.log('      - Check cluster status in MongoDB Atlas dashboard');
      console.log('      - Verify cluster is in active state');
    }
    
    console.log('\n📞 Next steps:');
    console.log('   1. Check MongoDB Atlas dashboard');
    console.log('   2. Verify network access settings');
    console.log('   3. Confirm database user credentials');
    console.log('   4. Ensure cluster is active and not paused');
    
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
    process.exit(0);
  }
}

console.log('Starting MongoDB connection test...\n');
testConnection();
