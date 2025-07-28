# Areeb Backend API

## Railway Deployment Guide

### Prerequisites
- Railway account
- MongoDB Atlas cluster
- Cloudinary account

### Environment Variables Required

Set these environment variables in Railway:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/areeb?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_secure

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Server Configuration
PORT=5002
NODE_ENV=production

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend-domain.com
```

### Deployment Steps

1. **Connect to Railway**
   - Go to [Railway.app](https://railway.app)
   - Create new project
   - Connect your GitHub repository

2. **Set Environment Variables**
   - Go to Variables tab
   - Add all required environment variables

3. **Deploy**
   - Railway will automatically detect Node.js
   - Build and deploy will start automatically

4. **Health Check**
   - Visit: `https://your-app.railway.app/api/health`
   - Should return: `{"status":"OK","message":"Server is running"}`

### API Endpoints

- **Health Check**: `GET /api/health`
- **Authentication**: `POST /api/auth/login`, `POST /api/auth/register`
- **Courses**: `GET /api/courses/approved`, `POST /api/courses/request`
- **Users**: `GET /api/users/profile`
- **Admin**: `GET /api/admin/dashboard`

### Database Setup

After deployment, run the seed script to create initial data:

```bash
npm run seed
```

### Troubleshooting

1. **MongoDB Connection Issues**
   - Check MONGODB_URI format
   - Ensure IP whitelist includes Railway IPs

2. **CORS Issues**
   - Set FRONTEND_URL correctly
   - Check CORS configuration in server.js

3. **File Upload Issues**
   - Verify Cloudinary credentials
   - Check file size limits

### Monitoring

- Check Railway logs for errors
- Monitor MongoDB Atlas dashboard
- Use Railway metrics for performance 