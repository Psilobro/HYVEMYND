/**
 * HYVEMYND AI UI System
 * Handles Single Mode button, difficulty selection, and sandbox return
 */

window.AIUI = {
  initialized: false,
  isAIMode: false,
  difficulty: 'medium',
  aiMoveCount: 0,
  maxMoves: 300, // 150 moves per player - covers even longest professional games
  moveTimeout: 60000, // 60 seconds per move
  emergencyTimeout: 120000 // 120 seconds absolute maximum
};

/**
 * Initialize AI UI components
 */
window.AIUI.init = function() {
  if (this.initialized) return;
  
  // Don't create single mode button - now handled by settings menu
  this.createReturnToSandboxButton();
  this.createDifficultyModal();
  this.initialized = true;
  
  console.log('🎮 AI UI initialized');
};

/**
 * Show difficulty modal - called by settings menu
 */
window.showAIDifficultyModal = function() {
  if (window.AIUI && window.AIUI.showDifficultyModal) {
    window.AIUI.showDifficultyModal();
  }
};

/**
 * Create the Return to Sandbox button (initially hidden)
 */
window.AIUI.createReturnToSandboxButton = function() {
  const button = document.createElement('button');
  button.id = 'return-to-sandbox-button';
  button.innerHTML = '🏖️ Return to Sandbox';
  button.style.display = 'none';
  button.onclick = () => this.returnToSandbox();
  
  document.body.appendChild(button);
};

/**
 * Create the difficulty selection modal
 */
window.AIUI.createDifficultyModal = function() {
  const modal = document.createElement('div');
  modal.id = 'ai-difficulty-modal';
  modal.style.cssText = `
    display: none; 
    position: fixed; 
    top: 0; 
    left: 0; 
    width: 100%; 
    height: 100%;
    background: rgba(0,0,0,0.8); 
    z-index: 10000; 
    align-items: center; 
    justify-content: center;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: #2a2a2a; 
    border-radius: 15px; 
    padding: 30px; 
    max-width: 500px; 
    width: 90%;
    color: white; 
    font-family: 'Milonga', serif; 
    text-align: center; 
    position: relative;
    border: 2px solid #E6B84D;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  `;
  
  content.innerHTML = `
    <button id="close-ai-modal" style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: #fff; font-size: 24px; cursor: pointer;">&times;</button>
    <h2 style="margin-top: 0; color: #E6B84D;">🤖 Single Player Mode</h2>
    
    <p style="margin-bottom: 25px; color: #ccc; line-height: 1.4;">
      Challenge the AI opponent! You play as White, AI plays as Black.
    </p>
    
    <div id="difficulty-options" style="display: flex; flex-direction: column; gap: 15px;">
      <button class="difficulty-btn" data-difficulty="easy" style="
        background: linear-gradient(135deg, #FFD700, #FFA500); 
        color: white; 
        border: 2px solid #FFD700;
        padding: 18px 25px; 
        border-radius: 12px; 
        font-size: 16px; 
        font-family: 'Milonga', serif;
        cursor: pointer;
        transition: all 0.3s ease;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">🌻</span>
          <div style="text-align: left;">
            <strong>Sunny Pollenpatch</strong><br>
            <small style="opacity: 0.9;">🌼 Easy • The Cheerful Forager</small>
          </div>
        </div>
      </button>
      
      <button class="difficulty-btn" data-difficulty="medium" style="
        background: linear-gradient(135deg, #708090, #4169E1); 
        color: white; 
        border: 2px solid #708090;
        padding: 18px 25px; 
        border-radius: 12px; 
        font-size: 16px; 
        font-family: 'Milonga', serif;
        cursor: pointer;
        transition: all 0.3s ease;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">⚔️</span>
          <div style="text-align: left;">
            <strong>Buzzwell Stingmore</strong><br>
            <small style="opacity: 0.9;">🛡️ Medium • The Disciplined Guard</small>
          </div>
        </div>
      </button>
      
      <button class="difficulty-btn" data-difficulty="hard" style="
        background: linear-gradient(135deg, #4B0082, #8B0000); 
        color: white; 
        border: 2px solid #4B0082;
        padding: 18px 25px; 
        border-radius: 12px; 
        font-size: 16px; 
        font-family: 'Milonga', serif;
        cursor: pointer;
        transition: all 0.3s ease;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">👑</span>
          <div style="text-align: left;">
            <strong>Beedric Bumbleton</strong><br>
            <small style="opacity: 0.9;">👑 Hard • Lord of the Royal Hive</small>
          </div>
        </div>
      </button>
    </div>
    
    <div style="margin-top: 20px; padding: 10px; background: rgba(230, 184, 77, 0.1); border-radius: 5px; font-size: 14px; color: #E6B84D;">
      💡 <strong>Tip:</strong> Start with Easy to learn, then challenge yourself with harder difficulties!
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('close-ai-modal').onclick = () => this.hideDifficultyModal();
  
  // Add hover effects and click handlers for difficulty buttons
  const difficultyBtns = content.querySelectorAll('.difficulty-btn');
  difficultyBtns.forEach(btn => {
    btn.onmouseover = () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    };
    btn.onmouseout = () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = 'none';
    };
    btn.onclick = () => {
      const difficulty = btn.getAttribute('data-difficulty');
      this.startAIMode(difficulty);
    };
  });
  
  // Close modal when clicking outside
  modal.onclick = (e) => {
    if (e.target === modal) this.hideDifficultyModal();
  };
};

/**
 * Show the difficulty selection modal
 */
window.AIUI.showDifficultyModal = function() {
  const modal = document.getElementById('ai-difficulty-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
};

/**
 * Hide the difficulty selection modal
 */
window.AIUI.hideDifficultyModal = function() {
  const modal = document.getElementById('ai-difficulty-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

/**
 * Start AI mode with selected difficulty
 */
window.AIUI.startAIMode = function(difficulty) {
  this.difficulty = difficulty;
  this.isAIMode = true;
  this.aiMoveCount = 0; // Reset move counter when starting new game
  
  // Get personality settings from dev-ops system
  let settings;
  if (window.devOpsSystem && window.devOpsSystem.getPersonalitySettings) {
    settings = window.devOpsSystem.getPersonalitySettings(difficulty);
  }
  
  // Fallback to default settings if not available
  if (!settings) {
    const defaultSettings = {
      'easy': { timeLimit: 2, depthLimit: 3, mode: 'time' },
      'medium': { timeLimit: 4, depthLimit: 5, mode: 'time' },
      'hard': { timeLimit: 10, depthLimit: 8, mode: 'time' }
    };
    settings = defaultSettings[difficulty] || defaultSettings['medium'];
  }
  
  console.log(`🎮 Starting Single Player mode with UHP engine (${difficulty}): ${JSON.stringify(settings)}`);
  
  // Set global single player mode flag and AI color (default: AI plays black)
  window.singlePlayerMode = true;
  window.singlePlayerAIColor = 'black'; // AI plays black, human plays white by default
  
  // Configure WASM engine with personality-specific settings
  if (window.wasmEngine) {
    console.log(`🧩 Configuring WASM engine for ${difficulty} difficulty`);
    
    // Initialize WASM engine if needed
    if (!window.wasmEngine.initialized) {
      window.wasmEngine.initialize().then(() => {
        console.log('✅ WASM engine ready for Single Mode');
      }).catch(error => {
        console.error('❌ WASM engine initialization failed:', error);
      });
    }
    
    // Store settings in AIUI object for personality detection
    this.currentDifficulty = difficulty;
    this.currentSettings = {
      timeLimit: settings.timeLimit,
      depthLimit: settings.depthLimit,
      mode: settings.mode
    };
    
    // Update UI elements to reflect these settings
    const enabledCheckbox = document.getElementById('engine-enabled');
    if (enabledCheckbox) enabledCheckbox.checked = true;
    
    const timeSlider = document.getElementById('time-limit');
    const timeValue = document.getElementById('time-value');
    if (timeSlider && timeValue) {
      timeSlider.value = settings.timeLimit;
      timeValue.textContent = `${settings.timeLimit}s`;
    }
    
    const depthSlider = document.getElementById('depth-limit');
    const depthValue = document.getElementById('depth-value');
    if (depthSlider && depthValue) {
      depthSlider.value = settings.depthLimit;
      depthValue.textContent = `${settings.depthLimit} ply`;
    }
    
    const modeSelect = document.getElementById('engine-mode');
    if (modeSelect) modeSelect.value = settings.mode;
    
    const colorSelect = document.getElementById('engine-color');
    if (colorSelect) colorSelect.value = 'black'; // AI plays black
    
    console.log(`🤖 WASM engine configured for ${difficulty} difficulty`);
  } else {
    console.warn('⚠️ WASM engine not available');
  }
  
  // Set personality for voice lines and theming
  const personalityDifficulty = difficulty === 'hard-v2' ? 'hard' : difficulty;
  if (window.Personalities) {
    window.Personalities.setOpponent(personalityDifficulty);
  }
  
  // Hide difficulty modal
  this.hideDifficultyModal();
  
  // Update UI
  this.updateUIForAIMode();
  
  // Reset game if needed
  this.resetGameForAI();
  
  // Reset AI move counter for safety limits
  if (window.resetAIMoveCounter) {
    window.resetAIMoveCounter();
  }
  
  // Get opponent name for notification
  const baseDifficulty = difficulty === 'hard-v2' ? 'hard' : difficulty;
  const opponentName = window.Personalities?.opponents[baseDifficulty]?.name || 'AI Opponent';
  const engineType = window.uhpClient?.connected ? ' (Nokamute Engine)' : ' (Built-in AI)';
  
  // Show success notification
  this.showNotification(`🤖 Challenge accepted!\n\nFacing: ${opponentName}${engineType}\nYou play as White, AI plays as Black.`);
  
  // Show intro voice line after a brief delay
  setTimeout(() => {
    if (window.Personalities) {
      window.Personalities.showVoiceLine('intro');
    }
  }, 2000);
};

/**
 * Update personality settings from dev-ops system
 */
window.AIUI.updatePersonalitySettings = function(settings) {
  console.log('🎭 AI UI received updated personality settings:', settings);
  // Settings are now managed by dev-ops system and applied when starting games
};

/**
 * Return to sandbox mode
 */
window.AIUI.returnToSandbox = function() {
  this.isAIMode = false;
  
  console.log('🏖️ Returning to Sandbox mode');
  
  // Disable UHP engine
  if (window.uhpClient) {
    window.uhpClient.setSetting('enabled', false);
    
    // Update UI elements
    const enabledCheckbox = document.getElementById('engine-enabled');
    if (enabledCheckbox) enabledCheckbox.checked = false;
    
    console.log('🤖 UHP engine disabled for sandbox mode');
  }
  
  // Also disable any legacy AI engines that might be loaded
  if (window.AIEngine && window.AIEngine.disable) {
    window.AIEngine.disable();
    console.log('🤖 Legacy AI engine disabled');
  }
  
  // Hide personality chat bubble
  if (window.Personalities) {
    window.Personalities.hideChatBubble();
    window.Personalities.currentOpponent = null;
  }
  
  // Update UI
  this.updateUIForSandboxMode();
  
  // Show notification
  this.showNotification('🏖️ Sandbox mode activated!\n\nFree play - move any piece, experiment with positions.');
};

/**
 * Update UI elements for AI mode
 */
window.AIUI.updateUIForAIMode = function() {
  const sandboxBtn = document.getElementById('return-to-sandbox-button');
  
  // Hide settings menu while in AI mode (optional)
  const settingsContainer = document.getElementById('settings-menu-container');
  if (settingsContainer) {
    settingsContainer.style.opacity = '0.5';
    settingsContainer.style.pointerEvents = 'none';
  }
  
  if (sandboxBtn) {
    sandboxBtn.style.display = 'block';
  }
  
  // Update HUD to show mode
  const hud = document.getElementById('hud');
  if (hud) {
    // Remove existing indicator
    const existingIndicator = document.getElementById('ai-mode-indicator');
    if (existingIndicator) existingIndicator.remove();
    
    // Add AI mode indicator
    const indicator = document.createElement('div');
    indicator.id = 'ai-mode-indicator';
    indicator.style.cssText = `
      position: absolute;
      top: -25px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(76, 175, 80, 0.8);
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-family: 'Milonga', serif;
      white-space: nowrap;
    `;
    
    // Determine engine type for display
    const engineType = (window.uhpClient && window.uhpClient.connected && window.uhpClient.isEnabled()) ? 'Nokamute' : 'Built-in';
    const difficultyName = this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1);
    
    indicator.textContent = `🤖 vs AI (${difficultyName} • ${engineType})`;
    hud.style.position = 'relative';
    hud.appendChild(indicator);
  }
};

/**
 * Update UI elements for sandbox mode
 */
window.AIUI.updateUIForSandboxMode = function() {
  const sandboxBtn = document.getElementById('return-to-sandbox-button');
  
  // Re-enable settings menu
  const settingsContainer = document.getElementById('settings-menu-container');
  if (settingsContainer) {
    settingsContainer.style.opacity = '1';
    settingsContainer.style.pointerEvents = 'all';
  }
  
  if (sandboxBtn) {
    sandboxBtn.style.display = 'none';
  }
  
  // Remove AI mode indicator
  const indicator = document.getElementById('ai-mode-indicator');
  if (indicator) {
    indicator.remove();
  }
};

/**
 * Reset game state for AI match
 */
window.AIUI.resetGameForAI = function() {
  // Reset game state if reset function exists
  if (typeof resetGame === 'function') {
    resetGame();
  } else {
    // Manual reset if no reset function available
    if (window.state) {
      window.state.current = 'white'; // Player always starts as white
      window.state.gameOver = false;
    }
    
    // Clear any selections
    if (window.selected) {
      window.selected = null;
    }
    
    // Update HUD
    if (typeof updateHUD === 'function') {
      updateHUD();
    }
  }
};

/**
 * Show a notification message
 */
window.AIUI.showNotification = function(message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(230, 184, 77, 0.95);
    color: #4B382A;
    padding: 15px 25px;
    border-radius: 10px;
    font-family: 'Milonga', serif;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
    z-index: 10001;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    max-width: 300px;
    white-space: pre-line;
    animation: slideDown 0.3s ease-out;
  `;
  
  // Add CSS animation
  if (!document.getElementById('ai-notification-style')) {
    const style = document.createElement('style');
    style.id = 'ai-notification-style';
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-20px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'slideUp 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
};

/**
 * Get current AI mode status
 */
window.AIUI.getStatus = function() {
  return {
    isAIMode: this.isAIMode,
    difficulty: this.difficulty,
    aiEnabled: window.AIEngine ? window.AIEngine.enabled : false
  };
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.AIUI.init();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.AIUI.init();
  });
} else {
  window.AIUI.init();
}

console.log('🎮 AI UI System loaded successfully');