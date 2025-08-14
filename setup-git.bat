@echo off
echo 🚀 JobsRo Platform - GitHub Repository Setup
echo ==========================================

echo.
echo Step 1: Initializing Git repository...
git init

echo.
echo Step 2: Adding all files to Git...
git add .

echo.
echo Step 3: Creating initial commit...
git commit -m "Initial commit: JobsRo platform ready for deployment"

echo.
echo ✅ Git repository setup complete!
echo.
echo Next steps:
echo 1. Create a new repository on GitHub.com
echo 2. Run: git remote add origin https://github.com/YOUR_USERNAME/jobsro-platform.git  
echo 3. Run: git push -u origin main
echo 4. Follow the DEPLOYMENT_GUIDE.md for Vercel and Render setup
echo.
pause