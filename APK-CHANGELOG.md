# HYVEMYND Debug APK - November 19, 2025

## 📦 Build Info
- **Filename**: `HYVEMYND-debug-2025-11-19.apk`
- **Size**: 65.38 MB
- **Build Type**: Debug (unsigned, for testing only)
- **Date**: November 19, 2025

## ✨ New Features in This Build

### 🎮 Complete Engine Parameter Tuning System
- **Aggression Control** (1-5 scale): Defensive → Cautious → Balanced → Aggressive → Reckless
- **Hash Table Size** (16-256 MB): Configure engine memory for search depth
- **Random Opening**: Add variety to opening moves
- **Verbose Mode**: Enable detailed engine output (foundation for dual consoles)

### 🖥️ Dual AI Thinking Consoles
- White AI console (left side, green text on black)
- Black AI console (right side, amber text on black)
- Retro terminal styling with auto-scroll
- Shows each AI's thinking process during battles (verbose output parsing coming soon)

### ⚙️ Enhanced Personalities Panel
Each AI personality (Sunny, Buzzwell, Beedric) now has full configuration:
- Time limit slider (1-20 seconds)
- Search depth slider (2-12 ply)
- **NEW**: Aggression slider with descriptive labels
- **NEW**: Hash size dropdown menu
- **NEW**: Random opening checkbox
- **NEW**: Save/Reset/Test buttons
- **NEW**: Settings persistence via localStorage

### 🔧 Engine Integration Improvements
- Correct UHP protocol `bestmove time HH:MM:SS` format
- Personality options applied before each move (aggression, hash, verbose, random opening)
- Time enforcement diagnostics (tracks actual vs limit times)
- Automatic fallback handling for engine errors

### 📊 Behind the Scenes
- **wasm-engine.js**: Added `setAggression()`, `setHash()`, `setVerbose()`, `setRandomOpening()` methods
- **wasm-integration.js**: Personality defaults now include all engine parameters
- **personality-ui.js**: New UI manager for save/load/reset personality settings
- **dev-ops.js**: Applies personality options before AI moves in battles

## 🎯 How to Test

### 1. Install APK
Transfer `HYVEMYND-debug-2025-11-19.apk` to your Android device and install. You may need to enable "Install from Unknown Sources" in Settings.

### 2. Test Personality Settings
1. Open game → Settings → Dev Ops → Personalities
2. Adjust Sunny's aggression to 5 (Reckless)
3. Set hash to 256 MB for maximum strength
4. Click "💾 Save Settings"
5. Play vs Sunny and observe aggressive playstyle

### 3. Test AI vs AI Battles
1. Go to Dev Ops → Battle Simulator
2. Select two different AIs (e.g., Sunny vs Beedric)
3. Start battle and watch the dual consoles show thinking (if verbose enabled)
4. Check console logs for timing diagnostics

### 4. Test Time Enforcement
1. Set Sunny to 1 second time limit
2. Play a game against Sunny
3. Observe moves complete within ~1 second
4. Check browser console for time diagnostics (connect via USB debugging)

## 🐛 Known Issues
- Dual consoles don't populate yet (verbose output capture needs implementation)
- AI vs AI console auto-show logic not yet added
- Some personality settings may need fine-tuning based on device performance

## 📱 Device Requirements
- Android 5.0+ (API 21+)
- ~100 MB free storage
- Recommended: 2GB+ RAM for optimal performance with high hash sizes

## 🔍 Debug Features
This is a debug build with:
- Chrome DevTools remote debugging support (chrome://inspect)
- Console logging enabled
- No ProGuard obfuscation
- Source maps included

## 📝 Installation Notes
1. Enable "Unknown Sources" in Android Settings
2. Transfer APK via USB, email, or cloud storage
3. Tap APK file to install
4. Grant any requested permissions
5. Launch HYVEMYND from app drawer

## 🎮 Enjoy!
This build includes all the latest engine tuning features. Experiment with different personality settings to find your perfect challenge level!

---
*For issues or feedback, check the browser console via USB debugging (chrome://inspect) or test in the web version at http://localhost:3000*
