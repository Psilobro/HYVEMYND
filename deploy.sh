#!/bin/bash

echo "🚀 HYVEMYND Quick Deploy to Railway"
echo "=================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📝 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial HYVEMYND commit"
    echo "✅ Git repository created"
else
    echo "📝 Adding latest changes..."
    git add .
    git commit -m "Update HYVEMYND - $(date)"
    echo "✅ Changes committed"
fi

echo ""
echo "🌍 Deployment Options:"
echo "1. Railway (Recommended - Free & Easy)"
echo "2. Vercel (Good for static + serverless)"
echo "3. Heroku (Classic choice)"
echo ""

read -p "Choose deployment option (1-3): " choice

case $choice in
    1)
        echo "🚂 Railway Deployment"
        echo "1. Go to https://railway.app"
        echo "2. Sign up/login with GitHub"
        echo "3. Click 'New Project' → 'Deploy from GitHub'"
        echo "4. Select this repository"
        echo "5. Set root directory to 'backend'"
        echo "6. Deploy!"
        echo ""
        echo "Your app will be available at: https://hyvemynd-production.railway.app"
        ;;
    2)
        echo "⚡ Vercel Deployment"
        if command -v vercel &> /dev/null; then
            vercel --prod
        else
            echo "Installing Vercel CLI..."
            npm i -g vercel
            vercel --prod
        fi
        ;;
    3)
        echo "🌊 Heroku Deployment"
        if command -v heroku &> /dev/null; then
            heroku create hyvemynd-$(date +%s)
            git push heroku main
        else
            echo "Please install Heroku CLI first: https://devcenter.heroku.com/articles/heroku-cli"
        fi
        ;;
    *)
        echo "Invalid option. Please run script again."
        exit 1
        ;;
esac

echo ""
echo "🎮 After deployment:"
echo "1. Copy your deployed URL"
echo "2. Replace 'YOUR_DEPLOYED_SERVER_URL' in www/js/multiplayer.js"
echo "3. Test multiplayer with friends worldwide!"
echo ""
echo "✨ Your HYVEMYND game is ready for global multiplayer! ✨"