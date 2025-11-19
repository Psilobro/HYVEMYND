/**
 * HYVEMYND Opponent Personalities System
 * Brings AI opponents to life with unique characters, backstories, and voice lines
 */

window.Personalities = {
  // Opponent data with voice lines and visual themes
  opponents: {
    easy: {
      name: "Sunny Pollenpatch",
      title: "The Cheerful Forager",
      emoji: "🌼",
      difficulty: "easy",
      color: "#FFD700", // Golden yellow like sunlight
      accentColor: "#FFA500", // Orange accent
      crest: "🌻", // Sunflower crest
      
      voiceLines: {
        intro: [
          "Oh hey there, friend! Let's have some fun in the hive!",
          "Win or lose, I've got honey cakes waiting after this.",
          "The sun is shining, the flowers are blooming — perfect for a game!",
          "I'm just happy to buzz around the board with you.",
          "Let's keep it light and sweet, like fresh nectar."
        ],
        midGame: [
          "Oops! Did I do that right? Oh well, buzzing along!",
          "You're really good at this… I'm just happy to play!",
          "Flowers, sunshine, and a good game — what more could a bee want?",
          "I think I see a clever move… or maybe it's just pollen in my eyes.",
          "Win or lose, this is sweeter than honey.",
          "I'll try this move — it feels lucky!"
        ],
        victory: [
          "Wow, I actually won! Let's celebrate with nectar smoothies!",
          "That was so much fun — thanks for buzzing with me!",
          "I can't believe it — I won! Let's play again soon.",
          "That was a blast! I'll bring the honey next time.",
          "I guess even a sunny bee gets lucky sometimes!"
        ],
        defeat: [
          "You got me! That was awesome — I'll get better next time.",
          "Losing's not so bad when the game is this sweet.",
          "You're amazing at this! I'll keep practicing.",
          "That was fun! I'll buzz back stronger.",
          "I may have lost, but I had the best time."
        ]
      }
    },
    
    medium: {
      name: "Buzzwell Stingmore",
      title: "The Disciplined Guard",
      emoji: "🛡️",
      difficulty: "medium",
      color: "#708090", // Steel blue-gray
      accentColor: "#4169E1", // Royal blue accent
      crest: "⚔️", // Crossed swords crest
      
      voiceLines: {
        intro: [
          "Steady your wings. This will be a fair but firm match.",
          "I don't underestimate opponents — and neither should you.",
          "Focus your mind. Precision is everything.",
          "I've trained for this moment. Let's begin.",
          "This won't be easy, but it will be fair."
        ],
        midGame: [
          "A solid move. But let's see how it holds up.",
          "Precision and patience — that's the Stingmore way.",
          "You've left an opening. I won't ignore it.",
          "Every piece has its place. Don't forget that.",
          "You're testing me — good. I welcome it.",
          "Discipline wins games, not luck."
        ],
        victory: [
          "Order and discipline prevail once again.",
          "A good match. You've sharpened my edge.",
          "Victory through patience and precision.",
          "Another lesson delivered. Take it to heart.",
          "The hive thrives on structure — and so do I."
        ],
        defeat: [
          "Well played. Even the stern must bow to skill.",
          "You've earned my respect — and the win.",
          "I miscalculated. You seized the moment.",
          "Your strategy was stronger. I accept this loss.",
          "Discipline alone wasn't enough today."
        ]
      }
    },
    
    hard: {
      name: "Beedric Bumbleton",
      title: "Lord of the Royal Hive",
      emoji: "👑",
      difficulty: "hard",
      color: "#4B0082", // Royal purple
      accentColor: "#8B0000", // Dark red accent
      crest: "💎", // Diamond/crown crest
      
      voiceLines: {
        intro: [
          "You dare challenge Lord Beedric Bumbleton? Very well.",
          "This is no game — this is a battle of minds.",
          "I was bred for strategy. You will see why.",
          "The hive's honor rests upon me. Prepare yourself.",
          "I accept your challenge, though you may regret it."
        ],
        midGame: [
          "Every move you make, I have already foreseen.",
          "The hive thrives on order — and I am its enforcer.",
          "You are caught in my web of hexes.",
          "Your defenses crumble before my foresight.",
          "I see ten moves ahead. Do you?",
          "You play well… but not well enough."
        ],
        victory: [
          "Another rival crushed beneath the weight of my strategy.",
          "Your defeat is a tribute to the hive's greatness.",
          "The crown of victory rests where it belongs.",
          "You fought bravely, but the outcome was inevitable.",
          "The hive's nobility does not falter."
        ],
        defeat: [
          "Impossible… and yet undeniable. You have bested me.",
          "Savor this victory — few ever earn it.",
          "You have humbled me. The hive will remember this.",
          "Even nobility must bow to true skill.",
          "You are worthy of respect… and of fear."
        ]
      }
    }
  },
  
  // Current active opponent
  currentOpponent: null,
  
  // Voice line display system
  chatBubble: null,
  chatTimeout: null,
  
  /**
   * Initialize the personality system
   */
  init: function() {
    console.log('🎭 Personality system initialized');
    this.createChatBubble();
  },
  
  /**
   * Set the active opponent for the current game
   */
  setOpponent: function(difficulty) {
    this.currentOpponent = this.opponents[difficulty];
    this._midGameTriggered = false; // Reset mid-game trigger
    console.log(`🎭 Active opponent: ${this.currentOpponent.name} (${difficulty})`);
    
    // Integrate with Nokamute/Mzinga AI engine
    if (typeof window.AIEngineNokamuteMzinga !== 'undefined') {
      const difficultyMap = {
        'easy': 'easy',
        'medium': 'medium',
        'hard': 'hard'
      };
      
      const aiDifficulty = difficultyMap[difficulty] || 'medium';
      window.AIEngineNokamuteMzinga.difficulty = aiDifficulty;
      console.log(`🤖 AI difficulty set to ${aiDifficulty} for ${this.currentOpponent.name}`);
      
      // Show personality intro
      setTimeout(() => {
        this.showVoiceLine('intro');
      }, 1000);
    }
  },
  
  /**
   * Get a random voice line from the current opponent
   */
  getRandomLine: function(category) {
    if (!this.currentOpponent) return null;
    
    const lines = this.currentOpponent.voiceLines[category];
    if (!lines || lines.length === 0) return null;
    
    return lines[Math.floor(Math.random() * lines.length)];
  },
  
  /**
   * Display a voice line in a chat bubble
   */
  showVoiceLine: function(category, duration = 7000) {
    const line = this.getRandomLine(category);
    if (!line) return;
    
    // Clear existing timeout
    if (this.chatTimeout) {
      clearTimeout(this.chatTimeout);
    }
    
    // Update bubble content
    this.chatBubble.innerHTML = `
      <div class="personality-header">
        <span class="crest">${this.currentOpponent.crest}</span>
        <span class="name">${this.currentOpponent.name}</span>
      </div>
      <div class="voice-line">${line}</div>
    `;
    
    // Show bubble with opponent's theme colors
    this.chatBubble.style.display = 'block';
    this.chatBubble.style.borderColor = this.currentOpponent.color;
    this.chatBubble.style.background = `linear-gradient(135deg, ${this.currentOpponent.color}22, ${this.currentOpponent.accentColor}22)`;
    
    // Auto-hide after duration
    this.chatTimeout = setTimeout(() => {
      this.hideChatBubble();
    }, duration);
    
    console.log(`🎭 ${this.currentOpponent.name}: "${line}"`);
  },
  
  /**
   * Hide the chat bubble
   */
  hideChatBubble: function() {
    if (this.chatBubble) {
      this.chatBubble.style.display = 'none';
    }
    if (this.chatTimeout) {
      clearTimeout(this.chatTimeout);
      this.chatTimeout = null;
    }
  },
  
  /**
   * Fade out voice line with animation
   */
  fadeOutVoiceLine: function() {
    if (!this.chatBubble || this.chatBubble.style.display === 'none') return;
    
    // Clear any auto-hide timeout
    if (this.chatTimeout) {
      clearTimeout(this.chatTimeout);
      this.chatTimeout = null;
    }
    
    // Apply transition and fade out
    this.chatBubble.style.transition = 'opacity 1s, transform 1s';
    this.chatBubble.style.opacity = '0';
    this.chatBubble.style.transform = 'scale(0.95)';
    
    // Hide after animation completes
    setTimeout(() => {
      this.chatBubble.style.display = 'none';
      this.chatBubble.style.opacity = '1';
      this.chatBubble.style.transform = 'scale(1)';
      this.chatBubble.style.transition = '';
    }, 1000);
  },
  
  /**
   * Create the floating chat bubble
   */
  createChatBubble: function() {
    this.chatBubble = document.createElement('div');
    this.chatBubble.id = 'personality-chat-bubble';
    this.chatBubble.style.cssText = `
      display: none;
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 300px;
      min-width: 200px;
      background: rgba(42, 42, 42, 0.95);
      border: 2px solid #E6B84D;
      border-radius: 15px;
      padding: 15px;
      color: white;
      font-family: 'Milonga', serif;
      font-size: 14px;
      line-height: 1.4;
      z-index: 5000;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(10px);
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      #personality-chat-bubble .personality-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: bold;
        font-size: 12px;
        opacity: 0.9;
      }
      
      #personality-chat-bubble .crest {
        font-size: 16px;
      }
      
      #personality-chat-bubble .voice-line {
        font-style: italic;
        color: #f0f0f0;
      }
      
      @media (max-width: 768px) {
        #personality-chat-bubble {
          top: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.chatBubble);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.Personalities.init());
} else {
  window.Personalities.init();
}