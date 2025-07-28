# 🚀 Railway Deployment Guide for Areeb Backend

## 📋 Prerequisites

1. **Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect your GitHub account

2. **MongoDB Atlas**
   - Create cluster at [mongodb.com](https://mongodb.com)
   - Get connection string

3. **Cloudinary**
   - Sign up at [cloudinary.com](https://cloudinary.com)
   - Get API credentials

## 🔧 Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure your backend folder contains:
- ✅ `package.json`
- ✅ `server.js`
- ✅ `Procfile`
- ✅ `railway.json`
- ✅ `nixpacks.toml`
- ✅ All route files
- ✅ All model files

### 2. Connect to Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Select the `backend` folder as the source

### 3. Configure Environment Variables

In Railway dashboard, go to Variables tab and add:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/areeb?retryWrites=true&w=majority

# JWT Configuration (Generate a secure random string)
JWT_SECRET=your_super_secure_jwt_secret_key_here_make_it_at_least_32_characters_long

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Server Configuration
PORT=5002
NODE_ENV=production

# Frontend URL (Update this after frontend deployment)
FRONTEND_URL=https://your-frontend-domain.com
```

### 4. Deploy

1. Railway will automatically detect Node.js
2. Build process will start
3. Wait for deployment to complete
4. Check logs for any errors

### 5. Test Deployment

Visit your Railway URL:
```
https://your-app-name.railway.app/api/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "2025-07-28T20:30:00.000Z",
  "mongodb": "connected"
}
```

### 6. Seed Database (Optional)

After successful deployment, you can seed the database:

```bash
# In Railway terminal or via Railway CLI
npm run seed
```

## 🔍 Troubleshooting

### Common Issues:

1. **MongoDB Connection Failed**
   - Check MONGODB_URI format
   - Ensure IP whitelist includes Railway IPs (0.0.0.0/0)
   - Verify username/password

2. **Build Failed**
   - Check package.json dependencies
   - Verify Node.js version compatibility
   - Check Railway logs

3. **CORS Errors**
   - Set FRONTEND_URL correctly
   - Check CORS configuration in server.js

4. **File Upload Issues**
   - Verify Cloudinary credentials
   - Check file size limits

### Railway CLI (Optional)

Install Railway CLI for easier management:

```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

## 📊 Monitoring

### Railway Dashboard
- Check deployment status
- Monitor resource usage
- View logs in real-time

### Health Monitoring
- Health check endpoint: `/api/health`
- Automatic restarts on failure
- Performance metrics

## 🔗 Next Steps

After successful backend deployment:

1. **Get your Railway URL**
2. **Update frontend configuration**
3. **Test all API endpoints**
4. **Deploy frontend**

## 📞 Support

If you encounter issues:
1. Check Railway logs
2. Verify environment variables
3. Test locally first
4. Check this guide again

---

**🎉 Your backend is now ready for production!** 