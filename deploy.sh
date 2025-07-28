#!/bin/bash

echo "🚀 Starting Areeb Backend Deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with required environment variables"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the application
echo "🚀 Starting the application..."
npm start 