/**
 * HYVEMYND AI UI System
 * Handles Single Mode button, difficulty selection, and sandbox return
 */

window.AIUI = {
  initialized: false,
  isAIMode: false,
  difficulty: 'medium'
};

/**
 * Initialize AI UI components
 */
window.AIUI.init = function() {
  if (this.initialized) return;
  
  this.createSingleModeButton();
  this.createReturnToSandboxButton();
  this.createDifficultyModal();
  this.initialized = true;
  
  console.log('🎮 AI UI initialized');
};

/**
 * Create the Single Mode button
 */
window.AIUI.createSingleModeButton = function() {
  const button = document.createElement('button');
  button.id = 'single-mode-button';
  button.innerHTML = '🤖 Single Mode';
  button.onclick = () => this.showDifficultyModal();
  
  document.body.appendChild(button);
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
          <span style="font-size: 24px;">�</span>
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
  
  // Set up the opponent personality
  if (window.Personalities) {
    window.Personalities.setOpponent(difficulty);
  }
  
  console.log(`🎮 Starting Single Player mode (${difficulty} difficulty)`);
  
  // Hide difficulty modal
  this.hideDifficultyModal();
  
  // Enable AI engine
  if (window.AIEngine) {
    window.AIEngine.enable(difficulty);
  }
  
  // Update UI
  this.updateUIForAIMode();
  
  // Reset game if needed
  this.resetGameForAI();
  
  // Get opponent name for notification
  const opponentName = window.Personalities?.opponents[difficulty]?.name || 'AI Opponent';
  
  // Show success notification
  this.showNotification(`🤖 Challenge accepted!\n\nFacing: ${opponentName}\nYou play as White, AI plays as Black.`);
  
  // Show intro voice line after a brief delay
  setTimeout(() => {
    if (window.Personalities) {
      window.Personalities.showVoiceLine('intro');
    }
  }, 2000);
};

/**
 * Return to sandbox mode
 */
window.AIUI.returnToSandbox = function() {
  this.isAIMode = false;
  
  console.log('🏖️ Returning to Sandbox mode');
  
  // Disable AI engine
  if (window.AIEngine) {
    window.AIEngine.disable();
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
  const singleModeBtn = document.getElementById('single-mode-button');
  const sandboxBtn = document.getElementById('return-to-sandbox-button');
  
  if (singleModeBtn) {
    singleModeBtn.style.display = 'none';
  }
  
  if (sandboxBtn) {
    sandboxBtn.style.display = 'block';
  }
  
  // Update HUD to show mode
  const hud = document.getElementById('hud');
  if (hud) {
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
    indicator.textContent = `🤖 vs AI (${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)})`;
    hud.style.position = 'relative';
    hud.appendChild(indicator);
  }
};

/**
 * Update UI elements for sandbox mode
 */
window.AIUI.updateUIForSandboxMode = function() {
  const singleModeBtn = document.getElementById('single-mode-button');
  const sandboxBtn = document.getElementById('return-to-sandbox-button');
  
  if (singleModeBtn) {
    singleModeBtn.style.display = 'block';
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