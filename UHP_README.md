# HYVEMYND UHP Engine Integration 🐝🤖

Transform your HYVEMYND game into a Universal Hive Protocol (UHP) viewer that can connect with tournament-strength engines like **Nokamute** and **Mzinga**!

## 🎯 What This Gives You

- **Tournament AI**: Play against world-class Hive engines
- **Engine Console**: Beautiful HYVEMYND-themed engine controls
- **Easy Setup**: One-click bridge setup and engine management
- **Seamless Integration**: Keeps all your animations, sounds, and UI
- **Multiple Engines**: Support for Nokamute, Mzinga, and custom engines

## 🚀 Quick Start

### 1. Setup UHP Bridge
```bash
cd tools
setup.bat  # Installs dependencies and checks for engines
```

### 2. Start the Bridge
```bash
npm start  # Starts WebSocket bridge on port 8080
```

### 3. Use in Game
1. Open HYVEMYND in your browser
2. Click **⚙️ Dev. Ops** → **🔧 Engine** tab
3. Enable UHP Engine and configure settings
4. Start a game - the engine plays automatically!

## 📁 File Structure

```
HYVEMYND/
├── tools/
│   ├── uhp-bridge.js       # WebSocket bridge server
│   ├── package.json        # Bridge dependencies
│   └── setup.bat          # One-click setup
├── www/js/uhp/
│   ├── uhp-client.js       # Browser UHP client
│   └── engine-integration.js # Engine controls integration
└── engines/               # Place engine executables here
    ├── nokamute.exe       # Tournament Nokamute engine
    └── MzingaEngine.exe   # Reference Mzinga engine
```

## 🔧 Engine Setup

### Nokamute (Recommended)
1. Download from [nokamute releases](https://github.com/edre/nokamute/releases)
2. Place `nokamute.exe` in one of these locations:
   - `tools/nokamute.exe`
   - `engines/nokamute.exe`
   - `reference-ai-5/target/release/nokamute.exe`

### Mzinga
1. Download from [Mzinga releases](https://github.com/jonthysell/Mzinga/releases)
2. Place `MzingaEngine.exe` in:
   - `engines/MzingaEngine.exe`
   - `reference-ai-4/MzingaEngine.exe`

### Custom Engines
Any UHP-compliant engine can be added via the Engine tab's custom engine option.

## 🎮 Engine Controls

### Connection Status
- **Green dot**: Connected and ready
- **Red dot**: Disconnected (using built-in AI)
- **Orange dot**: Connecting/starting engine

### Engine Settings
- **Mode**: Time-limited or depth-limited search
- **Time Limit**: 1-30 seconds thinking time
- **Search Depth**: 1-10 ply lookahead
- **Engine Plays**: Black, White, or Both players

### Advanced Features
- **Real-time log**: See engine communication
- **Test engine**: Verify connection and responsiveness
- **Multiple engines**: Switch between different engines
- **Fallback AI**: Automatic fallback to built-in AI if engine fails

## 🔍 Troubleshooting

### "Connection failed"
1. Ensure bridge is running: `cd tools && npm start`
2. Check Windows Firewall isn't blocking port 8080
3. Verify engine executable is in correct location

### "Engine not found"
1. Run `setup.bat` to check engine locations
2. Copy engine executable to one of the searched paths
3. Try custom engine path in Engine tab

### "No response from engine"
1. Click "Test Engine" to verify engine works
2. Check engine log for error messages
3. Try restarting the engine

### Game performance issues
1. Increase time limit for stronger play
2. Decrease depth limit for faster moves
3. Use built-in AI as fallback if needed

## 📊 Features

### UHP Bridge
- **Auto-discovery**: Finds engines in common locations
- **Multi-client**: Multiple browser tabs can connect
- **Error handling**: Graceful engine restart on crashes
- **Cross-platform**: Works on Windows, Mac, Linux

### Browser Integration
- **Seamless UI**: Beautiful HYVEMYND-themed controls
- **Settings persistence**: Remembers your preferences
- **Real-time status**: Live connection and thinking indicators
- **Game integration**: Hooks into existing AI system

### Engine Management
- **Hot-swapping**: Change engines without restarting
- **Configuration**: Full control over engine parameters
- **Logging**: Detailed communication logs
- **Testing**: Built-in engine testing tools

## 🏆 Tournament Play

Your HYVEMYND game can now play at tournament strength! Nokamute is a top-tier Hive engine that competes in international tournaments.

### Recommended Settings for Strong Play
- **Engine**: Nokamute
- **Mode**: Time Limited
- **Time Limit**: 10-15 seconds
- **Engine Plays**: Black (AI opponent)

### Quick Tournament Games
- **Engine**: Nokamute  
- **Mode**: Depth Limited
- **Search Depth**: 4-6 ply
- **Time Limit**: 3-5 seconds

## 🛠️ Development

### Adding New Engines
1. Add engine path to `ENGINE_PATHS` in `uhp-bridge.js`
2. Test with `node uhp-bridge.js --engine "path/to/engine.exe"`
3. Add to engine selection dropdown if needed

### Extending UHP Support
- GameString parser for complex positions
- Move history export/import
- Engine options configuration
- Multi-PV (best move variations)

## 📚 Resources

- [Universal Hive Protocol Specification](docs/UniversalHiveProtocol.txt)
- [Nokamute Engine](https://github.com/edre/nokamute)
- [Mzinga Engine](https://github.com/jonthysell/Mzinga)
- [BoardSpace Hive](https://www.boardspace.net/hive/english/)

## 🎉 Enjoy!

You now have a tournament-grade Hive playing experience with all the beauty and polish of HYVEMYND. The engines will challenge you to improve your game while you enjoy the amazing animations, sounds, and visual effects.

**Happy Gaming!** 🐝🏆