# HYVEMYND Multiplayer Setup

## 🌍 Internet Play (Recommended)

To play with friends anywhere in the world, deploy your backend to the cloud:

### Option 1: Railway (Easiest & Free)

1. **Create Railway account**: Go to [railway.app](https://railway.app) and sign up
2. **Deploy from GitHub**:
   ```bash
   # First, create a GitHub repo with your code
   git init
   git add .
   git commit -m "Initial commit"
   # Create repo on GitHub, then push
   ```
3. **Connect to Railway**: 
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Railway will auto-detect and deploy your Node.js app
4. **Get your URL**: Railway will give you a URL like `https://your-app-name.railway.app`
5. **Update your game**: Replace `YOUR_DEPLOYED_SERVER_URL` in `www/js/multiplayer.js` with your Railway URL

### Option 2: Heroku
```bash
# Install Heroku CLI, then:
heroku create your-hive-game
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### Option 3: Render (Free)
1. Go to [render.com](https://render.com)
2. Connect GitHub repo
3. Create "Web Service" 
4. It will auto-deploy from your `backend/` folder

## 🏠 Local Network Play

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start the Server
```bash
npm run dev
```

### 3. Play Locally
1. Open `http://localhost:3000` in two browser windows
2. Click "🌐 Multiplayer" → "🎮 Create New Game" 
3. Share the generated link with local players

## How It Works

### Architecture
- **Backend**: Node.js + Express + Socket.IO server
- **Frontend**: Socket.IO client integrated with existing game logic
- **Sync**: Real-time action broadcasting between players

### Key Features
- **Room-based**: Players share a room ID via URL hash
- **Turn enforcement**: Only current player can make moves
- **Action sync**: All placements/moves broadcast to opponents
- **Reconnection**: Game state restored when rejoining
- **Minimal integration**: Uses existing game APIs

### Room Management
- Room IDs are generated automatically or from URL hash
- First player gets white, second gets black
- Rooms auto-cleanup after 5 minutes of inactivity
- Players can rejoin and restore game state

### Game Flow
1. Player makes a move using existing UI
2. Move is validated by existing game logic
3. Action is broadcast to all other players in room
4. Opponents receive and apply the action
5. Turn switches automatically

## Files Created

- `backend/package.json` - Dependencies and scripts
- `backend/server.js` - Socket.IO server with room management
- `www/js/multiplayer.js` - Frontend Socket.IO client
- `www/index.html` - Updated to include multiplayer scripts

## Advanced Usage

### Custom Room IDs
Change the URL hash to join a specific room:
```
http://localhost:3000#MYROOM
```

### Development
The server runs with `nodemon` for auto-restart during development.

### Production Deployment
1. Set `NODE_ENV=production`
2. Use `npm start` instead of `npm run dev`
3. Configure reverse proxy (nginx) for production

## Troubleshooting

### Port Issues
If port 3000 is in use, set a different port:
```bash
PORT=3001 npm run dev
```

### Connection Issues
- Check that both players are using the same server URL
- Ensure firewall allows connections on the server port
- Check browser console for Socket.IO connection errors

### Game State Issues
- Refresh both browser windows to reset state
- Check server console for room and player status
- Ensure both players have joined the same room ID

## Technical Notes

### Integration Points
The multiplayer system hooks into your existing game functions:
- `commitPlacement()` and `commitMove()` for action broadcasting
- `updateHUD()` for turn status updates
- Existing animation and validation systems remain unchanged

### Data Flow
```
Player Action → Game Validation → Socket Broadcast → Opponent Receives → Opponent Applies Action
```

Your existing single-player game logic handles all validation and rules - the multiplayer layer just synchronizes actions between players.