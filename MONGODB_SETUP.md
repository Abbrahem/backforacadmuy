# MongoDB Atlas Setup Guide

## Issue Identified
❌ **Authentication failed** - Username/password combination is incorrect

## Step-by-Step Fix

### 1. Go to MongoDB Atlas Dashboard
- Visit: https://cloud.mongodb.com/
- Login to your account

### 2. Check Database User
- Go to **Database Access** (left sidebar)
- Look for user: `admin_abrahem`
- If user doesn't exist, create it
- If user exists, reset the password

### 3. Create/Update Database User
Click **"Add New Database User"** or edit existing user:

**User Details:**
- **Username:** `admin_abrahem`
- **Password:** `abrahem11` (or set a new password)
- **Database User Privileges:** 
  - Select **"Read and write to any database"**
  - Or **"Atlas admin"** for full access

### 4. Network Access (IP Whitelist)
- Go to **Network Access** (left sidebar)
- Click **"Add IP Address"**
- Add your current IP or use `0.0.0.0/0` for testing (allows all IPs)

### 5. Get Correct Connection String
- Go to **Database** → **Connect** → **Connect your application**
- Copy the connection string
- Replace `<password>` with your actual password
- Ensure database name is `academyDB`

### 6. Update .env File
Replace the MONGODB_URI in your .env file with the new connection string.

## Quick Test Commands

After updating credentials, test the connection:
```bash
node testConnection.js
```

If successful, create admin account:
```bash
node setupAdmin.js
```

## Common Issues & Solutions

### Issue: "User does not exist"
**Solution:** Create the database user in MongoDB Atlas Dashboard

### Issue: "IP not whitelisted"
**Solution:** Add your IP address to Network Access in MongoDB Atlas

### Issue: "Cluster paused"
**Solution:** Resume the cluster in MongoDB Atlas Dashboard

### Issue: "Wrong database name"
**Solution:** Ensure connection string ends with `/academyDB`

## Final Connection String Format
```
mongodb+srv://admin_abrahem:abrahem11@cluster0.cbucdjf.mongodb.net/academyDB?retryWrites=true&w=majority&appName=Cluster0
```

Make sure:
- ✅ Username exists in Database Access
- ✅ Password is correct
- ✅ User has proper permissions
- ✅ IP is whitelisted in Network Access
- ✅ Cluster is active (not paused)
- ✅ Database name is `academyDB`
