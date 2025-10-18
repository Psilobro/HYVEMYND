# Deploy HYVEMYND to Railway

## Quick Deploy Steps:

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Push to GitHub** (if not done already)
   ```bash
   git init
   git add .
   git commit -m "Initial HYVEMYND commit"
   # Create new repo on GitHub, then:
   git remote add origin https://github.com/yourusername/HYVEMYND.git
   git branch -M main
   git push -u origin main
   ```

3. **Deploy to Railway**
   - Login to Railway
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your HYVEMYND repository
   - Railway will auto-detect it's a Node.js app
   - Set root directory to `backend`
   - Click Deploy!

4. **Get Your URL**
   - After deployment, Railway gives you a URL like: `https://hyvemynd-production.railway.app`
   - Copy this URL

5. **Update Your Game**
   - In `www/js/multiplayer.js`, replace:
   ```javascript
   const deployedServerUrl = 'YOUR_DEPLOYED_SERVER_URL';
   ```
   with:
   ```javascript
   const deployedServerUrl = 'https://hyvemynd-production.railway.app';
   ```

6. **Test Internet Play**
   - Open your game via Live Server
   - Click "🌐 Multiplayer" → "🎮 Create New Game"
   - Share the generated link with friends worldwide!

## Environment Variables (if needed):
- `NODE_ENV=production` (Railway sets this automatically)
- `PORT` (Railway sets this automatically)

## Custom Domain (Optional):
- In Railway dashboard, go to Settings → Domains
- Add your custom domain

Your game will now be accessible worldwide! 🌍