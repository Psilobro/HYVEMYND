# Deploy HYVEMYND to Render (Free Forever! 🆓)

## 🚀 Quick Deploy Steps:

### Step 1: Push to GitHub (if not done already)
```bash
git init
git add .
git commit -m "Initial HYVEMYND commit"
# Create new repo on GitHub, then:
git remote add origin https://github.com/yourusername/HYVEMYND.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Render
1. **Go to [render.com](https://render.com)** and sign up (free)
2. **Connect your GitHub account**
3. **Click "New +" → "Web Service"**
4. **Select your HYVEMYND repository**
5. **Use these settings**:
   - **Name**: `hyvemynd-backend`
   - **Runtime**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: **Free** (0$/month)

### Step 3: Get Your URL
After deployment, Render gives you a URL like:
```
https://hyvemynd-backend.onrender.com
```

### Step 4: Update Your Game
Replace this line in `www/js/multiplayer.js`:
```javascript
const deployedServerUrl = 'YOUR_RENDER_SERVER_URL';
```
with:
```javascript
const deployedServerUrl = 'https://hyvemynd-backend.onrender.com';
```

### Step 5: Test Worldwide! 🌍
- Use Live Server to open your game locally
- Click "🌐 Multiplayer" → "🎮 Create New Game"
- Share the generated link with friends anywhere!

## ✅ What You Get (FREE):
- **750 hours/month** (25 hours/day - plenty for gaming!)
- **Global CDN** - Fast worldwide
- **Auto-scaling** - Handles multiple players
- **HTTPS** - Secure connections
- **WebSocket support** - Real-time chat & moves
- **No credit card required**

## 🔧 Render Features:
- **Auto-deploy** from GitHub pushes
- **Environment variables** (already configured)
- **Health checks** (built-in)
- **Sleep after 15min idle** (wakes up instantly when used)

## 🐛 Troubleshooting:
- **Service won't start?** Check the Render logs for errors
- **Can't connect?** Make sure you updated the URL in multiplayer.js
- **Timeout errors?** Free services sleep after 15min - first request wakes it up

## 💡 Pro Tips:
- **Keep it active**: Visit your game URL occasionally to prevent sleeping
- **Monitor usage**: Check your Render dashboard for usage stats
- **Custom domain**: You can add your own domain for free!

Your game will be available worldwide at your Render URL! 🎮