const mongoose = require('mongoose');
require('dotenv').config();

async function healthCheck() {
  try {
    // Test MongoDB connection
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ MongoDB connection: OK');
    
    // Test basic operations
    const db = mongoose.connection.db;
    await db.admin().ping();
    console.log('✅ Database ping: OK');
    
    // Check collections
    const collections = await db.listCollections().toArray();
    console.log(`✅ Collections found: ${collections.length}`);
    
    await mongoose.disconnect();
    console.log('✅ Health check completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

healthCheck(); 