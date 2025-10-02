#!/bin/bash

# Personal Website Deployment Script
echo "🚀 Deploying Sabrina's Personal Website..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git branch -M main
fi

# Add all files
echo "📁 Adding files to Git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Deploy personal website with 3D room - $(date)"

# Check if remote exists
if ! git remote | grep -q origin; then
    echo "🔗 Please add your GitHub remote:"
    echo "git remote add origin https://github.com/sabpdo/sabpdo.github.io"
    echo "Then run this script again."
    exit 1
fi

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push origin main

echo "✅ Deployment complete!"
