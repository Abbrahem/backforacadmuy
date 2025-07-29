#!/bin/bash

# Deploy script for Fly.io
echo "🚀 Starting deployment to Fly.io..."

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI is not installed. Please install it first:"
    echo "curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if user is logged in
if ! fly auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Please run: fly auth login"
    exit 1
fi

# Create app if it doesn't exist
echo "📋 Checking if app exists..."
if ! fly apps list | grep -q "areeb-backend"; then
    echo "🔧 Creating new Fly.io app..."
    fly apps create areeb-backend --org personal
fi

# Set secrets if .env file exists
if [ -f .env ]; then
    echo "🔐 Setting environment variables..."
    fly secrets set $(cat .env | grep -v '^#' | xargs)
fi

# Deploy the application
echo "🚀 Deploying to Fly.io..."
fly deploy

echo "✅ Deployment completed!"
echo "🌐 Your app is available at: https://areeb-backend.fly.dev" 