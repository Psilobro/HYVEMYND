/**
 * HYVEMYND AI Engine
 * Monte Carlo Tree Search AI for Hive game
 */

// Global debug logging helper
function debugLog(...args) {
  if (window.AIEngine && window.AIEngine.debugMode) {
    console.log(...args);
  }
}

window.AIEngine = {
  // AI Configuration
  enabled: false,
  difficulty: 'medium',
  color: 'black', // AI always plays black
  thinking: false,
  debugMode: false, // Set to true to enable detailed console logging
  
  thinkingTime: {
    easy: 3000,      // 3 seconds
    medium: 8000,    // 8 seconds  
    hard: 25000      // 25 seconds - truly strategic thinking
  },
  
  // MCTS Parameters - MUCH DEEPER THINKING FOR STRATEGIC PLAY
  explorationConstant: Math.sqrt(2),
  simulationDepth: 50, // Increased from 35 for much deeper lookahead
  iterationsPerMove: {
    easy: 1000,      // Doubled for better play
    medium: 2000,   // Doubled for strong play
    hard: 3000       // Reduced for much faster expert-level analysis
  },
  
  // ZERO-SPAM LOGGING SYSTEM - Only final decisions
  logging: {
    enabled: true,
    level: 'minimal', // Only critical strategic decisions
    progressInterval: 15000, // Show progress only at completion
    maxEvaluationLogs: 0,   // ZERO evaluation logs during search
    showFinalAnalysis: true, // Always show final move decision
    
    // Counters to limit spam  
    evaluationLogCount: 0,
    simulationLogCount: 0,
    backpropLogCount: 0
  },
  
  // NO TIME LIMITS - Let AI think as long as needed
  timeLimit: {
    easy: Infinity,    // No time limit
    medium: Infinity,  // No time limit
    hard: Infinity     // No time limit
  },
  
  // Strategy depth by difficulty
  strategyDepth: {
    easy: 1,         // Basic immediate threats
    medium: 2,       // Look ahead 2 moves, tactical patterns
    hard: 3          // Deep analysis, complex patterns
  },
  
  // Game state cache
  gameStateCache: null,
  lastMoveIndex: -1,
  
  // INTELLIGENT LOGGING SYSTEM
  smartLog: function(level, message, ...args) {
    if (!this.logging.enabled) return;
    
    const levels = { minimal: 0, strategic: 1, detailed: 2, verbose: 3 };
    const currentLevel = levels[this.logging.level] || 1;
    const messageLevel = levels[level] || 1;
    
    if (messageLevel <= currentLevel) {
      console.log(message, ...args);
    }
  },
  
  resetLogCounters: function() {
    this.logging.evaluationLogCount = 0;
    this.logging.simulationLogCount = 0;
    this.logging.backpropLogCount = 0;
  }
};

/**
 * MCTS Node class for the search tree
 */
class MCTSNode {
  constructor(gameState, move, parent) {
    this.gameState = gameState;
    this.move = move; // {type: 'place'|'move', piece: obj, q: number, r: number}
    this.parent = parent;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.untriedMoves = null;
  }
  
  isFullyExpanded() {
    return this.untriedMoves !== null && this.untriedMoves.length === 0;
  }
  
  isTerminal() {
    return AIEngine.isGameOver(this.gameState);
  }
  
  ucb1() {
    if (this.visits === 0) return Infinity;
    const exploitation = this.wins / this.visits;
    const exploration = window.AIEngine.explorationConstant * Math.sqrt(Math.log(this.parent.visits) / this.visits);
    return exploitation + exploration;
  }
}

/**
 * Enhanced thinking UI with progress indicators
 */
window.AIEngine.updateThinkingUI = function(phase, progress, details = {}) {
  const hud = document.getElementById('hud');
  if (!hud) return;
  
  // Get the current opponent's name, fallback to "Beedric" for original engine
  let aiName = "Beedric";
  if (window.Personalities && window.Personalities.currentOpponent) {
    aiName = window.Personalities.currentOpponent.name.split(' ')[0]; // Use first name only
  }
  
  const phaseMessages = {
    'initializing': `🧠 ${aiName} is contemplating...`,
    'tactical': `⚡ ${aiName}: Analyzing tactical patterns...`,
    'strategic': `📈 ${aiName}: Planning strategic moves...`,
    'simulation': `🎯 ${aiName}: Running position simulations...`,
    'evaluation': `🔍 ${aiName}: Evaluating candidate moves...`,
    'minimax': `🧠 ${aiName}: Deep tactical calculation...`,
    'mcts': `🌳 ${aiName}: Monte Carlo tree search...`,
    'finalizing': `✨ ${aiName}: Finalizing decision...`,
    'complete': `🎯 ${aiName}: Move decided!`,
    'error': `⚠️ ${aiName}: Encountered error, completing analysis...`
  };
  
  let message = phaseMessages[phase] || `🧠 ${aiName} is contemplating...`;
  
  // Special handling for completion phase
  if (phase === 'complete') {
    message = `🎯 ${aiName}: Move decided!`;
    if (details.move) {
      const moveType = details.move.type === 'placement' ? 'Placing' : 'Moving';
      const piece = details.move.piece?.meta?.key || '?';
      message += `<br>📍 ${moveType} ${piece} to (${details.move.q},${details.move.r})`;
    }
    hud.innerHTML = message;
    
    // Clear the thinking UI after a short delay
    setTimeout(() => {
      hud.innerHTML = ''; // Clear thinking display
    }, 2000);
    return;
  }
  if (progress > 0) {
    const progressBar = this.createProgressBar(progress);
    message += `<br><div style="font-family: monospace; font-size: 14px; margin: 5px 0;">${progressBar} ${Math.round(progress)}%</div>`;
  }
  
  if (details.iterations && details.total) {
    message += `<br><span style="color: #90CAF9;">🔢 Progress: ${details.iterations.toLocaleString()} / ${details.total.toLocaleString()} simulations</span>`;
  } else if (details.iterations) {
    message += `<br><span style="color: #90CAF9;">🔢 Simulations: ${details.iterations.toLocaleString()}</span>`;
  }
  
  // Show completed iterations if provided (legacy support)
  if (details.completed && details.total) {
    message += `<br><span style="color: #90CAF9;">🔢 Progress: ${details.completed.toLocaleString()} / ${details.total.toLocaleString()} simulations</span>`;
  } else if (details.completed) {
    message += `<br><span style="color: #90CAF9;">🔢 Simulations: ${details.completed.toLocaleString()}</span>`;
  }
  
  if (details.nodes) {
    message += `<br><span style="color: #A5D6A7;">🌐 Search nodes: ${details.nodes.toLocaleString()}</span>`;
  }
  
  if (details.depth) {
    message += `<br><span style="color: #FFCDD2;">📊 Search depth: ${details.depth}</span>`;
  }
  
  if (details.phase) {
    message += `<br><span style="color: #D1C4E9;">⚙️ Phase: ${details.phase}</span>`;
  }
  
  if (details.timeRemaining && details.timeRemaining > 0) {
    message += `<br><span style="color: #FFCC80;">⏱️ Est. ${details.timeRemaining}s remaining</span>`;
  }
  
  if (details.error) {
    message += `<br><span style="color: #FF6B6B;">⚠️ Error: ${details.error}</span>`;
  }
  
  hud.innerHTML = message;
  
  // Force display refresh to ensure progress updates are visible
  if (progress > 0 && progress < 100) {
    hud.style.display = 'block';
    hud.offsetHeight; // Trigger reflow to force visual update
  }
};

/**
 * Create enhanced ASCII progress bar with color coding
 */
window.AIEngine.createProgressBar = function(progress) {
  const width = 25; // Increased width for better visibility
  const filled = Math.round(width * progress / 100);
  const empty = width - filled;
  
  // Color-coded progress based on phase
  let filledChar = '█';
  let emptyChar = '░';
  
  if (progress < 20) {
    // Early phase - blue tint
    filledChar = '<span style="color: #4FC3F7;">█</span>';
  } else if (progress < 50) {
    // Analysis phase - yellow tint  
    filledChar = '<span style="color: #FFD54F;">█</span>';
  } else if (progress < 80) {
    // Deep thinking - orange tint
    filledChar = '<span style="color: #FF8A65;">█</span>';
  } else {
    // Finalizing - green tint
    filledChar = '<span style="color: #81C784;">█</span>';
  }
  
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
};

/**
 * Main AI entry point - checks if it's AI's turn and makes a move
 */
window.AIEngine.checkAndMakeMove = function() {
  debugLog(`🤖 checkAndMakeMove called - enabled: ${this.enabled}, current: ${window.state ? window.state.current : 'N/A'}, aiColor: ${this.color}, thinking: ${this.thinking}, animating: ${window.animating}, gameOver: ${window.state ? window.state.gameOver : 'N/A'}`);
  
  // More detailed debugging
  if (!this.enabled) {
    debugLog(`🤖 AI skipping: not enabled`);
    return;
  }
  if (state.current !== this.color) {
    debugLog(`🤖 AI skipping: not AI's turn (current: ${state.current}, AI: ${this.color})`);
    return;
  }
  if (this.thinking) {
    debugLog(`🤖 AI skipping: already thinking`);
    return;
  }
  if (window.animating) {
    debugLog(`🤖 AI skipping: animation in progress`);
    return;
  }
  if (state.gameOver) {
    debugLog(`🤖 AI skipping: game is over`);
    return;
  }
  
  debugLog(`🤖 AI (${this.color}) analyzing position...`);
  this.thinking = true;
  
  // Get current opponent name for thinking display
  let aiName = "Beedric";
  if (window.Personalities && window.Personalities.currentOpponent) {
    aiName = window.Personalities.currentOpponent.name.split(' ')[0]; // Use first name only
  }
  
  // Show thinking indicator in HUD
  const hud = document.getElementById('hud');
  const originalText = hud.textContent;
  hud.textContent = `🧠 ${aiName} is contemplating...`;
  
  // Add enhanced thinking UI
  this.updateThinkingUI('initializing', 5, { phase: 'Starting Analysis' });
  hud.style.background = 'rgba(0,0,0,0.85)';
  hud.style.border = '2px solid #4FC3F7';
  hud.style.borderRadius = '8px';
  hud.style.padding = '12px';
  hud.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  
  setTimeout(async () => {
    try {
      const move = await this.findBestMove();
      if (move) {
        this.executeMove(move);
      } else {
        debugLog('🤖 AI found no legal moves - passing turn');
        if (typeof passTurn === 'function') {
          passTurn();
        }
      }
    } catch (error) {
      console.error('🤖 AI error:', error);
      if (typeof passTurn === 'function') {
        passTurn();
      }
    } finally {
      this.thinking = false;
      hud.textContent = originalText;
      hud.style.background = '';
      hud.style.border = '';
      hud.style.borderRadius = '';
      hud.style.padding = '';
      hud.style.boxShadow = '';
    }
  }, this.thinkingTime[this.difficulty]);
};

/**
 * Core MCTS algorithm to find the best move
 */
window.AIEngine.findBestMove = async function() {
  debugLog('🤖 Starting move search...');
  
  const hud = document.getElementById('hud'); // For progress updates
  const gameState = this.captureGameState();
  debugLog('🤖 Current game state:', gameState);
  
  // Check if Queen placement is urgently required (override normal logic)
  const currentColor = gameState.currentPlayer;
  const allPlacedPieces = typeof tray !== 'undefined' ? tray.filter(p => 
    p.meta && p.meta.placed
  ) : [];
  const placedPieces = allPlacedPieces.filter(p => p.meta.color === currentColor);
  const myTurnNumber = placedPieces.length + 1;
  const hasQueen = placedPieces.some(p => p.meta.key === 'Q');
  
  const mustPlaceQueen = !hasQueen && myTurnNumber >= 3;
  debugLog(`🤖 Queen check: hasQueen=${hasQueen}, myTurn=${myTurnNumber}, mustPlace=${mustPlaceQueen}`);
  
  // First check if we have any legal moves available
  const availableMoves = this.generateLegalMoves(gameState);
  debugLog(`🤖 Found ${availableMoves.length} legal moves`);
  
  if (availableMoves.length === 0) {
    if (mustPlaceQueen) {
      console.error('🤖 💥 CRITICAL: No moves generated despite Queen placement requirement!');
      console.error('🤖 💥 This should never happen - Queen placement logic failed!');
    }
    debugLog('🤖 No legal moves available!');
    return null;
  }
  
  // If Queen must be placed, prioritize Queen moves
  if (mustPlaceQueen) {
    const queenMoves = availableMoves.filter(move => 
      move.type === 'place' && move.piece && move.piece.meta && move.piece.meta.key === 'Q'
    );
    debugLog(`🤖 🚨 Queen placement required: found ${queenMoves.length} Queen moves out of ${availableMoves.length} total`);
    
    if (queenMoves.length > 0) {
      debugLog('🤖 👑 Forcing Queen placement move:', queenMoves[0]);
      return queenMoves[0]; // Force Queen placement immediately
    } else {
      console.error('🤖 💥 CRITICAL ERROR: Queen must be placed but no Queen moves generated!');
    }
  }
  
  // If only one move, return it immediately
  if (availableMoves.length === 1) {
    debugLog('🤖 Only one legal move, selecting it:', availableMoves[0]);
    return availableMoves[0];
  }

  // 🧠 TACTICAL MINIMAX INTEGRATION - Check for tactical positions
  debugLog('🧠 🔍 Checking if position requires tactical analysis...');
  this.updateThinkingUI('tactical', 0, { phase: 'Tactical Analysis' });
  
  if (this.isTacticalPosition(gameState)) {
    debugLog('🧠 ⚡ TACTICAL POSITION DETECTED - Using Minimax search!');
    this.updateThinkingUI('minimax', 10, { depth: 4 });
    
    const minimaxDepth = this.difficulty === 'easy' ? 3 : 
                        this.difficulty === 'medium' ? 4 : 5;
    
    // Check if MinimaxEngine exists before using it
    if (window.MinimaxEngine && typeof window.MinimaxEngine.findBestTacticalMove === 'function') {
      const tacticalResult = window.MinimaxEngine.findBestTacticalMove(gameState, minimaxDepth);
      
      if (tacticalResult && tacticalResult.move && tacticalResult.value > 0.5) {
        debugLog(`🧠 🎯 USING TACTICAL MINIMAX MOVE! Value: ${tacticalResult.value.toFixed(3)}`);
        debugLog(`🧠 📊 Search stats: ${tacticalResult.searchStats.nodes} nodes, ${tacticalResult.searchStats.prunes} prunes, ${tacticalResult.searchStats.time}ms`);
        this.updateThinkingUI('finalizing', 100, { 
          nodes: tacticalResult.searchStats.nodes,
          depth: minimaxDepth
        });
        return tacticalResult.move;
      } else {
        debugLog('🧠 ❌ Minimax found no good tactical move - falling back to MCTS');
        this.updateThinkingUI('strategic', 15);
      }
    } else {
      debugLog('🧠 ❌ MinimaxEngine not available - falling back to MCTS');
      this.updateThinkingUI('strategic', 15);
    }
  } else {
    debugLog('🧠 📈 Position is strategic - using MCTS for deep planning');
    this.updateThinkingUI('strategic', 15);
  }

  // STRATEGIC INTELLIGENCE: Filter moves by game plan before MCTS
  debugLog('🎯 Applying strategic intelligence to move selection...');
  const strategicMoves = this.applyStrategicFilter(availableMoves);
  
  // Use strategic moves for MCTS if available, otherwise fall back to all moves
  const movesToExplore = strategicMoves.length > 0 ? strategicMoves : availableMoves;
  debugLog(`🎯 Strategic filtering: ${availableMoves.length} → ${movesToExplore.length} moves`);

  const rootNode = new MCTSNode(gameState, null, null);
  
  // Ensure root node has moves initialized BEFORE starting MCTS
  if (rootNode.untriedMoves === null) {
    rootNode.untriedMoves = movesToExplore; // Use strategically filtered moves
    debugLog(`🤖 🔧 Initialized root node with ${rootNode.untriedMoves.length} strategic moves`);
  }
  
  const maxIterations = this.iterationsPerMove[this.difficulty];
  const timeLimit = this.timeLimit[this.difficulty];
  
  debugLog(`🤖 Running ${maxIterations} MCTS iterations (NO TIME LIMIT - thinking deeply)...`);
  this.updateThinkingUI('mcts', 20, { 
    iterations: 0, 
    total: maxIterations,
    phase: 'Initializing'
  });
  
  const startTime = Date.now();
  let iterations = 0;
  let lastProgressUpdate = 0;
  
  // Deep thinking approach: Run ALL iterations, no time pressure
  while (iterations < maxIterations) {
    try {
      // Update progress at balanced intervals for smooth but not overwhelming updates
      if (iterations % Math.max(1, Math.floor(maxIterations / 50)) === 0) { // 50 updates total for smoother display
        const progress = Math.round((iterations / maxIterations) * 60) + 20; // 20-80% for MCTS phase
        const elapsed = Date.now() - startTime;
        const estimatedTotal = iterations > 0 ? (elapsed / iterations) * maxIterations : 0;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        
        this.updateThinkingUI('mcts', progress, { 
          iterations: iterations,
          total: maxIterations,
          nodes: rootNode.visits,
          phase: 'Tree Search',
          timeRemaining: Math.round(remaining / 1000)
        });
        lastProgressUpdate = iterations;
        
        // CRITICAL: Force DOM update by yielding to browser periodically (not every update)
        if (iterations > 0 && iterations % Math.floor(maxIterations / 20) === 0) { // Only 20 yields total
          await new Promise(resolve => setTimeout(resolve, 2)); // Slightly longer yield
        }
      }
      
      if (iterations === 0) {
        debugLog(`🤖 🔍 MCTS Loop Debug - Starting iteration 0`);
        // Loop iteration debug removed
      }
      if (iterations === 1) {
        debugLog(`🤖 🔍 MCTS Loop Debug - Starting iteration 1 (SECOND ITERATION)`);
        debugLog(`🤖   - Root node state: children=${rootNode.children.length}, untriedMoves=${rootNode.untriedMoves ? rootNode.untriedMoves.length : 'null'}`);
      }
      
      const leaf = this.selectLeaf(rootNode);
      if (iterations === 0 || iterations === 1) {
        debugLog(`🤖   - selectLeaf returned leaf:`, leaf ? 'node' : 'null');
        if (iterations === 1) {
          debugLog(`🤖   - leaf details: hasGameState=${!!leaf.gameState}, hasMove=${!!leaf.move}, isRoot=${leaf === rootNode}`);
        }
      }
      
      const child = this.expandNode(leaf);
      if (iterations === 0 || iterations === 1) {
        debugLog(`🤖   - expandNode returned child:`, child ? 'node' : 'null');
        debugLog(`🤖   - leaf.untriedMoves.length after expand:`, leaf.untriedMoves ? leaf.untriedMoves.length : 'null');
        if (iterations === 1 && child) {
          debugLog(`🤖   - child details: hasGameState=${!!child.gameState}, hasMove=${!!child.move}`);
        }
      }
      
      const nodeForSimulation = child || leaf;
      if (iterations === 0 || iterations === 1) {
        debugLog(`🤖   - using node for simulation:`, nodeForSimulation === child ? 'child' : 'leaf');
      }
      
      if (iterations === 0 || iterations === 1) {
        debugLog(`🤖   - about to simulate node with state:`, nodeForSimulation.gameState ? 'has-state' : 'no-state');
      }
      
      let result;
      try {
        if (iterations === 0 || iterations === 1) {
          debugLog(`🤖   - 🔥 CALLING simulate() now... (iteration ${iterations})`);
        }
        result = this.simulate(nodeForSimulation);
        if (iterations === 0 || iterations === 1) {
          debugLog(`🤖   - 🔥 simulate() RETURNED successfully:`, result, typeof result);
          debugLog(`🤖   - 🔥 result is valid number:`, !isNaN(result));
          debugLog(`🤖   - 🔥 about to call backpropagate with node and result`);
        }
      } catch (error) {
        debugLog(`🤖 💥 ERROR calling simulate in MCTS loop (iteration ${iterations}):`, error);
        console.error('Node for simulation:', nodeForSimulation);
        console.error('Stack trace:', error.stack);
        throw error;
      }
      
      try {
        if (iterations === 0 || iterations === 1) {
          debugLog(`🤖   - 🔥 CALLING backpropagate() now... (iteration ${iterations})`);
        }
        this.backpropagate(nodeForSimulation, result);
        if (iterations === 0 || iterations === 1) {
          debugLog(`🤖   - 🔥 backpropagate() COMPLETED successfully (iteration ${iterations})`);
        }
      } catch (error) {
        debugLog(`🤖 💥 ERROR calling backpropagate in MCTS loop (iteration ${iterations}):`, error);
        console.error('Stack trace:', error.stack);
        throw error;
      }
      
      if (iterations === 0) {
        debugLog(`🤖   - 🔥 BACKPROPAGATE FINISHED - about to increment iterations from ${iterations}`);
        debugLog(`🤖   - 🔥 CRITICAL CHECKPOINT: Before increment, iterations=${iterations}`);
      }
      
      iterations++;
      
      if (iterations === 1) {
        debugLog(`🤖   - 🔥 ITERATION INCREMENTED SUCCESSFULLY! New value: ${iterations}`);
      }
      
      if (iterations === 1) {
        debugLog(`🤖 ✅ FIRST ITERATION COMPLETED! iterations=${iterations}`);
        debugLog(`🤖   - checking while condition: ${iterations} < ${maxIterations} = ${iterations < maxIterations}`);
        debugLog(`🤖   - root node children count:`, rootNode.children.length);
        debugLog(`🤖   - about to continue to iteration 2...`);
        debugLog(`🤖   - 🔥 CRITICAL: Loop should continue now!`);
      }
      
      // Add debugging for second iteration
      if (iterations === 2) {
        debugLog(`🤖 ✅ SECOND ITERATION COMPLETED! iterations=${iterations}`);
      }
      
      if (iterations === 1 || iterations === 2 || iterations % 100 === 0) {
        debugLog(`🤖 MCTS Progress: ${iterations}/${maxIterations} iterations (${Math.round((iterations / maxIterations) * 100)}%)`);
        // Remove duplicate HUD update that conflicts with main progress updates
        
        // Yield to browser every 1000 iterations to allow DOM updates
        if (iterations % 1000 === 0 && iterations > 0) {
          await new Promise(resolve => setTimeout(resolve, 5)); // 5ms yield for DOM refresh
        }
      }
    } catch (error) {
      console.error(`🤖 💥 CRITICAL ERROR in MCTS iteration ${iterations}:`, error);
      console.error('🤖 💥 Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      console.error(`🤖 💥 MCTS state: iterations=${iterations}, maxIterations=${maxIterations}`);
      console.error(`🤖 💥 Root node children: ${rootNode.children.length}`);
      console.error(`🤖 💥 This error will cause MCTS to exit early at ${Math.round((iterations/maxIterations)*100)}%!`);
      console.error(`🤖 💥 Breaking MCTS loop due to error`);
      console.error(`🤖 💥 FULL ERROR OBJECT:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      // Show error in UI
      this.updateThinkingUI('error', Math.round((iterations/maxIterations)*100), { 
        iterations: iterations,
        total: maxIterations,
        error: error.message
      });
      
      break;
    }
  }
  
  debugLog(`🤖 🔥 MCTS WHILE LOOP COMPLETED - Final iterations: ${iterations}`)
  
  debugLog(`🤖 🏁 MCTS LOOP EXITED: iterations=${iterations}, maxIterations=${maxIterations}, reason=${iterations >= maxIterations ? 'completed' : 'error/break'}`)
  
  const elapsed = Date.now() - startTime;
  debugLog(`🤖 MCTS completed ALL ${iterations} iterations in ${elapsed}ms (${(elapsed/1000).toFixed(1)}s). Root has ${rootNode.children.length} children.`);
  
  // Update UI for evaluation phase
  this.updateThinkingUI('evaluation', 85, { 
    iterations: iterations,
    nodes: rootNode.visits 
  });
  
  // PRIORITY-FIRST MOVE SELECTION: Queen objectives override MCTS
  let bestChild = null;
  let bestScore = -1;
  
  console.log(`🤖 🧠 ANALYZING ${rootNode.children.length} POSSIBLE MOVES:`);
  
  // Check for WINNING moves first (surround opponent Queen)
  debugLog(`🤖 👑 Checking for WINNING moves...`);
  for (const child of rootNode.children) {
    if (this.isWinningMove(child.move)) {
      debugLog(`🤖 👑 ⭐ WINNING MOVE FOUND! Surrounding opponent Queen:`, child.move);
      debugLog(`🤖 👑 ⭐ GAME OVER! Taking immediate win!`);
      return child.move;
    }
  }
  debugLog(`🤖 👑 No winning moves available.`);
  
  // Check for emergency defensive moves (save our Queen)
  console.log(`🤖 🛡️ Checking for EMERGENCY defensive moves...`);
  
  // NEW: Check for pin situations that need immediate attention
  const pinSituation = this.evaluatePinSituation(this.color);
  if (pinSituation.severity >= 10) { // Queen pinned or multiple pieces
    console.log(`🤖 📌 CRITICAL PIN DETECTED! Severity: ${pinSituation.severity}`);
    
    // Look for moves that can unpin pieces
    for (const child of rootNode.children) {
      if (child.move && child.move.priority === 'escape-pin') {
        console.log(`🤖 📌 ⚡ EMERGENCY UNPIN! Using move:`, child.move);
        return child.move;
      }
    }
    
    // If no explicit unpin moves, check if any moves help with the pin situation
    for (const child of rootNode.children) {
      if (this.doesMoveHelpUnpinPieces(child.move, pinSituation.pinnedPieces)) {
        console.log(`🤖 📌 🔧 EMERGENCY PIN HELP! Using move:`, child.move);
        return child.move;
      }
    }
  }
  
  for (const child of rootNode.children) {
    if (this.isEmergencyDefensive(child.move)) {
      console.log(`🤖 🛡️ ⚠️ EMERGENCY DEFENSE! Saving our Queen:`, child.move);
      console.log(`🤖 🛡️ ⚠️ Queen in danger - emergency response!`);
      return child.move;
    }
  }
  console.log(`🤖 🛡️ No emergency defense needed.`);
  
  console.log(`🤖 📊 Evaluating moves with Queen-focused strategy...`);
  
  // Then evaluate normally with heavy Queen focus
  for (const child of rootNode.children) {
    const winRate = child.visits > 0 ? child.wins/child.visits : 0;
    const visits = child.visits;
    const strategicBonus = this.getStrategicMoveBonus(child.move);
    const queenBonus = this.getQueenFocusBonus(child.move); // NEW: Direct Queen evaluation
    
    // Queen-focused scoring: Queen priority (40%) + win rate (30%) + visits (20%) + strategic (10%)
    // Fix division by zero when iterations = 0
    const visitsRatio = iterations > 0 ? (visits / iterations) : 0;
    const score = queenBonus * 0.4 + winRate * 0.3 + visitsRatio * 0.2 + strategicBonus * 0.1;
    
    const queenThreatInfo = this.analyzeQueenThreats(child.move);
    console.log(`🤖 Move ${child.move.type} ${child.move.piece?.meta?.key || '?'} to ${child.move.q},${child.move.r}: ${visits} visits, ${(winRate*100).toFixed(1)}% win rate, priority: ${child.move.priority || 'normal'}, queenBonus: ${queenBonus.toFixed(2)}, threats: ${queenThreatInfo}, TOTAL: ${score.toFixed(3)}`);
    
    if (score > bestScore) {
      bestScore = score;
      bestChild = child;
    }
  }
  
  if (bestChild) {
    this.updateThinkingUI('finalizing', 100, { 
      iterations: iterations,
      nodes: rootNode.visits 
    });
    console.log(`🤖 ⭐ FINAL DECISION after ${iterations} iterations:`);
    console.log(`🤖 ⭐ Selected: ${bestChild.move.type} ${bestChild.move.piece?.meta?.key || '?'} to (${bestChild.move.q},${bestChild.move.r})`);
    console.log(`🤖 ⭐ Final score: ${bestScore.toFixed(3)} | Visits: ${bestChild.visits} | Win rate: ${((bestChild.wins/bestChild.visits)*100).toFixed(1)}%`);
    console.log(`🤖 ⭐ Strategy: ${this.analyzeQueenThreats(bestChild.move)} | Priority: ${bestChild.move.priority || 'normal'}`);
    
    // Clear thinking UI after a brief pause
    setTimeout(() => {
      this.updateThinkingUI('complete', 100, { move: bestChild.move });
    }, 800);
    
    return bestChild.move;
  } else {
    console.log('🤖 💥 ERROR: No best move found, falling back to first available move');
    return availableMoves[0];
  }
};

/**
 * MCTS Selection phase - traverse tree using UCB1
 */
window.AIEngine.selectLeaf = function(node) {
  while (!node.isTerminal() && node.isFullyExpanded()) {
    let bestChild = null;
    let bestScore = -Infinity;
    
    for (const child of node.children) {
      const score = child.ucb1();
      if (score > bestScore) {
        bestScore = score;
        bestChild = child;
      }
    }
    
    node = bestChild;
  }
  
  return node;
};

/**
 * MCTS Expansion phase - add new child node
 */
window.AIEngine.expandNode = function(node) {
  if (node.isTerminal()) return null;
  
  if (node.untriedMoves === null) {
    // FIX: Use correct single-parameter call for generateLegalMoves!
    node.untriedMoves = this.generateLegalMoves(node.gameState);
  }
  
  if (node.untriedMoves.length === 0) return null;
  
  const move = node.untriedMoves.pop();
  const newState = this.applyMoveToState(node.gameState, move);
  const child = new MCTSNode(newState, move, node);
  node.children.push(child);
  
  return child;
};

/**
 * MCTS Simulation phase - random playout with heuristics
 */
window.AIEngine.simulate = function(node) {
  try {
    let currentState = JSON.parse(JSON.stringify(node.gameState));
    let depth = 0;
    
    // Ensure currentPlayer is properly set
    if (!currentState.currentPlayer) {
      console.error('🤖 ❌ SIMULATE: currentPlayer is undefined at start!');
      currentState.currentPlayer = this.color === 'black' ? 'white' : 'black';
    }
    
  while (!this.isGameOver(currentState) && depth < this.simulationDepth) {
    let moves;
    try {
      // Validate currentPlayer before calling generateLegalMoves
      if (!currentState.currentPlayer) {
        console.error(`🤖 ❌ SIMULATE: currentPlayer undefined at depth ${depth}!`);
        break;
      }
      
      // Generate legal moves for simulation
      moves = this.generateLegalMoves(currentState);
    } catch (error) {
      console.error(`🤖 💥 ERROR in generateLegalMoves during simulation at depth ${depth}:`, error);
      console.error('Simulation state:', currentState);
      throw error;
    }
    if (moves.length === 0) {
      break; // No moves available
    }      
    
    try {
      // Use weighted selection for better simulation quality
      const move = this.selectSimulationMove(moves, currentState);
      currentState = this.applyMoveToState(currentState, move);
    } catch (error) {
      console.error(`🤖 💥 ERROR in selectSimulationMove or applyMoveToState at depth ${depth}:`, error);
      console.error('Move that caused error:', move);
      console.error('State before error:', currentState);
      throw error;
    }
    
    // Validate that currentPlayer was updated properly
    if (!currentState.currentPlayer) {
      console.error(`🤖 ❌ SIMULATE: applyMoveToState failed to set currentPlayer at depth ${depth}!`);
      break;
    }
    
    depth++;
    
    if (depth >= this.simulationDepth) {
      // Simulation depth limit reached
    }
  }
    
    // Evaluate final simulation position
    try {
      const result = this.evaluatePosition(currentState);
      return result;
    } catch (error) {
      console.error(`🤖 💥 ERROR in simulation evaluation:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`🤖 💥 SIMULATE ERROR:`, error);
    console.error('Node gameState:', node.gameState);
    console.error('Stack trace:', error.stack);
    throw error; // Re-throw so MCTS loop catches it
  }
};

/**
 * MCTS Backpropagation phase
 */
window.AIEngine.backpropagate = function(node, result) {
  try {
    // Backpropagation with minimal logging
    
    if (isNaN(result)) {
      console.error(`🤖 💥 BACKPROPAGATE ERROR: result is NaN!`);
      return;
    }
    
    let currentNode = node;
    let depth = 0;
    
    while (currentNode !== null) {
      // Update visit count
      currentNode.visits++;
      
      // Safely check currentPlayer
      const nodePlayer = currentNode.gameState && currentNode.gameState.currentPlayer;
      // Determine node player perspective
      
      if (!nodePlayer) {
        console.error(`🤖 💥 BACKPROPAGATE ERROR: No currentPlayer at depth ${depth}`);
        // Use parent's currentPlayer if available, or default to opponent
        const parentPlayer = currentNode.parent && currentNode.parent.gameState && currentNode.parent.gameState.currentPlayer;
        const assumedPlayer = parentPlayer === this.color ? (this.color === 'white' ? 'black' : 'white') : this.color;
        // Using fallback player assignment
        
        if (assumedPlayer === this.color) {
          currentNode.wins += result;
        } else {
          currentNode.wins += (1 - result);
        }
      } else {
        // Normal case - player is known
        if (nodePlayer === this.color) {
          // AI player node
          currentNode.wins += result;
        } else {
          // Opponent player node
          currentNode.wins += (1 - result);
        }
      }
      
      // Node updated
      
      currentNode = currentNode.parent;
      depth++;
      
      if (depth > 50) { // Safety limit
        console.error(`🤖 💥 BACKPROPAGATE ERROR: Infinite loop detected at depth ${depth}`);
        break;
      }
    }
    
    // Backpropagation completed
    
  } catch (error) {
    console.error(`🤖 💥 CRITICAL BACKPROPAGATE ERROR:`, error);
    console.error('Node:', node);
    console.error('Result:', result);
    console.error('Stack trace:', error.stack);
    throw error; // Re-throw so MCTS loop can handle it properly
  }
};

/**
 * Generate all legal moves for the current position
 */
window.AIEngine.generateLegalMoves = function(gameState) {
  const moves = [];
  const currentColor = gameState.currentPlayer;
  
  // Only log for root node to avoid spam
  if (!gameState.isSimulation) {
    console.log(`🤖 Generating moves for ${currentColor}, game state:`, gameState);
  }
  
  // CRITICAL FIRST MOVE SAFEGUARD
  const totalPiecesPlaced = (typeof tray !== 'undefined') ? tray.filter(p => p.meta && p.meta.placed).length : 0;
  if (!gameState.isSimulation && totalPiecesPlaced === 0) {
    console.log(`🤖 🚨 FIRST MOVE SAFEGUARD: Ensuring moves are generated for game start`);
    const firstMoves = this.generateSimpleGameMoves(currentColor);
    if (firstMoves.length === 0) {
      console.error(`🤖 💥 CRITICAL: No first moves generated! This is illegal - game cannot start!`);
      // Emergency fallback for first move
      const availablePieces = tray.filter(p => p.meta && p.meta.color === currentColor && !p.meta.placed);
      if (availablePieces.length > 0) {
        console.log(`🤖 🚨 EMERGENCY: Creating emergency first move`);
        return [{
          type: 'place',
          piece: availablePieces[0],
          q: 0,
          r: 0,
          priority: 'emergency-first-move',
          reasoning: 'Emergency fallback to prevent illegal pass on first move'
        }];
      }
    }
    return firstMoves;
  }
  
  // Use live game functions for root node, simulation for internal nodes
  if (!gameState.isSimulation) {
    console.log(`🤖 Using live game functions for root node`);
    return this.generateSimpleGameMoves(currentColor);
  } else {
    // Use simplified simulation moves for internal MCTS nodes
    return this.generateSimulationMoves(gameState, currentColor);
  }
};

/**
 * Strategic move generation with opening book and piece-specific logic
 */
window.AIEngine.generateSimpleGameMoves = function(currentColor) {
  const moves = [];
  const difficulty = window.AIEngine.difficulty;
  const strategyDepth = window.AIEngine.strategyDepth[difficulty];
  
  console.log(`🤖 🎯 Using STRATEGIC move generation for ${currentColor} (${difficulty} difficulty, depth ${strategyDepth})`);
  
  try {
    // Get pieces from tray
    const availablePieces = typeof tray !== 'undefined' ? tray.filter(p => 
      p.meta && p.meta.color === currentColor && !p.meta.placed
    ) : [];
    
    const allPlacedPieces = typeof tray !== 'undefined' ? tray.filter(p => 
      p.meta && p.meta.placed
    ) : [];
    
    const placedPieces = allPlacedPieces.filter(p => p.meta.color === currentColor);
    const oppColor = currentColor === 'white' ? 'black' : 'white';
    const totalTurnNumber = Math.floor(allPlacedPieces.length / 2) + 1;
    const myTurnNumber = placedPieces.length + 1; // This player's turn number
    
    // Debug all pieces in tray
    console.log(`🤖 DEBUG: All tray pieces:`, typeof tray !== 'undefined' ? tray.map(p => 
      `${p.meta?.color || 'no-color'}_${p.meta?.key || 'no-key'}_placed:${p.meta?.placed || false}`
    ) : 'tray undefined');
    
    console.log(`🤖 Turn ${totalTurnNumber} (my turn ${myTurnNumber}): Available: ${availablePieces.length}, Placed: ${allPlacedPieces.length}`);
    console.log(`🤖 DEBUG: placedPieces for ${currentColor}:`, placedPieces.map(p => `${p.meta.key}@${p.meta.q},${p.meta.r}`));
    console.log(`🤖 DEBUG: allPlacedPieces:`, allPlacedPieces.map(p => `${p.meta.color}_${p.meta.key}@${p.meta.q},${p.meta.r}`));
    
    // Check if Queen is placed (required by AI's turn 4)
    const hasQueen = placedPieces.some(p => p.meta.key === 'Q');
    const queensPlaced = allPlacedPieces.filter(p => p.meta.key === 'Q').length;
    
    console.log(`🤖 Queen status: hasQueen=${hasQueen}, queensPlaced=${queensPlaced}, myTurn=${myTurnNumber}`);
    
    // **STRATEGIC QUEEN TIMING: Smart Queen placement based on Hive theory**
    // TOURNAMENT OPENING RULE: NO QUEEN ON FIRST TURN (turns 1-2)
    // Queen must be placed by turn 4, but strategic timing matters
    
    const isQueenRequired = !hasQueen && myTurnNumber >= 3; // Must place by turn 3 (AI turn 4 absolute limit)
    // ENFORCE TOURNAMENT RULE: No Queen placement before turn 3
    const strategicQueenTiming = !hasQueen && myTurnNumber >= 3 && this.shouldPlaceQueenNow(allPlacedPieces, currentColor, oppColor, myTurnNumber, difficulty);
    
    if (isQueenRequired || strategicQueenTiming) {
      const urgency = isQueenRequired ? 'REQUIRED' : 'STRATEGIC';
      console.log(`🤖 � ${urgency}: Queen placement on turn ${myTurnNumber}`);
      
      const queen = availablePieces.find(p => p.meta.key === 'Q');
      console.log(`🤖 � Queen piece found:`, queen ? 'YES' : 'NO');
      
      if (queen && typeof legalPlacementZones === 'function') {
        try {
          const zones = legalPlacementZones(currentColor);
          console.log(`🤖 � Queen zones available:`, zones.size);
          
          if (zones.size > 0) {
            // Strategic Queen placement - find safest position
            const queenMoves = this.evaluateQueenPlacementPositions(Array.from(zones), allPlacedPieces, currentColor, oppColor);
            debugLog(`🤖 👑 Generated ${queenMoves.length} strategic Queen placements`);
            return queenMoves;
          } else {
            console.error(`🤖 💥 NO ZONES for Queen placement!`);
          }
        } catch (error) {
          console.error(`🤖 💥 Queen placement failed:`, error);
        }
      } else {
        console.error(`🤖 💥 Missing Queen piece or legalPlacementZones function!`);
      }
    }

    // PRIORITY 1: Forced Queen placement if needed (by AI's turn 3)
    if (!hasQueen && myTurnNumber >= 3) {
      console.log(`🤖 ⚠️ MUST place Queen by my turn 3! (currently turn ${myTurnNumber})`);
      const queen = availablePieces.find(p => p.meta.key === 'Q');
      console.log(`🤖 🔍 Queen piece found:`, queen ? 'YES' : 'NO');
      console.log(`🤖 🔍 legalPlacementZones function available:`, typeof legalPlacementZones);
      
      if (queen && typeof legalPlacementZones === 'function') {
        console.log(`🤖 🔍 About to call legalPlacementZones for ${currentColor}`);
        try {
          const zones = legalPlacementZones(currentColor);
          console.log(`🤖 Legal Queen placement zones:`, zones.size);
          console.log(`🤖 🔍 Zone details:`, Array.from(zones));
          
          if (zones.size === 0) {
            console.error(`🤖 💥 NO LEGAL ZONES found for Queen placement! This should not happen.`);
            console.error(`🤖 💥 Current color:`, currentColor);
            console.error(`🤖 💥 Game state:`, {moveNumber: totalTurnNumber, myTurn: myTurnNumber});
            return moves; // Early return with empty moves array
          }
        } catch (error) {
          console.error(`🤖 💥 EXCEPTION calling legalPlacementZones:`, error);
          console.error(`🤖 💥 Error stack:`, error.stack);
          console.error(`🤖 💥 Current color:`, currentColor);
          console.error(`🤖 💥 Game state:`, {moveNumber: totalTurnNumber, myTurn: myTurnNumber});
          return moves; // Early return with empty moves array on error
        }
        
        console.log(`🤖 🔍 CHECKPOINT: About to start Queen placement processing`);
        console.log(`🤖 🔍 CHECKPOINT: zones variable exists:`, typeof zones);
        console.log(`🤖 🔍 CHECKPOINT: zones size:`, zones.size);
        console.log(`🤖 🔍 CHECKPOINT: moves array length before:`, moves.length);
        
        // First pass: try strategic placements (relaxed criteria for mandatory Queen)
        console.log(`🤖 🔍 Starting first pass Queen placement loop with ${zones.size} zones`);
        for (const zone of zones) {
          const [q, r] = zone.split(',').map(Number);
          console.log(`🤖 🔍 Processing zone ${q},${r}`);
          
          // Validate position is actually empty
          const existingPiece = typeof tray !== 'undefined' ? tray.find(p => 
            p.meta && p.meta.placed && p.meta.q === q && p.meta.r === r
          ) : null;
          
          if (existingPiece) {
            console.warn(`🤖 ⚠️ Skipping occupied Queen position ${q},${r} (has ${existingPiece.meta.key})`);
            continue;
          }
          
          // Strategic Queen placement - relaxed criteria since Queen is mandatory
          const centerDistance = Math.abs(q) + Math.abs(r);
          const protection = this.countAdjacentFriendlyPieces({q, r}, currentColor);
          
          console.log(`🤖 Evaluating Queen spot ${q},${r}: distance=${centerDistance}, protection=${protection}`);
          
          // Accept any reasonable position when Queen placement is mandatory
          if (centerDistance <= 3) { // More lenient distance check
            console.log(`🤖 ✅ Adding Queen move at ${q},${r} (distance=${centerDistance} <= 3)`);
            moves.push({
              type: 'place',
              piece: queen,
              q: q,
              r: r,
              priority: 'queen-placement'
            });
          } else {
            console.log(`🤖 ❌ Rejecting Queen spot ${q},${r} (distance=${centerDistance} > 3)`);
          }
        }
        
        // Second pass: if no strategic spots, place ANYWHERE legal (emergency)
        if (moves.length === 0) {
          console.log(`🤖 🚨 EMERGENCY: No strategic Queen spots, placing anywhere legal!`);
          for (const zone of zones) {
            const [q, r] = zone.split(',').map(Number);
            
            // Validate position is actually empty
            const existingPiece = typeof tray !== 'undefined' ? tray.find(p => 
              p.meta && p.meta.placed && p.meta.q === q && p.meta.r === r
            ) : null;
            
            if (!existingPiece) {
              console.log(`🤖 🚨 Emergency Queen placement at ${q},${r}`);
              moves.push({
                type: 'place',
                piece: queen,
                q: q,
                r: r,
                priority: 'forced-queen'
              });
              break; // Just one move needed for emergency
            } else {
              console.log(`🤖 🚨 Position ${q},${r} occupied by ${existingPiece.meta.key}`);
            }
          }
        }
        
        // Third pass: if STILL no moves, something is very wrong - debug it
        if (moves.length === 0) {
          console.error(`🤖 💥 CRITICAL: No Queen placement possible despite ${zones.size} legal zones!`);
          console.error(`🤖 💥 Queen piece:`, queen);
          console.error(`🤖 💥 Available pieces:`, availablePieces.map(p => p.meta.key));
          console.error(`🤖 💥 All placed pieces:`, allPlacedPieces.map(p => `${p.meta.key}@${p.meta.q},${p.meta.r}`));
          
          // ABSOLUTE EMERGENCY: Force place Queen at first zone regardless
          const firstZone = Array.from(zones)[0];
          if (firstZone) {
            const [q, r] = firstZone.split(',').map(Number);
            console.error(`🤖 💥 FORCE placing Queen at ${q},${r}`);
            moves.push({
              type: 'place',
              piece: queen,
              q: q,
              r: r,
              priority: 'absolute-emergency'
            });
          }
        }
        
        console.log(`🤖 Generated ${moves.length} Queen placement moves`);
        return moves;
      } else {
        console.error(`🤖 ❌ No Queen piece found or legalPlacementZones not available!`);
        console.error(`🤖 ❌ Queen piece:`, queen);
        console.error(`🤖 ❌ Available pieces:`, availablePieces.map(p => p.meta.key));
      }
    }
    
    // PRIORITY 2: Opening book moves (first 3 turns only, if Queen not required)
    // After turn 3, switch to strategic play with movement priority
    if (totalTurnNumber <= 3 && !hasQueen) {
      console.log(`🤖 📖 Using opening book for turn ${totalTurnNumber}`);
      const openingMoves = this.generateOpeningMoves(currentColor, myTurnNumber, availablePieces, allPlacedPieces, difficulty);
      console.log(`🤖 📖 Opening book generated ${openingMoves.length} moves`);
      return openingMoves;
    }
    
    // STRATEGIC RULE: After Queen is placed, prioritize MOVEMENT over placement
    // This is fundamental Hive strategy - move existing pieces before adding new ones
    
    if (hasQueen && queensPlaced >= 1) {
      console.log(`🤖 ✨ STRATEGIC PHASE: Queens placed - prioritizing piece movement over placement`);
      
      // FIRST: Generate all movement moves (HIGH PRIORITY)
      console.log(`🤖 Generating movement moves (primary focus)...`);
      for (const piece of placedPieces) {
        try {
          if (typeof legalMoveZones === 'function') {
            const moveZones = legalMoveZones(piece);
            console.log(`🤖 ${piece.meta.key} can move to ${moveZones?.length || 0} zones`);
            
            if (moveZones && moveZones.length > 0) {
              for (const zone of moveZones) {
                const [q, r] = zone.split(',').map(Number);
                const strategicValue = this.evaluateMovementStrategy(piece, q, r, allPlacedPieces, oppColor, hasQueen);
                const move = {
                  type: 'move',
                  piece: piece,
                  fromQ: piece.meta.q,
                  fromR: piece.meta.r,
                  q: q,
                  r: r,
                  priority: strategicValue.priority,
                  strategicValue: strategicValue.value,
                  reasoning: strategicValue.reasoning
                };
                moves.push(move);
              }
            }
          }
        } catch (error) {
          console.warn(`🤖 Error generating moves for ${piece.meta.key}:`, error);
        }
      }
      
      // SECOND: Generate placement moves (SECONDARY - only if beneficial)
      if (availablePieces.length > 0 && typeof legalPlacementZones === 'function') {
        const zones = legalPlacementZones(currentColor);
        console.log(`🤖 Placement zones available (secondary focus):`, zones.size);
        
        for (const piece of availablePieces) {
          const placements = this.generateStrategicPlacements(piece, zones, currentColor, allPlacedPieces, false, difficulty);
          // Mark placements as secondary priority
          placements.forEach(p => {
            p.strategicValue = (p.strategicValue || 0) * 0.8; // Reduce placement value after Queen
            if (p.priority === 'threaten-queen') {
              p.strategicValue *= 1.5; // Exception: Queen threats still high priority
            }
          });
          moves.push(...placements);
        }
      }
      
      // Apply strategic prioritization: favor movement over placement
      moves.forEach(move => {
        if (move.type === 'move') {
          move.strategicValue = (move.strategicValue || 0) + 0.3; // Movement bonus
        }
      });
    } else {
      // Early game: placement is primary focus
      if (availablePieces.length > 0 && typeof legalPlacementZones === 'function') {
        const zones = legalPlacementZones(currentColor);
        console.log(`🤖 Early game: placement zones available:`, zones.size);
        
        for (const piece of availablePieces) {
          const placements = this.generateStrategicPlacements(piece, zones, currentColor, allPlacedPieces, true, difficulty);
          moves.push(...placements);
        }
      }
    }
    
    console.log(`🤖 Generated ${moves.length} strategic moves`);
    return moves;
    
  } catch (error) {
    console.error('🤖 Error in generateSimpleGameMoves:', error);
    return [];
  }
};

/**
 * ENHANCED Opening book - multiple strategic patterns based on Hive theory
 */
window.AIEngine.generateOpeningMoves = function(currentColor, myTurnNumber, availablePieces, allPlacedPieces, difficulty = 'easy') {
  const moves = [];
  
  console.log(`🤖 📖 Advanced Opening book for my turn ${myTurnNumber} as ${currentColor} (${difficulty} difficulty)`);
  
  // MULTIPLE PROVEN OPENING STRATEGIES
  const openingPattern = this.selectOpeningPattern(currentColor, myTurnNumber, allPlacedPieces, difficulty);
  
  if (myTurnNumber === 1) {
    // First move - choose based on pattern
    return this.executeFirstMove(openingPattern, availablePieces, allPlacedPieces, difficulty);
  } else if (myTurnNumber === 2) {
    // Second move - develop the pattern
    return this.executeSecondMove(openingPattern, availablePieces, allPlacedPieces, currentColor);
  } else if (myTurnNumber === 3) {
    // Third move - complete opening setup
    return this.executeThirdMove(openingPattern, availablePieces, allPlacedPieces, currentColor);
  } else if (myTurnNumber === 4) {
    // Fourth move - transition to middle game
    return this.executeTransitionMove(availablePieces, allPlacedPieces, currentColor);
  }
  
  return moves;
};

/**
 * Select optimal opening pattern based on position and difficulty
 */
window.AIEngine.selectOpeningPattern = function(color, turnNumber, allPlacedPieces, difficulty) {
  if (turnNumber === 1 && allPlacedPieces.length === 0) {
    // Game opening - choose our strategy based on book recommendations
    if (difficulty === 'hard') {
      // Book: "Spider opening is aggressive" - sacrifice piece for tempo
      return 'spider-sacrifice'; // Aggressive tempo-stealing opening
    } else if (difficulty === 'medium') {
      // Book: "Beetle/Grasshopper defensive openings"  
      return 'defensive-beetle'; // Solid defensive development
    } else {
      // Book: Safe development avoiding early ant
      return 'defensive-grasshopper'; // Conservative development
    }
  } else if (turnNumber === 1 && allPlacedPieces.length === 1) {
    // Responding to opponent's opening based on book theory
    const oppPiece = allPlacedPieces[0];
    
    if (oppPiece.meta.key === 'A') {
      // Book: "Ant should never be used as opening" - opponent made strategic error
      return 'punish-ant-opening'; // Exploit opponent's poor opening
    } else if (oppPiece.meta.key === 'S') {
      // Book: Spider opening is aggressive, respond defensively  
      return 'defensive-response'; // Counter spider aggression with Beetle/Grasshopper
    } else if (oppPiece.meta.key === 'Q') {
      // Book: Queen first is "prohibited in tournaments" but strong
      return 'queen-pressure'; // Immediate pressure on exposed Queen
    } else if (oppPiece.meta.key === 'B' || oppPiece.meta.key === 'G') {
      // Book: Beetle/Grasshopper are good defensive openings
      return 'mirror-defense'; // Mirror their defensive approach
    } else {
      return 'flexible-response'; // Adapt to unusual opening
    }
  }
  
  return 'book-development'; // Follow book principles
};

/**
 * Execute first move based on selected pattern
 */
window.AIEngine.executeFirstMove = function(pattern, availablePieces, allPlacedPieces, difficulty) {
  const moves = [];
  
  console.log(`🤖 🎯 executeFirstMove: pattern=${pattern}, availablePieces=${availablePieces.length}, allPlaced=${allPlacedPieces.length}`);
  
  if (allPlacedPieces.length === 0) {
    // Very first move of game - based on Hive strategy book
    let preferredPiece;
    
    console.log(`🤖 🎯 VERY FIRST MOVE OF GAME - NO PIECES PLACED YET`);
    console.log(`🤖 🎯 Available pieces:`, availablePieces.map(p => p.meta?.key || 'no-key'));
    
    switch (pattern) {
      case 'spider-sacrifice':
        // Book: "Spider opening is aggressive" - sacrifice for tempo
        preferredPiece = availablePieces.find(p => p.meta.key === 'S') 
          || availablePieces.find(p => p.meta.key === 'G')
          || availablePieces.find(p => p.meta.key !== 'Q');
        debugLog(`🤖 📖 SPIDER-SACRIFICE: Aggressive tempo opening (book strategy)`);
        break;
        
      case 'defensive-beetle':
        // Book: "Beetle opening is defensive" 
        preferredPiece = availablePieces.find(p => p.meta.key === 'B')
          || availablePieces.find(p => p.meta.key === 'G')
          || availablePieces.find(p => p.meta.key === 'S');
        console.log(`🤖 📖 DEFENSIVE-BEETLE: Solid defensive opening (book strategy)`);
        break;
        
      case 'defensive-grasshopper':
        // Book: "Grasshopper opening is defensive"
        preferredPiece = availablePieces.find(p => p.meta.key === 'G')
          || availablePieces.find(p => p.meta.key === 'B')
          || availablePieces.find(p => p.meta.key === 'S');
        console.log(`🤖 📖 DEFENSIVE-GRASSHOPPER: Conservative opening (book strategy)`);
        break;
        
      default:
        // Avoid Ant opening (book: "Ant should never be used as opening")
        preferredPiece = availablePieces.find(p => p.meta.key === 'S' || p.meta.key === 'B' || p.meta.key === 'G')
          || availablePieces.find(p => p.meta.key !== 'Q' && p.meta.key !== 'A');
        console.log(`🤖 📖 BOOK-DEVELOPMENT: Following book principles (no Ant opening)`);
    }
    
    console.log(`🤖 🎯 Selected piece for first move:`, preferredPiece ? `${preferredPiece.meta.key}` : 'NONE FOUND!');
    
    if (preferredPiece) {
      moves.push({
        type: 'place',
        piece: preferredPiece,
        q: 0,
        r: 0,
        priority: `opening-${pattern}`,
        reasoning: `Opening pattern: ${pattern}`
      });
      console.log(`🤖 🎯 FIRST MOVE GENERATED: Place ${preferredPiece.meta.key} at (0,0)`);
    } else {
      console.error(`🤖 💥 CRITICAL ERROR: No piece found for first move! This should never happen!`);
      console.error(`🤖 💥 Available pieces:`, availablePieces);
      
      // Emergency fallback - use any available piece
      if (availablePieces.length > 0) {
        preferredPiece = availablePieces[0];
        moves.push({
          type: 'place',
          piece: preferredPiece,
          q: 0,
          r: 0,
          priority: 'emergency-first-move',
          reasoning: 'Emergency fallback for first move'
        });
        console.log(`🤖 🎯 EMERGENCY FALLBACK: Using ${preferredPiece.meta?.key || 'unknown'} for first move`);
      }
    }
  } else {
    // Response to opponent's first move
    const oppPiece = allPlacedPieces[0];
    const neighbors = this.getNeighborCoords(oppPiece.meta.q, oppPiece.meta.r);
    
    let responsePiece = this.selectResponsePiece(pattern, availablePieces, oppPiece);
    
    for (const [nq, nr] of neighbors) {
      moves.push({
        type: 'place',
        piece: responsePiece,
        q: nq,
        r: nr,
        priority: `response-${pattern}`,
        reasoning: `Response pattern: ${pattern} to ${oppPiece.meta.key}`
      });
    }
  }
  
  return moves;
};

/**
 * Select appropriate response piece based on pattern
 */
window.AIEngine.selectResponsePiece = function(pattern, availablePieces, oppPiece) {
  switch (pattern) {
    case 'ant-blocking':
      console.log(`🤖 📖 ANT-BLOCKING: Countering opponent Ant`);
      return availablePieces.find(p => p.meta.key === 'A')
        || availablePieces.find(p => p.meta.key === 'S')
        || availablePieces.find(p => p.meta.key !== 'Q');
        
    case 'spider-counter':
      console.log(`🤖 📖 SPIDER-COUNTER: Matching opponent Spider`);
      return availablePieces.find(p => p.meta.key === 'S')
        || availablePieces.find(p => p.meta.key === 'A')
        || availablePieces.find(p => p.meta.key !== 'Q');
        
    case 'queen-pressure':
      console.log(`🤖 📖 QUEEN-PRESSURE: Punishing early Queen`);
      return availablePieces.find(p => p.meta.key === 'S')
        || availablePieces.find(p => p.meta.key === 'A')
        || availablePieces.find(p => p.meta.key !== 'Q');
        
    default:
      return availablePieces.find(p => p.meta.key === 'A' || p.meta.key === 'S')
        || availablePieces.find(p => p.meta.key !== 'Q');
  }
};

/**
 * Execute second move to develop the opening pattern
 */
window.AIEngine.executeSecondMove = function(pattern, availablePieces, allPlacedPieces, currentColor) {
  const moves = [];
  
  console.log(`🤖 📖 Turn 2: Developing ${pattern} pattern`);
  
  if (typeof legalPlacementZones === 'function') {
    const zones = legalPlacementZones(currentColor);
    const myPieces = allPlacedPieces.filter(p => p.meta.color === currentColor);
    
    for (const piece of availablePieces) {
      let strategicValue = this.getSecondMoveValue(piece, pattern, myPieces);
      
      const placements = this.generatePatternPlacements(piece, zones, pattern, strategicValue);
      moves.push(...placements);
    }
  }
  
  return moves;
};

/**
 * Get strategic value for second move pieces
 */
window.AIEngine.getSecondMoveValue = function(piece, pattern, myPieces) {
  const hasSpider = myPieces.some(p => p.meta.key === 'S');
  const hasAnt = myPieces.some(p => p.meta.key === 'A');
  
  switch (pattern) {
    case 'spider-first':
      if (hasSpider && piece.meta.key === 'A') return 2.2; // Complete Spider-Ant formation
      if (hasSpider && piece.meta.key === 'S') return 1.9; // Spider-Spider aggression
      break;
      
    case 'ant-development':
      if (hasAnt && piece.meta.key === 'S') return 2.1; // Ant-Spider coordination
      if (hasAnt && piece.meta.key === 'A') return 1.8; // Ant-Ant control
      break;
      
    case 'ant-blocking':
      if (piece.meta.key === 'S') return 2.0; // Follow up with Spider
      if (piece.meta.key === 'A') return 1.7; // Double Ant formation
      break;
  }
  
  // Default values
  if (piece.meta.key === 'A') return 1.5;
  if (piece.meta.key === 'S') return 1.4;
  if (piece.meta.key === 'G') return 1.2;
  if (piece.meta.key === 'B') return 1.1;
  
  return 1.0;
};

/**
 * Execute third move to complete opening setup
 */
window.AIEngine.executeThirdMove = function(pattern, availablePieces, allPlacedPieces, currentColor) {
  const moves = [];
  
  console.log(`🤖 📖 Turn 3: Completing ${pattern} setup`);
  
  if (typeof legalPlacementZones === 'function') {
    const zones = legalPlacementZones(currentColor);
    
    for (const piece of availablePieces) {
      let strategicValue = this.getThirdMoveValue(piece, pattern, allPlacedPieces, currentColor);
      
      const placements = this.generatePatternPlacements(piece, zones, pattern, strategicValue);
      moves.push(...placements);
    }
  }
  
  return moves;
};

/**
 * Get strategic value for third move pieces
 */
window.AIEngine.getThirdMoveValue = function(piece, pattern, allPlacedPieces, currentColor) {
  const myPieces = allPlacedPieces.filter(p => p.meta.color === currentColor);
  const hasSpider = myPieces.some(p => p.meta.key === 'S');
  const hasAnt = myPieces.some(p => p.meta.key === 'A');
  const hasQueen = myPieces.some(p => p.meta.key === 'Q');
  
  // Queen placement considerations
  if (piece.meta.key === 'Q') {
    if (hasSpider && hasAnt) return 2.0; // Complete formation with Queen
    if (myPieces.length >= 2) return 1.8; // Safe Queen placement
    return 1.0; // Neutral Queen value
  }
  
  // Complete powerful combinations
  if (hasSpider && !hasAnt && piece.meta.key === 'A') return 2.5;
  if (hasAnt && !hasSpider && piece.meta.key === 'S') return 2.3;
  
  // Default piece values
  if (piece.meta.key === 'A') return 1.6;
  if (piece.meta.key === 'S') return 1.5;
  if (piece.meta.key === 'G') return 1.3;
  if (piece.meta.key === 'B') return 1.4;
  
  return 1.0;
};

/**
 * Execute transition move to middle game
 */
window.AIEngine.executeTransitionMove = function(availablePieces, allPlacedPieces, currentColor) {
  const moves = [];
  
  console.log(`🤖 📖 Turn 4: Transitioning to middle game`);
  
  if (typeof legalPlacementZones === 'function') {
    const zones = legalPlacementZones(currentColor);
    
    for (const piece of availablePieces) {
      let strategicValue = this.getTransitionValue(piece, allPlacedPieces, currentColor);
      
      const placements = this.generatePatternPlacements(piece, zones, 'transition', strategicValue);
      moves.push(...placements);
    }
  }
  
  return moves;
};

/**
 * Get strategic value for transition moves
 */
window.AIEngine.getTransitionValue = function(piece, allPlacedPieces, currentColor) {
  const myPieces = allPlacedPieces.filter(p => p.meta.color === currentColor);
  const oppColor = currentColor === 'white' ? 'black' : 'white';
  const oppPieces = allPlacedPieces.filter(p => p.meta.color === oppColor);
  
  const hasQueen = myPieces.some(p => p.meta.key === 'Q');
  const oppHasQueen = oppPieces.some(p => p.meta.key === 'Q');
  
  // Must place Queen if we haven't and have 3+ pieces
  if (!hasQueen && myPieces.length >= 3 && piece.meta.key === 'Q') {
    return 3.0; // Mandatory Queen placement
  }
  
  // Tactical piece values for middle game transition
  if (oppHasQueen) {
    // Opponent has Queen - prioritize attacking pieces
    if (piece.meta.key === 'A') return 2.2; // Ants for Queen pressure
    if (piece.meta.key === 'S') return 2.0; // Spiders for tactics
    if (piece.meta.key === 'B') return 1.8; // Beetles for versatility
  }
  
  // Standard middle game values
  if (piece.meta.key === 'A') return 1.7;
  if (piece.meta.key === 'S') return 1.6;
  if (piece.meta.key === 'G') return 1.4;
  if (piece.meta.key === 'B') return 1.5;
  if (piece.meta.key === 'Q') return 1.2;
  
  return 1.0;
};

/**
 * Generate pattern-based placements for pieces
 */
window.AIEngine.generatePatternPlacements = function(piece, zones, pattern, strategicValue) {
  const placements = [];
  
  for (const zone of zones) {
    const [q, r] = zone.split(',').map(Number);
    
    placements.push({
      type: 'place',
      piece: piece,
      q: q,
      r: r,
      priority: `pattern-${pattern}-${strategicValue.toFixed(1)}`,
      reasoning: `Pattern ${pattern} placement with value ${strategicValue.toFixed(1)}`
    });
  }
  
  return placements;
};

/**
 * Generate V-formation strategic placements
 */
window.AIEngine.generateVFormationPlacements = function(piece, zones, currentColor, allPlacedPieces, baseStrategicValue = 1.0) {
  const moves = [];
  const oppColor = currentColor === 'white' ? 'black' : 'white';
  const myPieces = allPlacedPieces.filter(p => p.meta.color === currentColor);
  
  for (const zone of zones) {
    const [q, r] = zone.split(',').map(Number);
    
    // CRITICAL: Validate position is actually empty
    const existingPiece = typeof tray !== 'undefined' ? tray.find(p => 
      p.meta && p.meta.placed && p.meta.q === q && p.meta.r === r
    ) : null;
    
    if (existingPiece) {
      continue; // Skip occupied positions
    }
    
    let strategicValue = baseStrategicValue;
    let priority = 'v-formation';
    
    // V-formation bonuses based on expert strategies
    
    // 1. OUTSIDE EDGE CONTROL - "Keep pieces on outside edge, opponents inside"
    const edgeControlValue = this.evaluateOutsideEdgeControl({q, r}, myPieces, allPlacedPieces);
    strategicValue += edgeControlValue * 0.5;
    
    // 2. EARLY BLOCKING OPPORTUNITIES
    const blockingValue = this.evaluateEarlyBlocking({q, r}, oppColor, allPlacedPieces);
    strategicValue += blockingValue * 0.4;
    
    // 3. V-FORMATION GEOMETRY BONUS
    const vFormationBonus = this.evaluateVFormationGeometry({q, r}, myPieces);
    strategicValue += vFormationBonus * 0.6;
    
    // 4. ANT BLOCKING STRATEGY - "If opponent brings out ant, block it"
    const oppPieces = allPlacedPieces.filter(p => p.meta.color === oppColor);
    const oppAnts = oppPieces.filter(p => p.meta.key === 'A');
    for (const oppAnt of oppAnts) {
      const distToOppAnt = Math.abs(q - oppAnt.meta.q) + Math.abs(r - oppAnt.meta.r);
      if (distToOppAnt === 1 && piece.meta.key === 'A') {
        strategicValue += 1.0; // Ant blocking ant
        priority = 'ant-blocks-ant';
        console.log(`🤖 📖 Expert: Ant blocking opponent ant at ${q},${r}`);
      }
    }
    
    moves.push({
      type: 'place',
      piece: piece,
      q: q,
      r: r,
      priority: priority,
      strategicValue: strategicValue,
      reasoning: 'V-formation strategic placement'
    });
  }
  
  // Sort by strategic value and return top candidates
  moves.sort((a, b) => b.strategicValue - a.strategicValue);
  return moves.slice(0, 3); // Top 3 V-formation moves per piece
};

/**
 * Evaluate outside edge control potential
 */
window.AIEngine.evaluateOutsideEdgeControl = function(pos, myPieces, allPlacedPieces) {
  const {q, r} = pos;
  const distanceFromCenter = Math.abs(q) + Math.abs(r);
  
  // Pieces further from center are on "outside edge"
  let edgeValue = Math.min(distanceFromCenter * 0.2, 1.0);
  
  // Bonus if this position would be more "outside" than opponent pieces
  const oppPieces = allPlacedPieces.filter(p => p.meta.color !== (myPieces[0]?.meta.color || 'white'));
  const avgOppDistance = oppPieces.length > 0 ? 
    oppPieces.reduce((sum, p) => sum + Math.abs(p.meta.q) + Math.abs(p.meta.r), 0) / oppPieces.length : 0;
  
  if (distanceFromCenter > avgOppDistance) {
    edgeValue += 0.3; // Bonus for being more "outside" than opponent
  }
  
  return edgeValue;
};

/**
 * Evaluate early blocking opportunities
 */
window.AIEngine.evaluateEarlyBlocking = function(pos, oppColor, allPlacedPieces) {
  const oppPieces = allPlacedPieces.filter(p => p.meta.color === oppColor);
  let blockingValue = 0;
  
  for (const oppPiece of oppPieces) {
    const distance = Math.abs(pos.q - oppPiece.meta.q) + Math.abs(pos.r - oppPiece.meta.r);
    if (distance === 1) {
      // Adjacent to opponent piece - good for blocking
      blockingValue += 0.3;
      
      // Extra value for blocking important pieces
      if (oppPiece.meta.key === 'A') blockingValue += 0.2; // Block ants
      if (oppPiece.meta.key === 'Q') blockingValue += 0.4; // Block near Queen
    }
  }
  
  return Math.min(blockingValue, 1.0);
};

/**
 * Evaluate V-formation geometry
 */
window.AIEngine.evaluateVFormationGeometry = function(pos, myPieces) {
  if (myPieces.length === 0) return 0;
  
  let geometryValue = 0;
  const {q, r} = pos;
  
  // Check if this position forms good angles with existing pieces
  for (const piece of myPieces) {
    const dx = q - piece.meta.q;
    const dy = r - piece.meta.r;
    const distance = Math.abs(dx) + Math.abs(dy);
    
    if (distance === 1) {
      // Adjacent - good for V-formation
      geometryValue += 0.2;
    } else if (distance === 2) {
      // Diagonal distance 2 - creates V-formation angles
      geometryValue += 0.4;
    }
  }
  
  // Bonus for creating triangular/V-shaped formations
  if (myPieces.length >= 2) {
    const angles = this.calculateFormationAngles(pos, myPieces);
    const hasGoodAngles = angles.some(angle => angle >= 60 && angle <= 120);
    if (hasGoodAngles) {
      geometryValue += 0.3; // V-formation angle bonus
    }
  }
  
  return Math.min(geometryValue, 1.0);
};

/**
 * Calculate formation angles (simplified)
 */
window.AIEngine.calculateFormationAngles = function(pos, pieces) {
  // Simplified angle calculation for V-formation detection
  const angles = [];
  
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      // Calculate angle between piece[i] -> pos -> piece[j]
      const dx1 = pieces[i].meta.q - pos.q;
      const dy1 = pieces[i].meta.r - pos.r;
      const dx2 = pieces[j].meta.q - pos.q;
      const dy2 = pieces[j].meta.r - pos.r;
      
      // Simplified angle calculation using dot product
      const dot = dx1 * dx2 + dy1 * dy2;
      const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      
      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = dot / (mag1 * mag2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
        angles.push(angle);
      }
    }
  }
  
  return angles;
};

/**
 * TEMPO AND INITIATIVE EVALUATION - Expert strategic concept (Robust version)
 * "First to block opponent Queen = big advantage"
 * "Keep yours mobile while blocking theirs" 
 */
window.AIEngine.evaluateTempoAndInitiative = function(gameState, aiColor, oppColor) {
  try {
    let tempoScore = 0;
    
    // Get Queens for both sides - more robust search
    let aiQueen = null;
    let oppQueen = null;
    
    if (gameState.tray && Array.isArray(gameState.tray)) {
      aiQueen = gameState.tray.find(p => p && p.placed && p.meta && p.meta.color === aiColor && p.meta.key === 'Q');
      oppQueen = gameState.tray.find(p => p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q');
    }
    
    if (!aiQueen || !oppQueen) {
      return 0; // Can't evaluate tempo without both Queens
    }
    
    // 1. INITIATIVE: "First to block opponent Queen = big advantage"
    const aiQueenThreats = this.countQueenThreats(gameState, oppColor);
    const oppQueenThreats = this.countQueenThreats(gameState, aiColor);
    
    if (aiQueenThreats > 0 && oppQueenThreats === 0) {
      tempoScore += 1.0; // We have initiative - threatening without being threatened
      debugLog(`🤖 ⚡ TEMPO: Initiative advantage - threatening opponent Queen`);
    } else if (aiQueenThreats === 0 && oppQueenThreats > 0) {
      tempoScore -= 0.8; // Opponent has initiative
    } else if (aiQueenThreats > oppQueenThreats) {
      tempoScore += 0.5; // We're winning the Queen threat race
    } else if (oppQueenThreats > aiQueenThreats) {
      tempoScore -= 0.4; // Opponent is ahead in threats
    }
    
    // 2. QUEEN MOBILITY: "Keep yours mobile while blocking theirs"
    const aiQueenMobility = this.getQueenMobility(aiQueen, gameState);
    const oppQueenMobility = this.getQueenMobility(oppQueen, gameState);
    
    if (aiQueenMobility > 0 && oppQueenMobility === 0) {
      tempoScore += 1.5; // Dominant position - our Queen mobile, theirs trapped
      debugLog(`🤖 ⚡ TEMPO: Dominant Queen mobility (${aiQueenMobility} vs 0)`);
    } else if (aiQueenMobility === 0 && oppQueenMobility > 0) {
      tempoScore -= 1.2; // Bad position - our Queen trapped
    } else {
      // Mobility advantage
      const mobilityDiff = aiQueenMobility - oppQueenMobility;
      tempoScore += mobilityDiff * 0.3;
    }
    
    // 3. CRITICAL QUEEN MOVES: "One space move by bee can be devastating"
    const criticalMoves = this.findCriticalQueenMoves(aiQueen, oppQueen, gameState);
    tempoScore += criticalMoves.length * 0.4;
    
    // 4. TEMPO PRESERVATION: Pieces that maintain pressure
    const aiPressurePieces = this.countPressurePieces(gameState, aiColor, oppQueen);
    const oppPressurePieces = this.countPressurePieces(gameState, oppColor, aiQueen);
    
    tempoScore += (aiPressurePieces - oppPressurePieces) * 0.2;
    
    // 5. INITIATIVE TIMING: Who moved to create current threats?
    const threatImbalance = aiQueenThreats - oppQueenThreats;
    if (Math.abs(threatImbalance) >= 2) {
      // Significant threat advantage suggests good tempo
      tempoScore += Math.sign(threatImbalance) * 0.3;
    }
    
    debugLog(`🤖 ⚡ TEMPO SCORE: ${tempoScore.toFixed(2)} (AI threats: ${aiQueenThreats}, Opp threats: ${oppQueenThreats})`);
    return Math.max(-5, Math.min(5, tempoScore)); // Clamp to reasonable range
    
  } catch (error) {
    console.error(`🤖 💥 TEMPO ERROR: Exception in evaluateTempoAndInitiative:`, error);
    return 0;
  }
};

/**
 * Get Queen mobility (number of legal moves) - robust version
 */
window.AIEngine.getQueenMobility = function(queen, gameState) {
  try {
    if (!queen || !queen.meta || !gameState) return 0;
    
    // Approximate Queen mobility by counting empty adjacent spaces
    const neighbors = this.getNeighborCoords(queen.meta.q, queen.meta.r);
    let mobility = 0;
    
    for (const [nq, nr] of neighbors) {
      let occupied = false;
      
      if (gameState.tray && Array.isArray(gameState.tray)) {
        occupied = gameState.tray.some(p => 
          p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
        );
      }
      
      if (!occupied) {
        mobility++;
      }
    }
    
    return mobility;
  } catch (error) {
    console.error(`🤖 💥 ERROR in getQueenMobility:`, error);
    return 0;
  }
};

/**
 * Find critical Queen moves that could be devastating - robust version
 */
window.AIEngine.findCriticalQueenMoves = function(aiQueen, oppQueen, gameState) {
  try {
    const criticalMoves = [];
    
    if (!aiQueen || !aiQueen.meta || !oppQueen || !oppQueen.meta || !gameState) {
      return criticalMoves;
    }
    
    // Check moves that would increase pressure on opponent Queen
    const neighbors = this.getNeighborCoords(aiQueen.meta.q, aiQueen.meta.r);
    
    for (const [nq, nr] of neighbors) {
      let occupied = false;
      
      if (gameState.tray && Array.isArray(gameState.tray)) {
        occupied = gameState.tray.some(p => 
          p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
        );
      }
      
      if (!occupied) {
        // Check if moving here would increase threat to opponent Queen
        const distanceToOppQueen = Math.abs(nq - oppQueen.meta.q) + Math.abs(nr - oppQueen.meta.r);
        if (distanceToOppQueen <= 2) {
          criticalMoves.push({q: nq, r: nr, type: 'threat_increase'});
        }
        
        // Check if this move would escape current threats
        const currentThreats = this.countQueenThreats(gameState, aiQueen.meta.color);
        if (currentThreats > 0) {
          // Moving might reduce threats - this is critical
          criticalMoves.push({q: nq, r: nr, type: 'escape_threat'});
        }
      }
    }
    
    return criticalMoves;
  } catch (error) {
    console.error(`🤖 💥 ERROR in findCriticalQueenMoves:`, error);
    return [];
  }
};

/**
 * Count pieces that maintain pressure on opponent Queen - robust version
 */
window.AIEngine.countPressurePieces = function(gameState, color, targetQueen) {
  try {
    if (!targetQueen || !targetQueen.meta || !gameState) return 0;
    
    let pieces = [];
    
    if (gameState.tray && Array.isArray(gameState.tray)) {
      pieces = gameState.tray.filter(p => p && p.placed && p.meta && p.meta.color === color);
    }
    
    let pressurePieces = 0;
    
    for (const piece of pieces) {
      if (piece && piece.meta) {
        const distance = Math.abs(piece.meta.q - targetQueen.meta.q) + Math.abs(piece.meta.r - targetQueen.meta.r);
        
        // Pieces close to opponent Queen maintain pressure
        if (distance <= 2) {
          pressurePieces++;
          
          // Ants and Beetles especially good at maintaining pressure
          if (piece.meta.key === 'A' || piece.meta.key === 'B') {
            pressurePieces += 0.5; // Bonus for pressure pieces
          }
        }
      }
    }
    
    return pressurePieces;
  } catch (error) {
    console.error(`🤖 💥 ERROR in countPressurePieces:`, error);
    return 0;
  }
};

/**
 * Select counter piece for advanced difficulty
 */
window.AIEngine.selectCounterPiece = function(opponentPiece, availablePieces) {
  const opponentKey = opponentPiece.meta.key;
  
  // Counter-strategies based on opponent's opening
  if (opponentKey === 'Q') {
    // Queen opening - apply pressure with beetle or ant
    return availablePieces.find(p => p.meta.key === 'B' || p.meta.key === 'A') || availablePieces[0];
  } else if (opponentKey === 'A') {
    // Ant opening - flexible pieces to match mobility
    return availablePieces.find(p => p.meta.key === 'G' || p.meta.key === 'S') || availablePieces[0];
  } else if (opponentKey === 'B') {
    // Beetle opening - avoid clustering, use spider or grasshopper
    return availablePieces.find(p => p.meta.key === 'S' || p.meta.key === 'G') || availablePieces[0];
  } else if (opponentKey === 'G') {
    // Grasshopper opening - control with ant
    return availablePieces.find(p => p.meta.key === 'A' || p.meta.key === 'B') || availablePieces[0];
  } else if (opponentKey === 'S') {
    // Spider opening - match with ant for control
    return availablePieces.find(p => p.meta.key === 'A' || p.meta.key === 'G') || availablePieces[0];
  }
  
  return availablePieces[0];
};

/**
 * Evaluate opening position quality
 */
window.AIEngine.evaluateOpeningPosition = function(q, r, opponentPiece, allPlacedPieces) {
  let value = 0.5; // Base value
  
  // Distance from center (closer is generally better in opening)
  const centerDistance = Math.abs(q) + Math.abs(r);
  if (centerDistance <= 1) value += 0.2;
  else if (centerDistance <= 2) value += 0.1;
  else value -= 0.1;
  
  // Position relative to opponent
  const dx = q - opponentPiece.meta.q;
  const dy = r - opponentPiece.meta.r;
  const distance = Math.abs(dx) + Math.abs(dy);
  
  // Adjacent positions are important
  if (distance === 1) value += 0.3;
  
  // Consider position type (side vs corner)
  const neighborCount = this.getNeighborCoords(q, r).length;
  if (neighborCount >= 4) value += 0.1; // More connections possible
  
  return Math.max(0, Math.min(1, value));
};

/**
 * Generate strategic piece placements with proper validation
 */
window.AIEngine.generateStrategicPlacements = function(piece, zones, currentColor, allPlacedPieces, isOpening = false, difficulty = 'easy') {
  const moves = [];
  const oppColor = currentColor === 'white' ? 'black' : 'white';
  const oppQueen = allPlacedPieces.find(p => p.meta.color === oppColor && p.meta.key === 'Q');
  
  for (const zone of zones) {
    const [q, r] = zone.split(',').map(Number);
    
    // Calculate distance from origin for some legacy strategic calculations (gradually removing)
    const centerDistance = Math.abs(q) + Math.abs(r);
    
    // CRITICAL: Validate position is actually empty
    const existingPiece = typeof tray !== 'undefined' ? tray.find(p => 
      p.meta && p.meta.placed && p.meta.q === q && p.meta.r === r
    ) : null;
    
    if (existingPiece) {
      console.warn(`🤖 ⚠️ Skipping occupied position ${q},${r} (has ${existingPiece.meta.key})`);
      continue; // Skip occupied positions - only Beetles can stack!
    }
    
    // Additional check with window.cells if available
    if (window.cells && window.cells.has(`${q},${r}`)) {
      const cell = window.cells.get(`${q},${r}`);
      if (cell.stack.length > 0) {
        console.warn(`🤖 ⚠️ Skipping stacked position ${q},${r} (${cell.stack.length} pieces)`);
        continue; // Skip stacked positions
      }
    }
    
    let priority = 'normal';
    let strategicValue = 0;
    
    // Queen-focused Hive strategy (no center control concept in Hive)
    
    // Difficulty-specific strategic adjustments
    let strategyMultiplier = 1.0;
    if (difficulty === 'medium') {
      strategyMultiplier = 1.3;
    } else if (difficulty === 'hard') {
      strategyMultiplier = 1.6;
    }
    
    // Piece-specific strategic placement
    switch (piece.meta.key) {
      case 'Q':
        // Queen - prefer protected central positions
        const protection = this.countAdjacentFriendlyPieces({q, r}, currentColor);
        strategicValue += protection * 0.3 * strategyMultiplier;
        
        if (difficulty !== 'easy') {
          // Medium+ considers escape routes for Queen
          const escapeRoutes = this.countEmptyNeighbors({q, r}, allPlacedPieces);
          strategicValue += escapeRoutes * 0.2;
        }
        
        if (protection >= 1) {
          priority = 'queen-safe';
        }
        break;
        
      case 'A':
        // Ant - prefer positions with mobility
        const mobility = this.countEmptyNeighbors({q, r}, allPlacedPieces);
        strategicValue += mobility * 0.1 * strategyMultiplier;
        
        if (difficulty !== 'easy') {
          // Medium+ considers board control potential
          const controlPotential = this.evaluateControlPotential({q, r}, currentColor, allPlacedPieces);
          strategicValue += controlPotential * 0.15;
        }
        
        if (isOpening) {
          priority = 'ant-opening';
        }
        break;
        
      case 'B':
        // Beetle - prefer positions near stacks or opponent pieces (but not ON them for placement)
        const nearOpponent = this.countAdjacentOpponentPieces({q, r}, oppColor);
        strategicValue += nearOpponent * 0.2 * strategyMultiplier;
        
        if (difficulty !== 'easy') {
          // Medium+ considers stacking opportunities
          const stackingValue = this.evaluateStackingOpportunities({q, r}, allPlacedPieces);
          strategicValue += stackingValue * 0.25;
        }
        
        if (nearOpponent > 0) {
          priority = 'beetle-aggressive';
        }
        break;
        
      case 'G':
        // Grasshopper - prefer positions with jump opportunities
        const jumpOpps = this.countPotentialJumps({q, r}, allPlacedPieces);
        strategicValue += jumpOpps * 0.15 * strategyMultiplier;
        
        if (difficulty !== 'easy') {
          // Medium+ considers jump chains and complex moves
          const jumpChainValue = this.evaluateJumpChains({q, r}, allPlacedPieces);
          strategicValue += jumpChainValue * 0.2;
        }
        break;
        
      case 'S':
        // Spider - prefer flexible positions
        // Spider positioning is flexible regardless of distance from origin
        strategicValue += 0.1 * strategyMultiplier;
        priority = 'spider-flexible';
        
        if (difficulty !== 'easy') {
          // Medium+ considers 3-step positioning
          const spiderValue = this.evaluateSpiderPositioning({q, r}, allPlacedPieces);
          strategicValue += spiderValue * 0.18;
        }
        break;
    }
    
    // 🎯 TWO-FOR-ONE BLOCKING DETECTION - Expert tactical pattern
    const twoForOneValue = this.evaluateTwoForOneBlocking({q, r}, oppColor, allPlacedPieces);
    if (twoForOneValue > 0) {
      strategicValue += twoForOneValue;
      priority = 'two-for-one-block';
      console.log(`🤖 ⚡ Two-for-one blocking opportunity at ${q},${r} worth ${twoForOneValue}`);
    }
    
    // 🎯 AGGRESSIVE QUEEN HUNTING - Ants are deadly assassins!
    if (oppQueen) {
      const queenDistance = Math.abs(q - oppQueen.meta.q) + Math.abs(r - oppQueen.meta.r);
      if (queenDistance <= 2) {
        // MASSIVE bonuses for Queen threatening based on piece type
        if (piece.meta.key === 'A') {
          strategicValue += 2.0; // ANT ASSASSIN BONUS - huge threat!
          priority = 'ant-assassin';
        } else if (piece.meta.key === 'G') {
          strategicValue += 1.5; // Grasshopper jump attack
          priority = 'grasshopper-hunter';
        } else if (piece.meta.key === 'S') {
          strategicValue += 1.2; // Spider positioning attack
          priority = 'spider-hunter';
        } else {
          strategicValue += 0.8; // Other pieces still good
          priority = 'threaten-queen';
        }
      }
    }
    
    moves.push({
      type: 'place',
      piece: piece,
      q: q,
      r: r,
      priority: priority,
      strategicValue: strategicValue
    });
  }
  
  // Sort by strategic value, return top candidates
  moves.sort((a, b) => b.strategicValue - a.strategicValue);
  return moves.slice(0, 5); // Limit to top 5 positions per piece
};

/**
 * Evaluate strategic value of a piece movement with comprehensive Hive strategy
 */
window.AIEngine.evaluateMoveStrategicValue = function(piece, toQ, toR, allPlacedPieces, oppColor) {
  let value = 0;
  const oppQueen = allPlacedPieces.find(p => p.meta.color === oppColor && p.meta.key === 'Q');
  
  // Distance to opponent queen
  if (oppQueen) {
    const queenDistance = Math.abs(toQ - oppQueen.meta.q) + Math.abs(toR - oppQueen.meta.r);
    if (queenDistance === 1) {
      value += 1.0; // Adjacent to queen - very valuable
    } else if (queenDistance === 2) {
      value += 0.5; // Near queen
    }
  }
  
  // Piece-specific movement values
  switch (piece.meta.key) {
    case 'A':
      // Ants benefit from central, mobile positions
      const centerDistance = Math.abs(toQ) + Math.abs(toR);
      value += Math.max(0, 3 - centerDistance) * 0.2;
      break;
      
    case 'B':
      // Beetles benefit from being near other pieces (stacking potential)
      const nearPieces = this.countAllAdjacentPieces({q: toQ, r: toR}, allPlacedPieces);
      value += nearPieces * 0.15;
      break;
      
    case 'G':
      // Grasshoppers benefit from jump opportunities
      const jumpOpps = this.countPotentialJumps({q: toQ, r: toR}, allPlacedPieces);
      value += jumpOpps * 0.2;
      break;
      
    case 'S':
      // Spiders benefit from flexible central positions
      value += Math.max(0, 2 - Math.abs(toQ) - Math.abs(toR)) * 0.1;
      break;
  }
  
  return value > 0.8 ? 'high-value' : value > 0.4 ? 'medium-value' : 'low-value';
};

/**
 * Comprehensive strategic evaluation for piece movement with advanced Hive principles
 */
window.AIEngine.evaluateMovementStrategy = function(piece, toQ, toR, allPlacedPieces, oppColor, hasQueen) {
  let value = 0;
  let priority = 'normal';
  let reasoning = [];
  
  const myColor = piece.meta.color;
  const oppQueen = allPlacedPieces.find(p => p.meta.color === oppColor && p.meta.key === 'Q');
  const myQueen = allPlacedPieces.find(p => p.meta.color === myColor && p.meta.key === 'Q');
  
  // STRATEGIC RULE: Queen safety first
  if (myQueen) {
    const queenThreats = this.countQueenThreats_ForPlacedPieces(allPlacedPieces, myQueen);
    
    // If my Queen is in danger, prioritize defensive moves
    if (queenThreats >= 4) {
      const distFromMyQueen = Math.abs(toQ - myQueen.meta.q) + Math.abs(toR - myQueen.meta.r);
      if (distFromMyQueen <= 2) {
        value += 2.0;
        priority = 'defend-queen';
        reasoning.push('Defending endangered Queen');
      }
    }
    
    // NEVER move in ways that help surround our own Queen
    if (queenThreats >= 3) {
      const wouldThreatenOurQueen = Math.abs(toQ - myQueen.meta.q) + Math.abs(toR - myQueen.meta.r) === 1;
      if (wouldThreatenOurQueen) {
        value -= 5.0;
        priority = 'dangerous-self-threat';
        reasoning.push('DANGEROUS: Would threaten own Queen');
      }
    }
  }
  
  // STRATEGIC RULE: Aggressive Queen hunting when safe
  if (oppQueen && (!myQueen || this.countQueenThreats_ForPlacedPieces(allPlacedPieces, myQueen) <= 2)) {
    const distToOppQueen = Math.abs(toQ - oppQueen.meta.q) + Math.abs(toR - oppQueen.meta.r);
    
    if (distToOppQueen === 1) {
      // This move directly threatens opponent Queen
      const oppThreatsAfter = this.countQueenThreats_ForPlacedPieces(allPlacedPieces, oppQueen) + 1;
      
      if (oppThreatsAfter >= 6) {
        value += 10.0;
        priority = 'winning-move';
        reasoning.push('WINNING: Surrounds opponent Queen!');
      } else if (oppThreatsAfter >= 5) {
        value += 5.0;
        priority = 'threaten-queen';
        reasoning.push('Critical threat to opponent Queen');
      } else if (oppThreatsAfter >= 4) {
        value += 3.0;
        priority = 'threaten-queen';
        reasoning.push('Strong pressure on opponent Queen');
      } else {
        value += 1.5;
        priority = 'threaten-queen';
        reasoning.push('Building attack on opponent Queen');
      }
    } else if (distToOppQueen === 2) {
      value += 0.8;
      reasoning.push('Positioning near opponent Queen');
    }
  }
  
  // STRATEGIC RULE: Anti-Ant pinning strategy
  if (piece.meta.key === 'A') {
    // Ants should avoid being pinned but can pin opponents
    const mobilityAfterMove = this.countEmptyNeighbors({q: toQ, r: toR}, allPlacedPieces);
    
    if (mobilityAfterMove >= 3) {
      value += 0.5;
      reasoning.push('Maintains Ant mobility');
    } else if (mobilityAfterMove <= 1) {
      value -= 0.8;
      reasoning.push('Risk: Ant mobility limited');
    }
    
    // Check if this Ant move can pin opponent pieces
    const canPinOpponent = this.evaluateAntPinningPotential(toQ, toR, allPlacedPieces, oppColor);
    if (canPinOpponent) {
      value += 1.2;
      priority = 'ant-pin-attack';
      reasoning.push('Ant pinning opponent pieces');
    }
  }
  
  // STRATEGIC RULE: Piece-specific strategic positioning
  switch (piece.meta.key) {
    case 'B': // Beetle strategic climbing
      const stackingOpportunities = this.evaluateStackingValue(toQ, toR, allPlacedPieces, oppColor);
      if (stackingOpportunities.canStack) {
        value += stackingOpportunities.value;
        reasoning.push(stackingOpportunities.reason);
      }
      break;
      
    case 'G': // Grasshopper strategic jumping
      const jumpValue = this.evaluateGrasshopperJumpStrategy(piece, toQ, toR, allPlacedPieces, oppColor);
      value += jumpValue.value;
      if (jumpValue.reason) reasoning.push(jumpValue.reason);
      break;
      
    case 'S': // Spider strategic positioning
      const spiderValue = this.evaluateSpiderStrategy(piece, toQ, toR, allPlacedPieces);
      value += spiderValue.value;
      if (spiderValue.reason) reasoning.push(spiderValue.reason);
      break;
      
    case 'Q': // Queen escape moves
      if (myQueen && piece === myQueen) {
        const escapeValue = this.evaluateQueenEscapeMove(toQ, toR, allPlacedPieces);
        value += escapeValue.value;
        if (escapeValue.reason) reasoning.push(escapeValue.reason);
      }
      break;
  }
  
  // STRATEGIC RULE: Maintain hive connectivity and shape
  const connectivityValue = this.evaluateHiveConnectivity(piece, toQ, toR, allPlacedPieces);
  if (connectivityValue.breaks) {
    value -= 10.0; // NEVER break the hive
    priority = 'illegal-move';
    reasoning.push('ILLEGAL: Would break hive connectivity');
  } else {
    value += connectivityValue.value;
    if (connectivityValue.reason) reasoning.push(connectivityValue.reason);
  }
  
  return {
    value: value,
    priority: priority,
    reasoning: reasoning.join('; ')
  };
};

/**
 * Helper: Count Queen threats for placed pieces evaluation
 */
window.AIEngine.countQueenThreats_ForPlacedPieces = function(allPlacedPieces, queen) {
  if (!queen) return 0;
  
  const neighbors = this.getNeighborCoords(queen.meta.q, queen.meta.r);
  let threats = 0;
  
  for (const [nq, nr] of neighbors) {
    const occupied = allPlacedPieces.some(p => p.meta.q === nq && p.meta.r === nr);
    if (occupied) threats++;
  }
  
  return threats;
};

/**
 * Helper: Evaluate Ant pinning potential
 */
window.AIEngine.evaluateAntPinningPotential = function(toQ, toR, allPlacedPieces, oppColor) {
  // Check if moving Ant to this position would limit opponent mobility
  const neighbors = this.getNeighborCoords(toQ, toR);
  let pinValue = 0;
  
  for (const [nq, nr] of neighbors) {
    const oppPiece = allPlacedPieces.find(p => 
      p.meta.color === oppColor && p.meta.q === nq && p.meta.r === nr
    );
    if (oppPiece) {
      // Check if opponent piece would have limited mobility
      const oppMobility = this.countEmptyNeighbors({q: nq, r: nr}, allPlacedPieces);
      if (oppMobility <= 2) {
        pinValue += 0.5; // Contributes to pinning
      }
    }
  }
  
  return pinValue > 0;
};

/**
 * Helper: Evaluate Beetle stacking strategy
 */
window.AIEngine.evaluateStackingValue = function(toQ, toR, allPlacedPieces, oppColor) {
  // Check if there's a piece at the destination to climb on
  const targetPiece = allPlacedPieces.find(p => p.meta.q === toQ && p.meta.r === toR);
  
  if (targetPiece && targetPiece.meta.color === oppColor) {
    // Climbing on opponent piece
    if (targetPiece.meta.key === 'Q') {
      return { canStack: true, value: 8.0, reason: 'Beetle attacking opponent Queen!' };
    } else if (targetPiece.meta.key === 'A') {
      return { canStack: true, value: 2.0, reason: 'Beetle pinning opponent Ant' };
    } else {
      return { canStack: true, value: 1.0, reason: 'Beetle climbing on opponent piece' };
    }
  }
  
  return { canStack: false, value: 0 };
};

/**
 * Helper: Evaluate Grasshopper jump strategy
 */
window.AIEngine.evaluateGrasshopperJumpStrategy = function(piece, toQ, toR, allPlacedPieces, oppColor) {
  // Grasshopper jumps are powerful for reaching isolated positions
  const oppQueen = allPlacedPieces.find(p => p.meta.color === oppColor && p.meta.key === 'Q');
  
  if (oppQueen) {
    const distToOppQueen = Math.abs(toQ - oppQueen.meta.q) + Math.abs(toR - oppQueen.meta.r);
    if (distToOppQueen === 1) {
      return { value: 2.5, reason: 'Grasshopper jump threatening Queen' };
    } else if (distToOppQueen === 2) {
      return { value: 0.8, reason: 'Grasshopper positioning near Queen' };
    }
  }
  
  return { value: 0.2, reason: 'Standard Grasshopper positioning' };
};

/**
 * Helper: Evaluate Spider strategy
 */
window.AIEngine.evaluateSpiderStrategy = function(piece, toQ, toR, allPlacedPieces) {
  // Spiders move exactly 3 steps - evaluate positioning flexibility
  const centerDistance = Math.abs(toQ) + Math.abs(toR);
  
  if (centerDistance <= 2) {
    return { value: 0.6, reason: 'Spider in flexible central position' };
  } else {
    return { value: 0.2, reason: 'Spider positioning' };
  }
};

/**
 * Helper: Evaluate Queen escape moves
 */
window.AIEngine.evaluateQueenEscapeMove = function(toQ, toR, allPlacedPieces) {
  // Count escape routes from new Queen position
  const escapeRoutes = this.countEmptyNeighbors({q: toQ, r: toR}, allPlacedPieces);
  
  if (escapeRoutes >= 4) {
    return { value: 2.0, reason: 'Queen moving to safe position with escape routes' };
  } else if (escapeRoutes >= 2) {
    return { value: 1.0, reason: 'Queen maintaining mobility' };
  } else {
    return { value: -1.0, reason: 'WARNING: Queen moving to limited position' };
  }
};

/**
 * Helper: Evaluate hive connectivity after move
 */
window.AIEngine.evaluateHiveConnectivity = function(piece, toQ, toR, allPlacedPieces) {
  // This would need actual implementation of hive connectivity rules
  // For now, assume moves are legal if generated by the game
  return { breaks: false, value: 0.1, reason: 'Maintains hive connectivity' };
};

/**
 * Strategic decision: Should AI place Queen now based on board position?
 */
window.AIEngine.shouldPlaceQueenNow = function(allPlacedPieces, myColor, oppColor, myTurnNumber, difficulty) {
  // STRATEGIC PRINCIPLE: Delay Queen placement for tactical advantage, but not too long
  
  // Easy difficulty: Place Queen early for safety
  if (difficulty === 'easy') {
    return myTurnNumber >= 2; // Place by turn 2
  }
  
  // Count opponent's pressure and pieces
  const oppPieces = allPlacedPieces.filter(p => p.meta.color === oppColor);
  const myPieces = allPlacedPieces.filter(p => p.meta.color === myColor);
  const oppQueenPlaced = oppPieces.some(p => p.meta.key === 'Q');
  
  // Advanced timing based on opponent's strategy
  if (difficulty === 'medium') {
    // Place Queen by turn 3, or earlier if opponent is aggressive
    if (myTurnNumber >= 3) return true;
    if (oppQueenPlaced && oppPieces.length >= 3) return true; // Opponent developing fast
    return false;
  }
  
  if (difficulty === 'hard') {
    // Sophisticated Queen timing - delay until maximum strategic advantage
    if (myTurnNumber >= 3) return true; // Must place by turn 4 (absolute rule)
    
    // Place early if opponent has aggressive formation
    if (oppQueenPlaced && this.isOpponentFormationAggressive(allPlacedPieces, oppColor)) {
      debugLog(`🤖 👑 STRATEGIC: Placing Queen early due to aggressive opponent formation`);
      return true;
    }
    
    // Place early if we have good defensive pieces ready
    if (myPieces.length >= 2 && this.hasGoodQueenDefenders(myPieces)) {
      debugLog(`🤖 👑 STRATEGIC: Placing Queen with good defenders available`);
      return true;
    }
    
    // Delay Queen placement for flexibility
    debugLog(`🤖 👑 STRATEGIC: Delaying Queen placement for tactical flexibility`);
    return false;
  }
  
  return myTurnNumber >= 3; // Fallback
};

/**
 * Check if opponent formation is aggressive (targeting our potential Queen positions)
 */
window.AIEngine.isOpponentFormationAggressive = function(allPlacedPieces, oppColor) {
  const oppPieces = allPlacedPieces.filter(p => p.meta.color === oppColor);
  
  // Look for opponent pieces positioned for quick strikes
  let aggressiveIndicators = 0;
  
  for (const piece of oppPieces) {
    // Ants in forward positions are aggressive
    if (piece.meta.key === 'A') {
      const centerDistance = Math.abs(piece.meta.q) + Math.abs(piece.meta.r);
      if (centerDistance <= 1) aggressiveIndicators++;
    }
    
    // Beetles ready to climb
    if (piece.meta.key === 'B') {
      const neighboredPieces = this.countAllAdjacentPieces(piece, allPlacedPieces);
      if (neighboredPieces >= 2) aggressiveIndicators++;
    }
    
    // Multiple mobile pieces suggest aggression
    if (['A', 'G', 'B'].includes(piece.meta.key)) {
      aggressiveIndicators += 0.5;
    }
  }
  
  debugLog(`🤖 👑 Opponent aggression score: ${aggressiveIndicators}`);
  return aggressiveIndicators >= 2.5;
};

/**
 * Check if we have good pieces to defend Queen
 */
window.AIEngine.hasGoodQueenDefenders = function(myPieces) {
  let defenderScore = 0;
  
  for (const piece of myPieces) {
    switch (piece.meta.key) {
      case 'B': defenderScore += 2; break; // Beetles excellent defenders
      case 'A': defenderScore += 1.5; break; // Ants good mobile defenders  
      case 'S': defenderScore += 1; break; // Spiders decent defenders
      case 'G': defenderScore += 0.5; break; // Grasshoppers limited defenders
    }
  }
  
  debugLog(`🤖 👑 Defender score: ${defenderScore}`);
  return defenderScore >= 2.5;
};

/**
 * Evaluate strategic Queen placement positions
 */
window.AIEngine.evaluateQueenPlacementPositions = function(zones, allPlacedPieces, myColor, oppColor) {
  const queenMoves = [];
  const queen = typeof tray !== 'undefined' ? tray.find(p => 
    p.meta && p.meta.color === myColor && p.meta.key === 'Q' && !p.meta.placed
  ) : null;
  
  if (!queen) return [];
  
  debugLog(`🤖 👑 Evaluating ${zones.length} Queen positions...`);
  
  for (const zone of zones) {
    const [q, r] = zone.split(',').map(Number);
    
    // STRATEGIC EVALUATION: Queen safety factors
    let safetyScore = this.evaluateQueenSafety(q, r, allPlacedPieces, myColor, oppColor);
    let priority = 'queen-placement';
    let reasoning = [];
    
    // Factor 1: Distance from opponent pieces (isolation = safety)
    const oppPieces = allPlacedPieces.filter(p => p.meta.color === oppColor);
    let minDistToOpp = Infinity;
    
    for (const oppPiece of oppPieces) {
      const dist = Math.abs(q - oppPiece.meta.q) + Math.abs(r - oppPiece.meta.r);
      minDistToOpp = Math.min(minDistToOpp, dist);
    }
    
    if (minDistToOpp >= 3) {
      safetyScore += 2.0;
      reasoning.push('Isolated from opponents');
      priority = 'queen-safe';
    } else if (minDistToOpp >= 2) {
      safetyScore += 1.0;
      reasoning.push('Safe distance from opponents');
    } else {
      safetyScore -= 1.0;
      reasoning.push('Close to opponent pieces');
    }
    
    // Factor 2: Escape routes (empty neighbors)
    const escapeRoutes = this.countEmptyNeighbors({q, r}, allPlacedPieces);
    safetyScore += escapeRoutes * 0.3;
    reasoning.push(`${escapeRoutes} escape routes`);
    
    // Factor 3: Friendly piece support
    const friendlySupport = this.countAdjacentFriendlyPieces({q, r}, myColor);
    safetyScore += friendlySupport * 0.5;
    if (friendlySupport > 0) {
      reasoning.push(`${friendlySupport} friendly neighbors`);
    }
    
    // Factor 4: Avoid obvious trap positions
    const trapRisk = this.evaluateQueenTrapRisk(q, r, allPlacedPieces, oppColor);
    safetyScore -= trapRisk;
    if (trapRisk > 0) {
      reasoning.push(`Trap risk: ${trapRisk}`);
    }
    
    debugLog(`🤖 👑 Position ${q},${r}: safety=${safetyScore.toFixed(2)}, ${reasoning.join(', ')}`);
    
    queenMoves.push({
      type: 'place',
      piece: queen,
      q: q,
      r: r,
      priority: priority,
      strategicValue: safetyScore,
      reasoning: reasoning.join('; ')
    });
  }
  
  // Sort by safety score (highest first)
  queenMoves.sort((a, b) => b.strategicValue - a.strategicValue);
  
  // Return top 3 safest positions
  return queenMoves.slice(0, 3);
};

/**
 * Evaluate Queen safety at a specific position
 */
window.AIEngine.evaluateQueenSafety = function(q, r, allPlacedPieces, myColor, oppColor) {
  let safety = 0;
  
  // Base safety from position characteristics
  const neighbors = this.getNeighborCoords(q, r);
  let occupiedNeighbors = 0;
  let friendlyNeighbors = 0;
  let hostileNeighbors = 0;
  
  for (const [nq, nr] of neighbors) {
    const piece = allPlacedPieces.find(p => p.meta.q === nq && p.meta.r === nr);
    if (piece) {
      occupiedNeighbors++;
      if (piece.meta.color === myColor) {
        friendlyNeighbors++;
      } else {
        hostileNeighbors++;
      }
    }
  }
  
  // Safety calculation
  safety += (6 - occupiedNeighbors) * 0.2; // More empty = safer
  safety += friendlyNeighbors * 0.3; // Friendly support
  safety -= hostileNeighbors * 0.8; // Hostile neighbors very dangerous
  
  return safety;
};

/**
 * Evaluate trap risk for Queen position
 */
window.AIEngine.evaluateQueenTrapRisk = function(q, r, allPlacedPieces, oppColor) {
  let risk = 0;
  
  // Check for opponent Ants that could quickly reach this position
  const oppAnts = allPlacedPieces.filter(p => 
    p.meta.color === oppColor && p.meta.key === 'A'
  );
  
  for (const ant of oppAnts) {
    const dist = Math.abs(q - ant.meta.q) + Math.abs(r - ant.meta.r);
    if (dist <= 3) {
      risk += Math.max(0, 4 - dist) * 0.2; // Closer Ants = higher risk
    }
  }
  
  // Check for opponent Beetles that could climb/pin
  const oppBeetles = allPlacedPieces.filter(p => 
    p.meta.color === oppColor && p.meta.key === 'B'
  );
  
  for (const beetle of oppBeetles) {
    const dist = Math.abs(q - beetle.meta.q) + Math.abs(r - beetle.meta.r);
    if (dist <= 2) {
      risk += Math.max(0, 3 - dist) * 0.15; // Beetle threat
    }
  }
  
  return risk;
};

/**
 * Helper functions for strategic evaluation
 */
window.AIEngine.countAdjacentFriendlyPieces = function(pos, color) {
  const neighbors = this.getNeighborCoords(pos.q, pos.r);
  let count = 0;
  
  for (const [nq, nr] of neighbors) {
    const friendly = typeof tray !== 'undefined' ? tray.find(p => 
      p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr && p.meta.color === color
    ) : null;
    if (friendly) count++;
  }
  
  return count;
};

window.AIEngine.countAdjacentOpponentPieces = function(pos, oppColor) {
  const neighbors = this.getNeighborCoords(pos.q, pos.r);
  let count = 0;
  
  for (const [nq, nr] of neighbors) {
    const opponent = typeof tray !== 'undefined' ? tray.find(p => 
      p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr && p.meta.color === oppColor
    ) : null;
    if (opponent) count++;
  }
  
  return count;
};

window.AIEngine.countAllAdjacentPieces = function(pos, allPlacedPieces) {
  const neighbors = this.getNeighborCoords(pos.q, pos.r);
  let count = 0;
  
  for (const [nq, nr] of neighbors) {
    const piece = allPlacedPieces.find(p => p.meta.q === nq && p.meta.r === nr);
    if (piece) count++;
  }
  
  return count;
};

/**
 * Evaluate two-for-one blocking opportunities - Expert tactical pattern
 * "Where opponent places two pieces in line, block both with one"
 */
window.AIEngine.evaluateTwoForOneBlocking = function(pos, oppColor, allPlacedPieces) {
  const opponentPieces = allPlacedPieces.filter(p => p.meta.color === oppColor);
  let maxBlockingValue = 0;
  
  // Look for opponent pieces that could be blocked by placing at this position
  for (let i = 0; i < opponentPieces.length - 1; i++) {
    for (let j = i + 1; j < opponentPieces.length; j++) {
      const piece1 = opponentPieces[i];
      const piece2 = opponentPieces[j];
      
      // Check if these two pieces form a line that can be blocked by this position
      const blockingValue = this.calculateTwoForOneValue(pos, piece1, piece2);
      if (blockingValue > 0) {
        maxBlockingValue = Math.max(maxBlockingValue, blockingValue);
      }
    }
  }
  
  return maxBlockingValue;
};

/**
 * Calculate the strategic value of blocking two specific opponent pieces
 */
window.AIEngine.calculateTwoForOneValue = function(blockingPos, piece1, piece2) {
  const { q: bq, r: br } = blockingPos;
  const { q: q1, r: r1 } = piece1.meta;
  const { q: q2, r: r2 } = piece2.meta;
  
  // Check if the blocking position is adjacent to both pieces
  const distToP1 = Math.abs(bq - q1) + Math.abs(br - r1);
  const distToP2 = Math.abs(bq - q2) + Math.abs(br - r2);
  
  // Must be adjacent to both pieces (distance 1)
  if (distToP1 !== 1 || distToP2 !== 1) {
    return 0;
  }
  
  // Check if pieces form a line (are adjacent or near-adjacent)
  const pieceDist = Math.abs(q1 - q2) + Math.abs(r1 - r2);
  
  // High value if pieces are close together (blocking gives outside edge control)
  if (pieceDist <= 2) {
    let value = 1.5; // Base two-for-one value
    
    // Higher value if blocking high-value pieces
    if (piece1.meta.key === 'A' || piece2.meta.key === 'A') {
      value += 0.5; // Blocking ants is very valuable
    }
    if (piece1.meta.key === 'Q' || piece2.meta.key === 'Q') {
      value += 1.0; // Blocking near Queen is extremely valuable
    }
    
    // Bonus if this gives outside edge control
    const edgeControlBonus = this.calculateEdgeControlBonus(blockingPos, [piece1, piece2]);
    value += edgeControlBonus;
    
    return value;
  }
  
  return 0;
};

/**
 * Calculate bonus for gaining outside edge control
 */
window.AIEngine.calculateEdgeControlBonus = function(blockingPos, blockedPieces) {
  // Simple heuristic: blocking pieces that are on the perimeter gives edge control
  // This forces opponent pieces to be "inside" while keeping ours "outside"
  const { q, r } = blockingPos;
  const distance = Math.abs(q) + Math.abs(r);
  
  // Pieces further from center are on the edge
  const blockedOnEdge = blockedPieces.filter(p => {
    const pDist = Math.abs(p.meta.q) + Math.abs(p.meta.r);
    return pDist >= 2; // Consider edge pieces
  }).length;
  
  return blockedOnEdge * 0.3; // Bonus for each edge piece blocked
};

window.AIEngine.countAllAdjacentPieces = function(pos, allPlacedPieces) {
  const neighbors = this.getNeighborCoords(pos.q, pos.r);
  let count = 0;
  
  for (const [nq, nr] of neighbors) {
    const piece = allPlacedPieces.find(p => p.meta.q === nq && p.meta.r === nr);
    if (piece) count++;
  }
  
  return count;
};

window.AIEngine.countEmptyNeighbors = function(pos, allPlacedPieces) {
  // Handle both piece objects (with meta.q/r) and position objects (with q/r)
  const q = pos.q || (pos.meta && pos.meta.q) || 0;
  const r = pos.r || (pos.meta && pos.meta.r) || 0;
  const neighbors = this.getNeighborCoords(q, r);
  let count = 0;
  
  for (const [nq, nr] of neighbors) {
    const occupied = allPlacedPieces.some(p => {
      if (!p) return false;
      if (p.meta && typeof p.meta.q === 'number' && typeof p.meta.r === 'number') {
        return p.meta.q === nq && p.meta.r === nr;
      }
      if (typeof p.q === 'number' && typeof p.r === 'number') {
        return p.q === nq && p.r === nr;
      }
      return false;
    });
    if (!occupied) count++;
  }
  
  return count;
};

window.AIEngine.countPotentialJumps = function(pos, allPlacedPieces) {
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]
  ];
  
  let jumps = 0;
  
  // Handle both piece objects (with meta.q/r) and position objects (with q/r)
  const baseQ = pos.q || (pos.meta && pos.meta.q) || 0;
  const baseR = pos.r || (pos.meta && pos.meta.r) || 0;
  
  for (const [dq, dr] of directions) {
    let checkQ = baseQ + dq;
    let checkR = baseR + dr;
    let foundPiece = false;
    
    // Look for a piece to jump over
    while (Math.abs(checkQ) + Math.abs(checkR) <= 4) {
      const hasPiece = allPlacedPieces.some(p => {
        if (!p) return false;
        if (p.meta && typeof p.meta.q === 'number' && typeof p.meta.r === 'number') {
          return p.meta.q === checkQ && p.meta.r === checkR;
        }
        if (typeof p.q === 'number' && typeof p.r === 'number') {
          return p.q === checkQ && p.r === checkR;
        }
        return false;
      });
      
      if (hasPiece && !foundPiece) {
        foundPiece = true;
      } else if (!hasPiece && foundPiece) {
        jumps++;
        break;
      }
      
      checkQ += dq;
      checkR += dr;
    }
  }
  
  return jumps;
};

/**
 * ✨ ENHANCED PIN DETECTION SYSTEM ✨
 * Detect when pieces are pinned and cannot move without breaking hive connectivity
 */
window.AIEngine.detectPinnedPieces = function(color) {
  try {
    const pinnedPieces = [];
    const myPieces = tray.filter(p => 
      p.meta && p.meta.placed && p.meta.color === color
    );

    for (const piece of myPieces) {
      if (this.isPiecePinned(piece)) {
        pinnedPieces.push(piece);
      }
    }

    return pinnedPieces;
  } catch (error) {
    console.error('🤖 Error detecting pinned pieces:', error);
    return [];
  }
};

/**
 * Check if a specific piece is pinned (cannot move without breaking hive)
 */
window.AIEngine.isPiecePinned = function(piece) {
  try {
    if (!piece || !piece.meta || !piece.meta.placed) return false;

    const currentQ = piece.meta.q;
    const currentR = piece.meta.r;
    
    // Get all possible legal moves for this piece
    const legalMoves = this.getLegalMovesForPiece(piece);
    
    // If piece has no legal moves at all, it's definitely pinned
    if (!legalMoves || legalMoves.length === 0) {
      console.log(`🤖 📌 PINNED: ${piece.meta.key} at ${currentQ},${currentR} has no legal moves`);
      return true;
    }

    // Check if ALL potential moves would break hive connectivity
    let allMovesBreakHive = true;
    for (const move of legalMoves) {
      if (!this.wouldMoveBreakHive(piece, move.q, move.r)) {
        allMovesBreakHive = false;
        break;
      }
    }

    if (allMovesBreakHive) {
      console.log(`🤖 📌 PINNED: ${piece.meta.key} at ${currentQ},${currentR} - all moves break hive`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('🤖 Error checking if piece is pinned:', error);
    return false;
  }
};

/**
 * Get legal moves for a specific piece (simplified version for pin detection)
 */
window.AIEngine.getLegalMovesForPiece = function(piece) {
  try {
    if (!piece || !piece.meta) return [];

    const neighbors = this.getNeighborCoords(piece.meta.q, piece.meta.r);
    const legalMoves = [];

    for (const [q, r] of neighbors) {
      // Check if position is empty
      const occupied = tray.some(p => 
        p.meta && p.meta.placed && p.meta.q === q && p.meta.r === r
      );
      
      if (!occupied) {
        // Check basic movement rules based on piece type
        if (this.canPieceMoveTo(piece, q, r)) {
          legalMoves.push({ q, r });
        }
      }
    }

    return legalMoves;
  } catch (error) {
    console.error('🤖 Error getting legal moves:', error);
    return [];
  }
};

/**
 * Check if moving a piece would break hive connectivity
 */
window.AIEngine.wouldMoveBreakHive = function(piece, toQ, toR) {
  try {
    // Temporarily remove piece from current position
    const originalQ = piece.meta.q;
    const originalR = piece.meta.r;
    piece.meta.q = toQ;
    piece.meta.r = toR;

    // Check if hive remains connected
    const remainsConnected = this.isHiveConnected();

    // Restore original position
    piece.meta.q = originalQ;
    piece.meta.r = originalR;

    return !remainsConnected;
  } catch (error) {
    console.error('🤖 Error checking hive connectivity:', error);
    return true; // Assume it breaks to be safe
  }
};

/**
 * Check if the hive remains connected
 */
window.AIEngine.isHiveConnected = function() {
  try {
    const placedPieces = tray.filter(p => 
      p.meta && p.meta.placed && typeof p.meta.q === 'number' && typeof p.meta.r === 'number'
    );

    if (placedPieces.length <= 1) return true;

    // Use BFS to check connectivity
    const visited = new Set();
    const queue = [placedPieces[0]];
    visited.add(`${placedPieces[0].meta.q},${placedPieces[0].meta.r}`);

    while (queue.length > 0) {
      const current = queue.shift();
      const neighbors = this.getNeighborCoords(current.meta.q, current.meta.r);

      for (const [nq, nr] of neighbors) {
        const key = `${nq},${nr}`;
        if (!visited.has(key)) {
          const neighbor = placedPieces.find(p => p.meta.q === nq && p.meta.r === nr);
          if (neighbor) {
            visited.add(key);
            queue.push(neighbor);
          }
        }
      }
    }

    return visited.size === placedPieces.length;
  } catch (error) {
    console.error('🤖 Error checking hive connectivity:', error);
    return false;
  }
};

/**
 * Evaluate pin situation and suggest counter-moves
 */
window.AIEngine.evaluatePinSituation = function(color) {
  try {
    const pinnedPieces = this.detectPinnedPieces(color);
    
    if (pinnedPieces.length === 0) {
      return { severity: 0, counterMoves: [] };
    }

    let severity = 0;
    const counterMoves = [];

    for (const pinnedPiece of pinnedPieces) {
      // Calculate pin severity based on piece importance
      if (pinnedPiece.meta.key === 'Q') {
        severity += 10; // Queen pinned is extremely dangerous
      } else if (pinnedPiece.meta.key === 'A') {
        severity += 3; // Ant pinned is problematic
      } else {
        severity += 1; // Other pieces
      }

      // Find moves that could unpin this piece
      const unpinMoves = this.findUnpinMoves(pinnedPiece, color);
      counterMoves.push(...unpinMoves);
    }

    console.log(`🤖 📌 PIN ANALYSIS: ${pinnedPieces.length} pieces pinned, severity: ${severity}`);
    
    return { severity, counterMoves, pinnedPieces };
  } catch (error) {
    console.error('🤖 Error evaluating pin situation:', error);
    return { severity: 0, counterMoves: [] };
  }
};

/**
 * Find moves that could unpin a specific piece
 */
window.AIEngine.findUnpinMoves = function(pinnedPiece, color) {
  try {
    const unpinMoves = [];
    const myPieces = tray.filter(p => 
      p.meta && p.meta.placed && p.meta.color === color && p !== pinnedPiece
    );

    // Check if moving other pieces could create connectivity that unpins this piece
    for (const otherPiece of myPieces) {
      const legalMoves = this.getLegalMovesForPiece(otherPiece);
      
      for (const move of legalMoves) {
        // Temporarily make the move
        const originalQ = otherPiece.meta.q;
        const originalR = otherPiece.meta.r;
        otherPiece.meta.q = move.q;
        otherPiece.meta.r = move.r;

        // Check if this unpins the target piece
        if (!this.isPiecePinned(pinnedPiece)) {
          unpinMoves.push({
            type: 'move',
            piece: otherPiece,
            fromQ: originalQ,
            fromR: originalR,
            q: move.q,
            r: move.r,
            priority: 'escape-pin',
            strategicValue: 5.0
          });
        }

        // Restore original position
        otherPiece.meta.q = originalQ;
        otherPiece.meta.r = originalR;
      }
    }

    return unpinMoves;
  } catch (error) {
    console.error('🤖 Error finding unpin moves:', error);
    return [];
  }
};

/**
 * Find what pieces are currently pinned by a specific piece
 */
window.AIEngine.getPiecesPinnedBy = function(pinningPiece) {
  try {
    const allPieces = window.tray.filter(p => p.meta.placed && 
      !(p.meta.q === pinningPiece.meta.q && p.meta.r === pinningPiece.meta.r));
    
    const pinned = [];
    
    for (const piece of allPieces) {
      // Temporarily remove the pinning piece and see if this piece becomes unpinned
      const originalQ = pinningPiece.meta.q;
      const originalR = pinningPiece.meta.r;
      
      // Simulate removing the pinning piece
      pinningPiece.meta.placed = false;
      
      const isPinned = this.isPiecePinned(piece);
      
      // Restore the pinning piece
      pinningPiece.meta.placed = true;
      pinningPiece.meta.q = originalQ;
      pinningPiece.meta.r = originalR;
      
      // If the piece was pinned when pinning piece was present, 
      // but not pinned when it was removed, then pinning piece is pinning it
      const wasPinned = this.isPiecePinned(piece);
      
      if (wasPinned && !isPinned) {
        pinned.push(piece);
      }
    }
    
    return pinned;
  } catch (error) {
    console.error('🤖 Error finding pieces pinned by piece:', error);
    return [];
  }
};

/**
 * Check if a move helps unpin pieces (even if not explicitly designed to)
 */
window.AIEngine.doesMoveHelpUnpinPieces = function(move, pinnedPieces) {
  try {
    if (!move || !pinnedPieces || pinnedPieces.length === 0) return false;

    // Simulate the move temporarily
    const piece = move.piece;
    const originalQ = piece.meta.q;
    const originalR = piece.meta.r;

    if (move.type === 'move') {
      piece.meta.q = move.q;
      piece.meta.r = move.r;
    }

    // Check if any pinned pieces are now unpinned
    let helpsUnpin = false;
    for (const pinnedPiece of pinnedPieces) {
      if (!this.isPiecePinned(pinnedPiece)) {
        helpsUnpin = true;
        break;
      }
    }

    // Restore original position
    if (move.type === 'move') {
      piece.meta.q = originalQ;
      piece.meta.r = originalR;
    }

    return helpsUnpin;
  } catch (error) {
    console.error('🤖 Error checking if move helps unpin:', error);
    return false;
  }
};

/**
 * Get strategic bonus for move prioritization - SIMPLIFIED AND STABLE VERSION
 */
window.AIEngine.getStrategicMoveBonus = function(move) {
  try {
    if (!move || !move.piece || !move.piece.meta) {
      return 0;
    }

    let bonus = 0;
    const pieceKey = move.piece.meta.key;
    const color = move.piece.meta.color || this.color;
    
    // Basic piece value bonuses
    const pieceValues = {
      'Q': 0.3,  // Queen moves are important
      'A': 0.2,  // Ants are versatile
      'B': 0.25, // Beetles can climb
      'G': 0.15, // Grasshoppers can jump
      'S': 0.1   // Spiders have limited moves
    };
    
    bonus += pieceValues[pieceKey] || 0;
    
    // Priority-based bonuses
    if (move.priority) {
      const priorityValues = {
        'winning-move': 10.0,
        'queen-kill': 8.0,
        'threaten-queen': 5.0,
        'defend-queen': 4.5,
        'surround-queen': 4.0,
        'escape-queen': 3.5,
        'queen-placement': 3.0,
        'forced-queen': 2.8,
        'queen-safe': 2.5,
        'opening-excellent': 2.0,
        'opening-good': 1.5,
        'opening-first': 1.8,
        'high-value': 1.2,
        'medium-value': 0.6,
        'normal': 0.0
      };
      
      bonus += priorityValues[move.priority] || 0;
    }
    
    // Strategic value from move analysis
    if (move.strategicValue) {
      bonus += move.strategicValue;
    }
    
    // Center control bonus (simple version)
    if (move.q !== undefined && move.r !== undefined) {
      const centerDistance = Math.abs(move.q) + Math.abs(move.r);
      if (centerDistance <= 2) {
        bonus += 0.1; // Small bonus for central positions
      }
    }
    
    // Queen threat bonus for beetles
    if (pieceKey === 'B' && typeof tray !== 'undefined' && tray) {
      try {
        const oppColor = color === 'white' ? 'black' : 'white';
        const oppQueen = tray.find(p => p && p.meta && p.meta.key === 'Q' && p.meta.color === oppColor && p.meta.placed);
        
        if (oppQueen && move.q !== undefined && move.r !== undefined) {
          const distance = Math.abs(move.q - oppQueen.meta.q) + Math.abs(move.r - oppQueen.meta.r);
          if (distance <= 1) {
            bonus += 0.5; // Beetle threatening queen
          }
        }
      } catch (error) {
        debugLog('🤖 Error in queen threat analysis:', error.message);
      }
    }
    
    return Math.max(0, Math.min(10.0, bonus));
    
  } catch (error) {
    debugLog('🤖 Error calculating strategic bonus:', error.message);
    return 0;
  }
};

/**
 * Enhanced move selection for better strategic play
 */
window.AIEngine.selectStrategicMove = function(moves) {
  if (!moves || moves.length === 0) return null;
  
  // Sort moves by strategic value and priority
  const scoredMoves = moves.map(move => ({
    move,
    score: this.calculateMoveScore(move)
  }));
  
  scoredMoves.sort((a, b) => b.score - a.score);
  
  // Use weighted random selection from top 3 moves for variety
  const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
  const totalWeight = topMoves.reduce((sum, sm) => sum + Math.exp(sm.score * 2), 0);
  
  let random = Math.random() * totalWeight;
  
  for (const scoredMove of topMoves) {
    random -= Math.exp(scoredMove.score * 2);
    if (random <= 0) {
      debugLog(`🤖 Selected strategic move with score ${scoredMove.score.toFixed(3)}:`, scoredMove.move);
      return scoredMove.move;
    }
  }
  
  return topMoves[0].move;
};

/**
 * Calculate comprehensive move score
 */
window.AIEngine.calculateMoveScore = function(move) {
  let score = 0;
  
  // Base priority score
  score += this.getStrategicMoveBonus(move);
  
  // Strategic value if available
  if (move.strategicValue) {
    score += move.strategicValue;
  }
  
  // CRITICAL: Massive penalty for moves that help surround own Queen
  const gameState = window.gameState || this.getCurrentGameState();
  if (gameState && this.wouldHelpSurroundOwnQueen(gameState, move, this.color)) {
    score -= 100.0; // NEVER surround own Queen!
  }
  
  // Piece-specific bonuses
  if (move.piece && move.piece.meta) {
    switch (move.piece.meta.key) {
      case 'Q':
        score += 0.2; // Queen moves are generally important
        break;
      case 'A':
        score += 0.15; // Ants are mobile and versatile
        break;
      case 'B':
        score += 0.1; // Beetles are useful
        break;
    }
  }
  
  return score;
};

/**
 * Get neighbor coordinates for a hex position
 */
window.AIEngine.getNeighborCoords = function(q, r) {
  return [
    [q + 1, r],     // East
    [q + 1, r - 1], // Northeast
    [q, r - 1],     // Northwest
    [q - 1, r],     // West
    [q - 1, r + 1], // Southwest
    [q, r + 1]      // Southeast
  ];
};

/**
 * Generate moves using live game state functions
 */
window.AIEngine.generateLiveGameMoves = function(currentColor) {
  const moves = [];
  
  console.log(`🤖 Using live game functions for ${currentColor}`);
  
  // Debug: Check if tray exists (it's a global variable from pieces.js)
  console.log(`🤖 tray exists:`, typeof tray !== 'undefined');
  console.log(`🤖 tray length:`, typeof tray !== 'undefined' ? tray.length : 'N/A');
  
  // Get available pieces from actual tray (pieces have .meta property structure)
  const availablePieces = typeof tray !== 'undefined' ? tray.filter(p => 
    p.meta && p.meta.color === currentColor && !p.meta.placed
  ) : [];
  
  // Get placed pieces from actual tray
  const placedPieces = typeof tray !== 'undefined' ? tray.filter(p => 
    p.meta && p.meta.color === currentColor && p.meta.placed
  ) : [];
  
  // Get all placed pieces (both colors)
  const allPlacedPieces = typeof tray !== 'undefined' ? tray.filter(p => 
    p.meta && p.meta.placed
  ) : [];
  
  console.log(`🤖 Available pieces: ${availablePieces.length}, Placed pieces: ${placedPieces.length}, Total placed: ${allPlacedPieces.length}`);
  console.log(`🤖 Available pieces details:`, availablePieces.map(p => `${p.meta.color} ${p.meta.key}`));
  console.log(`🤖 All placed pieces:`, allPlacedPieces.map(p => `${p.meta.color} ${p.meta.key} at (${p.meta.q},${p.meta.r})`));
  
  // Debug current state
  console.log(`🤖 window.state: ${window.state ? JSON.stringify(window.state) : 'N/A'}`);
  console.log(`🤖 Current player from state: ${window.state ? window.state.current : 'N/A'}`);

  try {
    console.log(`🤖 🔍 Starting generateLiveGameMoves try block`);
    
    // Check if AI must place Queen (Hive rule: Queen must be placed by turn 4)
    console.log(`🤖 📊 About to calculate aiTurnNumber...`);
    console.log(`🤖 📊 gameState.moveNumber:`, gameState.moveNumber);
    
    const moveNum = gameState.moveNumber || 0;
    console.log(`🤖 📊 moveNum:`, moveNum);
    
    const aiTurnNumber = Math.ceil(moveNum / 2);
    console.log(`🤖 📊 aiTurnNumber calculated: ${aiTurnNumber}`);
    
    console.log(`🤖 📊 About to check placed pieces for Queen...`);
    console.log(`🤖 📊 placedPieces:`, placedPieces);
    
    let hasQueen = false;
    try {
      hasQueen = placedPieces.some(p => {
        console.log(`🤖 📊 Checking piece:`, p);
        return p.meta && p.meta.key === 'Q';
      });
    } catch (queenError) {
      console.error(`🤖 Error checking for Queen:`, queenError);
      hasQueen = false;
    }
    
    console.log(`🤖 📊 hasQueen result: ${hasQueen}`);
    const mustPlaceQueen = aiTurnNumber >= 4 && !hasQueen;
    
    console.log(`🤖 AI turn number: ${aiTurnNumber}, Must place Queen: ${mustPlaceQueen}`);
    console.log(`🤖 gameState.moveNumber: ${gameState.moveNumber}`);
    console.log(`🤖 Queen already placed: ${placedPieces.some(p => p.meta.key === 'Q')}`);
    
    // Special handling for early game (first few pieces)
    if (allPlacedPieces.length <= 2) {
      console.log(`🤖 Early game detected (${allPlacedPieces.length} pieces placed)`);
      
      if (allPlacedPieces.length === 0) {
        // First move - can place anywhere (usually 0,0)
        console.log(`🤖 First move - adding moves at (0,0)`);
        
        if (mustPlaceQueen) {
          // Force Queen placement
          console.log(`🤖 Forcing Queen placement on first move`);
          const queen = availablePieces.find(p => p.meta.key === 'Q');
          if (queen) {
            moves.push({
              type: 'place',
              piece: queen,
              q: 0,
              r: 0
            });
          } else {
            console.error(`🤖 No Queen found in available pieces!`);
          }
        } else {
          console.log(`🤖 Normal first move - can place any piece`);
          for (const piece of availablePieces) {
            moves.push({
              type: 'place',
              piece: piece,
              q: 0,
              r: 0
            });
          }
        }
    } else if (allPlacedPieces.length === 1) {
      // Second move - can place adjacent to the first piece
      const firstPiece = allPlacedPieces[0];
      console.log(`🤖 Second move - first piece is ${firstPiece.meta.color} ${firstPiece.meta.key} at (${firstPiece.meta.q},${firstPiece.meta.r})`);
      const neighbors = this.getNeighborCoords(firstPiece.meta.q, firstPiece.meta.r);
      console.log(`🤖 Neighbor coordinates:`, neighbors);
      
      if (mustPlaceQueen) {
        // Force Queen placement
        console.log(`🤖 Forcing Queen placement on second move`);
        const queen = availablePieces.find(p => p.meta.key === 'Q');
        if (queen) {
          for (const [nq, nr] of neighbors) {
            console.log(`🤖 Adding QUEEN move: ${queen.meta.color} ${queen.meta.key} to (${nq},${nr})`);
            moves.push({
              type: 'place',
              piece: queen,
              q: nq,
              r: nr
            });
          }
        } else {
          console.error(`🤖 No Queen found in available pieces for second move!`);
        }
      } else {
        console.log(`🤖 Normal second move - can place any piece`);
        for (const [nq, nr] of neighbors) {
          console.log(`🤖 Checking neighbor (${nq},${nr})`);
          for (const piece of availablePieces) {
            console.log(`🤖 Adding move: ${piece.meta.color} ${piece.meta.key} to (${nq},${nr})`);
            moves.push({
              type: 'place',
              piece: piece,
              q: nq,
              r: nr
            });
          }
        }
      }
      console.log(`🤖 Total moves generated for second turn: ${moves.length}`);
    } else {
      // Third move onwards - use normal placement rules but be more permissive
      try {
        if (typeof legalPlacementZones === 'function') {
        const placementZones = legalPlacementZones(currentColor);
        console.log(`🤖 Legal placement zones (early game):`, placementZones);
        
        if (mustPlaceQueen) {
          // Force Queen placement
          const queen = availablePieces.find(p => p.meta.key === 'Q');
          if (queen) {
            for (const destKey of placementZones) {
              const [q, r] = destKey.split(',').map(Number);
              moves.push({
                type: 'place',
                piece: queen,
                q: q,
                r: r
              });
            }
          }
        } else {
          for (const destKey of placementZones) {
            const [q, r] = destKey.split(',').map(Number);
            
            for (const piece of availablePieces) {
              moves.push({
                type: 'place',
                piece: piece,
                q: q,
                r: r
              });
            }
          }
        }          // If no legal zones found in early game, manually add adjacent spots
          if (placementZones.size === 0) {
            console.log('🤖 No legal zones from function, manually finding adjacent spots');
            const adjacentSpots = new Set();
            
            for (const piece of allPlacedPieces) {
              const neighbors = this.getNeighborCoords(piece.meta.q, piece.meta.r);
              for (const [nq, nr] of neighbors) {
                const key = `${nq},${nr}`;
                const occupied = allPlacedPieces.some(p => p.meta.q === nq && p.meta.r === nr);
                if (!occupied) {
                  adjacentSpots.add(key);
                }
              }
            }
            
            for (const destKey of adjacentSpots) {
              const [q, r] = destKey.split(',').map(Number);
              if (mustPlaceQueen) {
                // Force Queen placement
                const queen = availablePieces.find(p => p.meta.key === 'Q');
                if (queen) {
                  moves.push({
                    type: 'place',
                    piece: queen,
                    q: q,
                    r: r
                  });
                }
              } else {
                for (const piece of availablePieces) {
                  moves.push({
                    type: 'place',
                    piece: piece,
                    q: q,
                    r: r
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('🤖 Error in early game placement generation:', error);
      }
    }
  } else {
    // Normal game - use standard placement rules
    try {
      if (typeof legalPlacementZones === 'function') {
        const placementZones = legalPlacementZones(currentColor);
        console.log(`🤖 Legal placement zones:`, placementZones);
        
        if (mustPlaceQueen) {
          // Force Queen placement
          console.log(`🤖 🚨 MUST PLACE QUEEN - Turn ${aiTurnNumber}`);
          const queen = availablePieces.find(p => p.meta.key === 'Q');
          if (queen) {
            for (const destKey of placementZones) {
              const [q, r] = destKey.split(',').map(Number);
              moves.push({
                type: 'place',
                piece: queen,
                q: q,
                r: r
              });
            }
          } else {
            console.error(`🤖 No Queen available to place!`);
          }
        } else {
          for (const destKey of placementZones) {
            const [q, r] = destKey.split(',').map(Number);
            
            for (const piece of availablePieces) {
              moves.push({
                type: 'place',
                piece: piece,
                q: q,
                r: r
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('🤖 Error in placement move generation:', error);
    }
  }
  
  // TEMPORARILY DISABLE movement generation to focus on placement moves
  // Generate movement moves using live game function
  // try {
  //   if (typeof legalMoveZones === 'function') {
  //     for (const piece of placedPieces) {
  //       try {
  //         const moveZones = legalMoveZones(piece);
  //         const zones = Array.isArray(moveZones) ? moveZones : Array.from(moveZones || []);
  //         
  //         for (const destKey of zones) {
  //           const [q, r] = destKey.split(',').map(Number);
  //           moves.push({
  //             type: 'move',
  //             piece: piece,
  //             q: q,
  //             r: r
  //           });
  //         }
  //       } catch (pieceError) {
  //         console.warn('🤖 Error generating moves for piece:', piece, pieceError);
  //       }
  //     }
  //   }
  // } catch (error) {
  //   console.error('🤖 Error in movement move generation:', error);
  // }
  
  console.log(`🤖 Generated ${moves.length} total moves`);
  console.log(`🤖 Moves details:`, moves.map(m => `${m.type} ${m.piece ? `${m.piece.color} ${m.piece.key}` : 'unknown'} to (${m.q},${m.r})`));
  console.log(`🤖 Returning moves array:`, moves);
  return moves;
  
  } catch (error) {
    console.error('🤖 Error in generateLiveGameMoves:', error);
    console.error('🤖 Stack trace:', error.stack);
    return []; // Return empty array if there's an error
  }
};

/**
 * Generate moves for simulation (simplified)
 */
window.AIEngine.generateSimulationMoves = function(gameState, currentColor) {
  const moves = [];
  
  // Get available pieces for placement
  const availablePieces = gameState.tray.filter(p => 
    p.color === currentColor && !p.placed
  );
  
  // Get placed pieces for movement
  const placedPieces = gameState.tray.filter(p => 
    p.color === currentColor && p.placed
  );
  
  // Simple placement generation - just adjacent to existing pieces
  if (availablePieces.length > 0) {
    const placedPieces = gameState.tray.filter(p => p.placed);
    const adjacentSpots = new Set();
    
    for (const piece of placedPieces) {
      const neighbors = this.getNeighborCoords(piece.q || piece.meta?.q || 0, piece.r || piece.meta?.r || 0);
      for (const [nq, nr] of neighbors) {
        const key = `${nq},${nr}`;
        const occupied = gameState.tray.some(p => p.placed && 
          (p.q === nq || p.meta?.q === nq) && (p.r === nr || p.meta?.r === nr));
        if (!occupied) {
          adjacentSpots.add(key);
        }
      }
    }
    
    // If no pieces placed yet, allow placement at origin
    if (placedPieces.length === 0) {
      adjacentSpots.add('0,0');
    }
    
    for (const destKey of adjacentSpots) {
      const [q, r] = destKey.split(',').map(Number);
      for (const piece of availablePieces.slice(0, 3)) { // Limit for simulation
        moves.push({
          type: 'place',
          piece: piece,
          q: q,
          r: r
        });
      }
    }
  }
  
  // Simple movement generation - adjacent empty spots
  for (const piece of placedPieces.slice(0, 3)) { // Limit for simulation
    const pieceQ = piece.q || piece.meta?.q || 0;
    const pieceR = piece.r || piece.meta?.r || 0;
    const neighbors = this.getNeighborCoords(pieceQ, pieceR);
    
    for (const [nq, nr] of neighbors) {
      const occupied = gameState.tray.some(p => p.placed && 
        (p.q === nq || p.meta?.q === nq) && (p.r === nr || p.meta?.r === nr));
      if (!occupied) {
        moves.push({
          type: 'move',
          piece: piece,
          q: nq,
          r: nr
        });
      }
    }
  }
  
  return moves;
};

/**
 * Apply move to create new game state
 */
window.AIEngine.applyMoveToState = function(gameState, move) {
  const newState = JSON.parse(JSON.stringify(gameState));
  
  // Mark this as a simulation state
  newState.isSimulation = true;
  
  if (move.type === 'place') {
    // Find and place the piece
    const piece = newState.tray.find(p => 
      p.color === move.piece.color && 
      p.key === move.piece.key && 
      p.meta && p.meta.i === move.piece.meta.i
    );
    if (piece) {
      piece.placed = true;
      piece.q = move.q;
      piece.r = move.r;
      if (piece.meta) {
        piece.meta.q = move.q;
        piece.meta.r = move.r;
      }
    }
  } else if (move.type === 'move') {
    // Find and move the piece
    const piece = newState.tray.find(p => 
      p.color === move.piece.color && 
      p.key === move.piece.key && 
      p.q === move.piece.q && 
      p.r === move.piece.r
    );
    if (piece) {
      piece.q = move.q;
      piece.r = move.r;
      if (piece.meta) {
        piece.meta.q = move.q;
        piece.meta.r = move.r;
      }
    }
  }
  
  // Switch turns
  newState.currentPlayer = newState.currentPlayer === 'white' ? 'black' : 'white';
  newState.moveNumber = (newState.moveNumber || 0) + 1;
  
  return newState;
};

/**
 * Dynamic piece values based on Hive strategy book insights and expert analysis
 */
window.AIEngine.getDynamicPieceValues = function(gameState) {
  const turnNumber = gameState.turnNumber || 0;
  const totalPieces = this.getTotalPiecesOnBoard(gameState);
  
  // From the book: piece values and strategic roles
  // Queen: 50 (reference value - most important)
  // Beetle: 20 (slow but can reach unreachable places, perfect pinning)
  // Grasshopper: 20 (can ignore sliding rules, fill inaccessible hexes)
  // Ant: 30 (excellent for pinning, very versatile)
  // Spider: 10 (constrained movement, hardest to use effectively)
  
  if (turnNumber <= 6) {
    // Early game strategy from book:
    // - Spider opening is aggressive (sacrifice piece for tempo)
    // - Beetle/Grasshopper defensive openings 
    // - Ant should NEVER be used as opening (wastes mobility)
    return {
      'Q': 50,   // Queen: Centerpiece of game (book value)
      'B': 22,   // Beetle: Good defensive opening + slow movement preparation
      'G': 22,   // Grasshopper: Good defensive opening + strategic placement  
      'A': 25,   // Ant: Reduced early value (book: "should never be used as opening")
      'S': 12    // Spider: Slightly higher than book due to aggressive opening potential
    };
  } else if (totalPieces < 10) {
    // Endgame: Mobility and special abilities become critical
    // Book: "Beetle on opponent Queen devastating" + "Grasshopper opportunistic"
    return {
      'Q': 50,   // Queen: Always most valuable
      'B': 35,   // Beetle: MASSIVE endgame value (can climb on Queen)
      'G': 30,   // Grasshopper: Excellent for filling gaps in endgame
      'A': 32,   // Ant: High mobility crucial in endgame
      'S': 15    // Spider: Limited by movement constraints in sparse positions
    };
  } else {
    // Mid game: Balance based on book's strategic analysis
    // Focus on pinning, blocking, and tempo stealing
    return {
      'Q': 50,   // Queen: Always central (book reference value)
      'A': 30,   // Ant: Book value - "excellent for pinning, very versatile"
      'B': 20,   // Beetle: Book value - "perfect pinning ability"
      'G': 20,   // Grasshopper: Book value - "same value as Beetle"
      'S': 10    // Spider: Book value - "weakest piece, hardest to use"
    };
  }
};

/**
 * Helper function to count total pieces on board - robust version
 */
window.AIEngine.getTotalPiecesOnBoard = function(gameState) {
  try {
    if (!gameState) return 0;
    
    // Handle tray-based game state
    if (gameState.tray && Array.isArray(gameState.tray)) {
      return gameState.tray.filter(p => p && p.placed).length;
    }
    
    // Handle cells-based game state
    if (gameState.cells) {
      let count = 0;
      if (typeof gameState.cells.forEach === 'function') {
        gameState.cells.forEach(cell => {
          if (cell && cell.stack && cell.stack.length > 0) {
            count += cell.stack.length;
          }
        });
      } else if (typeof gameState.cells === 'object') {
        // Handle Map or object-based cells
        for (const key in gameState.cells) {
          const cell = gameState.cells[key];
          if (cell && cell.stack && cell.stack.length > 0) {
            count += cell.stack.length;
          }
        }
      }
      return count;
    }
    
    return 0;
  } catch (error) {
    console.error(`🤖 💥 ERROR in getTotalPiecesOnBoard:`, error);
    return 0;
  }
};

/**
 * Enhanced position evaluation using advanced Hive-specific heuristics
 */
window.AIEngine.evaluatePosition = function(gameState) {
  // Evaluation logging completely disabled to avoid spam
  const shouldLog = false; // DISABLED - no evaluation logs during search
  
  // Check for immediate win/loss conditions
  const whiteQueenSurrounded = this.isQueenSurrounded(gameState, 'white');
  const blackQueenSurrounded = this.isQueenSurrounded(gameState, 'black');
  
  if (whiteQueenSurrounded && blackQueenSurrounded) return 0.5; // Draw
  if (this.color === 'white' && blackQueenSurrounded) return 1.0; // AI wins
  if (this.color === 'black' && whiteQueenSurrounded) return 1.0; // AI wins
  if (this.color === 'white' && whiteQueenSurrounded) return 0.0; // AI loses
  if (this.color === 'black' && blackQueenSurrounded) return 0.0; // AI loses
  
  // Heuristic evaluation for ongoing positions
  let score = 0.5; // Neutral baseline
  const oppColor = this.color === 'white' ? 'black' : 'white';
  
  // Get difficulty for evaluation weights - MUCH MORE STRATEGIC
  const difficulty = window.AIEngine.difficulty;
  let evaluationDepth = 1.0;
  let strategicMultiplier = 1.0;
  
  if (difficulty === 'medium') {
    evaluationDepth = 2.0;
    strategicMultiplier = 1.5;
  } else if (difficulty === 'hard') {
    evaluationDepth = 3.0;  // Much deeper analysis
    strategicMultiplier = 2.5; // Much more strategic focus
  }
  
  // 1. Queen safety evaluation (MASSIVELY INCREASED - 70% weight for hard difficulty)
  const aiQueenThreats = this.countQueenThreats(gameState, this.color);
  const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
  const queenDangerDiff = this.evaluateQueenDanger(gameState, this.color, oppColor);
  
  if (shouldLog) {
    console.log(`🤖 � STRATEGIC: AI Queen threats: ${aiQueenThreats}, Opponent: ${oppQueenThreats}`);
  }
  
  // EXPONENTIALLY INCREASED penalties/bonuses for Queen safety
  let queenScore = 0;
  
  // Defensive Queen safety (protect our Queen) - MUCH MORE AGGRESSIVE
  if (aiQueenThreats >= 5) {
    queenScore -= 1.5 * strategicMultiplier; // CRITICAL: Queen almost surrounded
  } else if (aiQueenThreats >= 4) {
    queenScore -= 0.8 * strategicMultiplier; // DANGEROUS: Queen needs immediate protection
  } else if (aiQueenThreats >= 3) {
    queenScore -= 0.4 * strategicMultiplier; // ALERT: Be very careful
  } else if (aiQueenThreats >= 2) {
    queenScore -= 0.1 * strategicMultiplier; // CAUTION: Monitor situation
  }
  
  // Offensive Queen targeting (attack opponent Queen) - MUCH MORE AGGRESSIVE
  if (oppQueenThreats >= 5) {
    queenScore += 2.0 * strategicMultiplier; // WINNING: Opponent Queen almost surrounded!
  } else if (oppQueenThreats >= 4) {
    queenScore += 1.2 * strategicMultiplier; // EXCELLENT: Very close to winning
  } else if (oppQueenThreats >= 3) {
    queenScore += 0.7 * strategicMultiplier; // GOOD: Strong pressure
  } else if (oppQueenThreats >= 2) {
    queenScore += 0.3 * strategicMultiplier; // DECENT: Building attack
  } else if (oppQueenThreats >= 1) {
    queenScore += 0.1 * strategicMultiplier; // PROGRESS: Starting pressure
  }
  
  score += queenScore + queenDangerDiff * 0.5 * evaluationDepth;
  
  // 2. Material value and piece positioning (INCREASED to 35% weight for strategic play)
  const materialDiff = this.evaluateMaterial(gameState, this.color, oppColor);
  score += materialDiff * (0.35 * strategicMultiplier);
  
  // 2.5. PIECE COORDINATION AND ACTIVITY - Advanced Hive concept
  try {
    const coordinationDiff = this.evaluatePieceCoordination(gameState, this.color, oppColor);
    score += coordinationDiff * (0.25 * strategicMultiplier * evaluationDepth);
    
    // Board center control - pieces near center have more influence
    const centralControlDiff = this.evaluateCentralControl(gameState, this.color, oppColor);
    score += centralControlDiff * (0.15 * strategicMultiplier);
    
    // Piece network connectivity - pieces should support each other
    const networkStrength = this.evaluatePieceNetwork(gameState, this.color, oppColor);
    score += networkStrength * (0.2 * strategicMultiplier);
  } catch (error) {
    console.error(`🤖 💥 ERROR in piece coordination evaluation:`, error);
  }
  
  // 3. Control and mobility (INCREASED to 30% weight - positional understanding)
  try {
    const controlDiff = this.evaluateControl(gameState, this.color, oppColor);
    score += controlDiff * (0.3 * strategicMultiplier * evaluationDepth);
  } catch (error) {
    console.error(`🤖 💥 CRITICAL ERROR in evaluateControl:`, error);
    throw error;
  }
  
  // 4. Tactical patterns and threats (INCREASED to 25% weight - pattern recognition)
  try {
    const tacticalDiff = this.evaluateTacticalPatterns(gameState, this.color, oppColor);
    score += tacticalDiff * (0.25 * strategicMultiplier * evaluationDepth);
    
    // TACTICAL LOOKAHEAD for hard difficulty - analyze forced sequences
    if (difficulty === 'hard') {
      const tacticalLookahead = this.evaluateTacticalLookahead(gameState, this.color, oppColor);
      score += tacticalLookahead * (0.15 * strategicMultiplier);
    }
  } catch (error) {
    console.error(`🤖 💥 CRITICAL ERROR in evaluateTacticalPatterns:`, error);
    throw error;
  }

  // 4.5. TEMPO EVALUATION - "Stealing Turns" Strategy from Hive Theory
  try {
    const tempoDiff = this.evaluateTempo(gameState, this.color, oppColor);
    score += tempoDiff * (0.2 * strategicMultiplier * evaluationDepth);
  } catch (error) {
    console.error(`🤖 💥 ERROR in tempo evaluation:`, error);
  }

  // 4.6. CIRCLING DEFENSE - Strategic defensive positioning from Hive theory
  try {
    const circlingDiff = this.evaluateCirclingDefense(gameState, this.color, oppColor);
    score += circlingDiff * (0.18 * strategicMultiplier * evaluationDepth);
  } catch (error) {
    debugLog(`🤖 💥 ERROR in circling defense evaluation:`, error);
  }
  
  // 5. Endgame factors (ENHANCED to 15% weight)
  try {
    const endgameDiff = this.evaluateEndgame(gameState, this.color, oppColor);
    score += endgameDiff * 0.15;
    
    // SPECIALIZED ENDGAME ANALYSIS for hard difficulty
    if (difficulty === 'hard') {
      const endgameSpecialist = this.evaluateAdvancedEndgame(gameState, this.color, oppColor);
      score += endgameSpecialist * (0.1 * strategicMultiplier);
    }
  } catch (error) {
    console.error(`🤖 💥 CRITICAL ERROR in evaluateEndgame:`, error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
  
  // 6. TEMPO AND INITIATIVE EVALUATION - Expert strategic concept
  try {
    const tempoAdvantage = this.evaluateTempoAndInitiative(gameState, this.color, oppColor);
    score += tempoAdvantage * (0.15 * strategicMultiplier); // 15% weight for tempo
  } catch (error) {
    console.error(`🤖 💥 CRITICAL ERROR in evaluateTempoAndInitiative:`, error);
    throw error;
  }
  
  // Medium+ difficulty adds advanced pattern recognition
  if (difficulty !== 'easy') {
    const advancedPatterns = this.evaluateAdvancedPatterns(gameState, this.color, oppColor);
    score += advancedPatterns * 0.08;
  }
  
  return Math.max(0, Math.min(1, score));
};

/**
 * Check if a queen is surrounded (game over condition)
 */
window.AIEngine.isQueenSurrounded = function(gameState, color) {
  const queen = gameState.tray.find(p => 
    p.color === color && p.key === 'Q' && p.placed
  );
  if (!queen) return false;
  
  const neighbors = this.getNeighborCoords(queen.q, queen.r);
  let surroundedCount = 0;
  
  for (const [nq, nr] of neighbors) {
    const occupied = gameState.tray.some(p => 
      p.placed && p.q === nq && p.r === nr
    );
    if (occupied) surroundedCount++;
  }
  
  return surroundedCount >= 6;
};

/**
 * Count threats around a queen (adjacent pieces)
 */
window.AIEngine.countQueenThreats = function(gameState, color) {
  const queen = gameState.tray.find(p => 
    p.color === color && p.key === 'Q' && p.placed
  );
  if (!queen) return 0;
  
  const neighbors = this.getNeighborCoords(queen.q, queen.r);
  let threatCount = 0;
  
  for (const [nq, nr] of neighbors) {
    const occupied = gameState.tray.some(p => 
      p.placed && p.q === nq && p.r === nr
    );
    if (occupied) threatCount++;
  }
  
  return threatCount;
};

/**
 * CRITICAL: Check if a move would help surround our own Queen (NEVER DO THIS!)
 */
window.AIEngine.wouldHelpSurroundOwnQueen = function(gameState, move, aiColor) {
  if (move.type !== 'place') return false;
  
  const aiQueen = gameState.tray.find(p => 
    p.color === aiColor && p.key === 'Q' && p.placed
  );
  if (!aiQueen) return false; // No Queen placed yet
  
  // Check if the move position is adjacent to our Queen
  const neighbors = this.getNeighborCoords(aiQueen.q, aiQueen.r);
  const isAdjacentToOwnQueen = neighbors.some(([nq, nr]) => 
    nq === move.q && nr === move.r
  );
  
  if (isAdjacentToOwnQueen) {
    // Count how many spaces around our Queen would be occupied after this move
    let threatsAfterMove = 0;
    for (const [nq, nr] of neighbors) {
      const occupied = gameState.tray.some(p => 
        p.placed && p.q === nq && p.r === nr
      ) || (nq === move.q && nr === move.r); // Include the planned move
      if (occupied) threatsAfterMove++;
    }
    
    // If this move would put us close to losing (5+ threats), it's terrible
    if (threatsAfterMove >= 4) {
      return true; // DANGEROUS: helping surround own Queen!
    }
  }
  
  return false;
};

/**
 * Count total mobility (available moves) for a color
 */
window.AIEngine.countMobility = function(gameState, color) {
  const pieces = gameState.tray.filter(p => 
    p.color === color && p.placed
  );
  
  let totalMoves = 0;
  for (const piece of pieces) {
    // Simplified mobility count - actual implementation would use legalMoveZones
    const neighbors = this.getNeighborCoords(piece.q, piece.r);
    const emptyNeighbors = neighbors.filter(([nq, nr]) => {
      return !gameState.tray.some(p => p.placed && p.q === nq && p.r === nr);
    });
    totalMoves += emptyNeighbors.length;
  }
  
  return totalMoves;
};

/**
 * Evaluate piece development and positioning
 */
window.AIEngine.evaluateDevelopment = function(gameState, color) {
  const pieces = gameState.tray.filter(p => 
    p.color === color && p.placed
  );
  
  let developmentScore = 0;
  
  for (const piece of pieces) {
    // Reward pieces closer to center
    const distance = Math.abs(piece.q) + Math.abs(piece.r);
    developmentScore += Math.max(0, 4 - distance);
    
    // Bonus for queen placement
    if (piece.key === 'Q') {
      developmentScore += 2;
    }
  }
  
  return developmentScore;
};

/**
 * Get hexagonal neighbor coordinates
 */
window.AIEngine.getNeighborCoords = function(q, r) {
  return [
    [q + 1, r], [q - 1, r],
    [q, r + 1], [q, r - 1],  
    [q + 1, r - 1], [q - 1, r + 1]
  ];
};

/**
 * Weighted move selection for simulation quality
 */
window.AIEngine.selectSimulationMove = function(moves, gameState) {
  if (moves.length === 0) return null;
  
  // Simple weighted selection favoring queen moves and center positions
  const weightedMoves = moves.map(move => ({
    move,
    weight: this.calculateMoveWeight(move, gameState)
  }));
  
  const totalWeight = weightedMoves.reduce((sum, wm) => sum + wm.weight, 0);
  if (totalWeight === 0) return moves[Math.floor(Math.random() * moves.length)];
  
  let random = Math.random() * totalWeight;
  
  for (const wm of weightedMoves) {
    random -= wm.weight;
    if (random <= 0) return wm.move;
  }
  
  return moves[Math.floor(Math.random() * moves.length)];
};

/**
 * Calculate weight for move selection in simulation
 */
window.AIEngine.calculateMoveWeight = function(move, gameState) {
  let weight = 1; // Base weight
  
  // Prefer queen placement early in game
  if (move.type === 'place' && move.piece.key === 'Q') {
    weight *= 2;
  }
  
  // Prefer moves closer to center
  const distance = Math.abs(move.q) + Math.abs(move.r);
  weight *= Math.max(0.5, 2 - distance * 0.2);
  
  // Prefer moves that threaten opponent queen
  const oppColor = gameState.currentPlayer === 'white' ? 'black' : 'white';
  const oppQueen = gameState.tray.find(p => 
    p.color === oppColor && p.key === 'Q' && p.placed
  );
  
  if (oppQueen) {
    const queenDistance = Math.abs(move.q - oppQueen.q) + Math.abs(move.r - oppQueen.r);
    if (queenDistance <= 2) weight *= 1.5;
  }
  
  return weight;
};

/**
 * Execute the AI's chosen move using existing game functions
 */
window.AIEngine.executeMove = function(move) {
  console.log(`🤖 AI executing ${move.type}:`, move);
  
  if (!move || !move.type) {
    console.error('🤖 Invalid move provided:', move);
    return;
  }
  
  if (move.type === 'place') {
    // CRITICAL: Validate placement position is actually empty
    const positionKey = `${move.q},${move.r}`;
    const cellExists = window.cells && window.cells.has(positionKey);
    const cellIsEmpty = cellExists ? window.cells.get(positionKey).stack.length === 0 : true;
    
    // Double-check with tray that no piece is already at this position
    const existingPiece = typeof tray !== 'undefined' ? tray.find(p => 
      p.meta && p.meta.placed && p.meta.q === move.q && p.meta.r === move.r
    ) : null;
    
    console.log(`🤖 🔍 Placement validation for ${move.q},${move.r}:`);
    console.log(`🤖   - Cell exists: ${cellExists}`);
    console.log(`🤖   - Cell empty: ${cellIsEmpty}`);
    console.log(`🤖   - Existing piece: ${existingPiece ? existingPiece.meta.key : 'none'}`);
    
    if (existingPiece) {
      console.error(`🤖 ❌ ILLEGAL MOVE: Trying to place ${move.piece?.meta?.key} on top of ${existingPiece.meta.key} at ${move.q},${move.r}!`);
      console.error(`🤖 ❌ Only Beetles can stack, and only after Queens are placed!`);
      
      // Skip this illegal move and pass turn
      if (typeof passTurn === 'function') {
        console.log(`🤖 🛑 Passing turn due to illegal move attempt`);
        passTurn();
      }
      return;
    }
    
    if (typeof selectPlacement === 'function' && typeof commitPlacement === 'function') {
      console.log(`🤖 Placing ${move.piece?.meta?.key || '?'} at ${move.q},${move.r}`);
      try {
        selectPlacement(move.piece);
        setTimeout(() => {
          try {
            commitPlacement(move.q, move.r);
            console.log('🤖 Placement completed successfully');
          } catch (error) {
            console.error('🤖 Error in commitPlacement:', error);
            // Force pass turn if placement fails
            if (typeof passTurn === 'function') {
              passTurn();
            }
          }
        }, 300);
      } catch (error) {
        console.error('🤖 Error in selectPlacement:', error);
        // Force pass turn if selection fails
        if (typeof passTurn === 'function') {
          passTurn();
        }
      }
    } else {
      console.error('🤖 Placement functions not available');
    }
  } else if (move.type === 'move') {
    if (typeof selectMove === 'function' && typeof commitMove === 'function') {
      console.log(`🤖 Moving ${move.piece?.meta?.key || '?'} to ${move.q},${move.r}`);
      console.log(`🤖 Piece object:`, move.piece);
      
      try {
        // Check if piece is actually movable first
        if (!move.piece || !move.piece.meta || !move.piece.meta.placed) {
          console.error('🤖 Cannot move piece - not placed or invalid:', move.piece);
          if (typeof passTurn === 'function') {
            passTurn();
          }
          return;
        }
        
        selectMove(move.piece);
        setTimeout(() => {
          try {
            commitMove(move.q, move.r);
            console.log('🤖 Movement completed successfully');
          } catch (error) {
            console.error('🤖 Error in commitMove:', error);
            // Force pass turn if move fails
            if (typeof passTurn === 'function') {
              passTurn();
            }
          }
        }, 300);
      } catch (error) {
        console.error('🤖 Error in selectMove:', error);
        console.error('🤖 Failed piece:', move.piece);
        // Force pass turn if selection fails
        if (typeof passTurn === 'function') {
          passTurn();
        }
      }
    } else {
      console.error('🤖 Movement functions not available');
    }
  } else {
    console.error('🤖 Unknown move type:', move.type);
  }
};

/**
 * Capture current game state for AI analysis
 */
window.AIEngine.captureGameState = function() {
  // Extract only the essential data from tray (avoid circular PIXI references)
  const cleanTray = typeof tray !== 'undefined' ? tray.map(piece => ({
    key: piece.meta.key,
    color: piece.meta.color,
    placed: piece.meta.placed,
    q: piece.meta.q,
    r: piece.meta.r,
    meta: {
      key: piece.meta.key,
      color: piece.meta.color,
      placed: piece.meta.placed,
      q: piece.meta.q,
      r: piece.meta.r
    }
  })) : [];

  return {
    currentPlayer: window.state ? window.state.current : 'white',
    moveNumber: window.state ? (window.state.moveNumber || 0) : 0,
    tray: cleanTray,
    gameOver: window.state ? (window.state.gameOver || false) : false,
    isSimulation: false  // Root game state is never a simulation
  };
};

/**
 * TACTICAL POSITION DETECTION - Determine when to use Minimax vs MCTS
 */
window.AIEngine.isTacticalPosition = function(gameState) {
  try {
    const aiColor = this.color;
    const oppColor = aiColor === 'white' ? 'black' : 'white';
    
    console.log('🧠 TACTICAL ANALYSIS: Checking position...');
    
    // Find Queens
    const aiQueen = gameState.tray.find(p => 
      p && p.placed && p.color === aiColor && p.key === 'Q'
    );
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.color === oppColor && p.key === 'Q'
    );
    
    if (!aiQueen || !oppQueen) {
      console.log('🧠 Queens not both placed - not tactical yet');
      return false;
    }
    
    // 1. Check for Queen pressure (most important tactical indicator)
    const aiQueenThreats = this.countQueenThreatsInState(gameState, aiColor);
    const oppQueenThreats = this.countQueenThreatsInState(gameState, oppColor);
    
    if (aiQueenThreats >= 3 || oppQueenThreats >= 3) {
      console.log(`🧠 ⚡ TACTICAL: Queen under heavy pressure (AI: ${aiQueenThreats}, Opp: ${oppQueenThreats})`);
      return true;
    }
    
    // 2. Check Queen proximity (tactical opportunities arise when Queens are close)
    const queenDistance = Math.abs(aiQueen.q - oppQueen.q) + Math.abs(aiQueen.r - oppQueen.r);
    if (queenDistance <= 4) {
      console.log(`🧠 ⚡ TACTICAL: Queens are close (distance: ${queenDistance})`);
      return true;
    }
    
    // 3. Check for complex pin situations
    const allPinnedPieces = this.detectPinnedPieces();
    if (allPinnedPieces.length >= 2) {
      console.log(`🧠 ⚡ TACTICAL: Multiple pins detected (${allPinnedPieces.length})`);
      return true;
    }
    
    // 4. Check for endgame (fewer pieces = tactics matter more)
    const totalPieces = gameState.tray.filter(p => p && p.placed).length;
    if (totalPieces <= 8) {
      console.log(`🧠 ⚡ TACTICAL: Endgame detected (${totalPieces} pieces)`);
      return true;
    }
    
    // 5. Check for critical piece positions (Beetles threatening to climb)
    const criticalBeetleThreats = this.countCriticalBeetleThreats(gameState, aiColor);
    if (criticalBeetleThreats >= 1) {
      console.log(`🧠 ⚡ TACTICAL: Critical Beetle threats detected (${criticalBeetleThreats})`);
      return true;
    }
    
    // 6. Check for forced sequences (when player has very few legal moves)
    const currentMoves = this.generateLegalMoves(gameState);
    if (currentMoves.length <= 3) {
      console.log(`🧠 ⚡ TACTICAL: Limited options (${currentMoves.length} moves) - forced play`);
      return true;
    }
    
    console.log('🧠 Position is strategic - using MCTS');
    return false;
    
  } catch (error) {
    console.error('🧠 💥 Error detecting tactical position:', error);
    return false;
  }
};

/**
 * Count Queen threats for a specific game state
 */
window.AIEngine.countQueenThreatsInState = function(gameState, color) {
  try {
    const queen = gameState.tray.find(p => 
      p && p.placed && p.color === color && p.key === 'Q'
    );
    
    if (!queen) return 0;
    
    const adjacentPositions = [
      [queen.q + 1, queen.r],
      [queen.q - 1, queen.r], 
      [queen.q, queen.r + 1],
      [queen.q, queen.r - 1],
      [queen.q + 1, queen.r - 1],
      [queen.q - 1, queen.r + 1]
    ];
    
    let threats = 0;
    const opponentColor = color === 'white' ? 'black' : 'white';
    
    for (const [q, r] of adjacentPositions) {
      const piece = gameState.tray.find(p => 
        p && p.placed && p.q === q && p.r === r && p.color === opponentColor
      );
      if (piece) threats++;
    }
    
    return threats;
  } catch (error) {
    console.error('🧠 Error counting Queen threats in state:', error);
    return 0;
  }
};

/**
 * Count critical Beetle threats that could climb on important pieces
 */
window.AIEngine.countCriticalBeetleThreats = function(gameState, aiColor) {
  try {
    const opponentColor = aiColor === 'white' ? 'black' : 'white';
    let criticalThreats = 0;
    
    // Find opponent Beetles
    const oppBeetles = gameState.tray.filter(p => 
      p && p.placed && p.color === opponentColor && p.key === 'B'
    );
    
    // Find our important pieces (Queen, key strategic pieces)
    const importantPieces = gameState.tray.filter(p => 
      p && p.placed && p.color === aiColor && (p.key === 'Q' || this.isPieceInCriticalPosition(p, gameState))
    );
    
    for (const beetle of oppBeetles) {
      for (const important of importantPieces) {
        const distance = Math.abs(beetle.q - important.q) + Math.abs(beetle.r - important.r);
        if (distance <= 2) { // Beetle can threaten within 2 moves
          criticalThreats++;
        }
      }
    }
    
    return criticalThreats;
  } catch (error) {
    console.error('🧠 Error counting critical Beetle threats:', error);
    return 0;
  }
};

/**
 * Check if a piece is in a critical strategic position
 */
window.AIEngine.isPieceInCriticalPosition = function(piece, gameState) {
  try {
    if (!piece || !piece.placed) return false;
    
    // Piece is critical if it's blocking opponent Queen movement
    const oppColor = piece.color === 'white' ? 'black' : 'white';
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.color === oppColor && p.key === 'Q'
    );
    
    if (oppQueen) {
      const distance = Math.abs(piece.q - oppQueen.q) + Math.abs(piece.r - oppQueen.r);
      return distance <= 2; // Adjacent or nearby pieces are critical
    }
    
    return false;
  } catch (error) {
    console.error('🧠 Error checking critical position:', error);
    return false;
  }
};

/**
 * Check if game is over
 */
window.AIEngine.isGameOver = function(gameState) {
  return gameState.gameOver || 
         this.isQueenSurrounded(gameState, 'white') || 
         this.isQueenSurrounded(gameState, 'black');
};

/**
 * Enable AI with specified difficulty
 */
window.AIEngine.enable = function(difficulty = 'medium') {
  this.enabled = true;
  this.difficulty = difficulty;
  this.color = 'black'; // AI always plays black
  
  console.log(`🤖 ⭐ AI ENABLED as ${this.color} player (${difficulty} difficulty)`);
  console.log(`🤖 ⭐ AI will make moves when it's BLACK's turn!`);
  
  // Hook into the game's turn system
  this.hookIntoGame();
};

/**
 * TESTING: Force-enable AI for debugging (call from console)
 */
window.AIEngine.forceEnable = function(difficulty = 'hard') {
  console.log(`🤖 🔧 FORCE-ENABLING AI for testing (${difficulty} difficulty)`);
  this.enable(difficulty);
  
  // Reset game to white's turn so AI can play
  if (window.state) {
    window.state.current = 'white';
    window.state.moveNumber = 1;
    window.state.gameOver = false;
  }
  
  console.log(`🤖 🔧 Game reset - make a WHITE move and AI will respond as BLACK`);
  
  if (typeof updateHUD === 'function') {
    updateHUD();
  }
};

/**
 * Disable AI and return to normal gameplay
 */
window.AIEngine.disable = function() {
  this.enabled = false;
  this.thinking = false;
  console.log('🤖 AI disabled - returning to sandbox mode');
};

/**
 * Hook into the existing game system
 */
window.AIEngine.hookIntoGame = function() {
  // Override updateHUD to trigger AI moves
  if (typeof updateHUD === 'function' && !updateHUD._aiHooked) {
    const originalUpdateHUD = updateHUD;
    
    window.updateHUD = function() {
      // Call original HUD update
      originalUpdateHUD.apply(this, arguments);
      
      // Check if it's AI's turn after a brief delay
      setTimeout(() => {
        window.AIEngine.checkAndMakeMove();
      }, 100);
    };
    
    // Mark as hooked to prevent double-hooking
    window.updateHUD._aiHooked = true;
  }
};

/**
 * Enhanced strategic evaluation functions
 */

/**
 * Evaluate advanced queen danger patterns
 */
window.AIEngine.evaluateQueenDanger = function(gameState, aiColor, oppColor) {
  const aiQueen = gameState.tray.find(p => p.color === aiColor && p.key === 'Q' && p.placed);
  const oppQueen = gameState.tray.find(p => p.color === oppColor && p.key === 'Q' && p.placed);
  
  let danger = 0;
  
  if (aiQueen) {
    // Check for potential queen traps (surrounded positions with escape routes)
    const aiQueenEscapes = this.countQueenEscapeRoutes(gameState, aiQueen);
    danger -= Math.max(0, 3 - aiQueenEscapes) * 0.1; // Penalty for limited escapes
    
    // Check for pieces that could move to threaten queen
    danger -= this.countPotentialQueenThreats(gameState, oppColor, aiQueen) * 0.05;
  }
  
  if (oppQueen) {
    // Bonus for threatening opponent queen
    const oppQueenEscapes = this.countQueenEscapeRoutes(gameState, oppQueen);
    danger += Math.max(0, 3 - oppQueenEscapes) * 0.1;
    
    // Bonus for having pieces that could move to threaten opponent queen
    danger += this.countPotentialQueenThreats(gameState, aiColor, oppQueen) * 0.05;
  }
  
  return danger;
};

/**
 * Count escape routes for a queen
 */
window.AIEngine.countQueenEscapeRoutes = function(gameState, queen) {
  const neighbors = this.getNeighborCoords(queen.q, queen.r);
  let escapeRoutes = 0;
  
  for (const [nq, nr] of neighbors) {
    const occupied = gameState.tray.some(p => p.placed && p.q === nq && p.r === nr);
    if (!occupied) {
      // Check if this empty space connects to other empty spaces
      const nextNeighbors = this.getNeighborCoords(nq, nr);
      const hasConnection = nextNeighbors.some(([nnq, nnr]) => {
        return (nnq !== queen.q || nnr !== queen.r) && 
               !gameState.tray.some(p => p.placed && p.q === nnq && p.r === nnr);
      });
      if (hasConnection) escapeRoutes++;
    }
  }
  
  return escapeRoutes;
};

/**
 * Count pieces that could potentially threaten a queen
 */
window.AIEngine.countPotentialQueenThreats = function(gameState, color, targetQueen) {
  const pieces = gameState.tray.filter(p => p.color === color && p.placed);
  let threats = 0;
  
  for (const piece of pieces) {
    const distance = Math.abs(piece.q - targetQueen.q) + Math.abs(piece.r - targetQueen.r);
    
    // Different pieces have different threat ranges
    switch (piece.key) {
      case 'A': // Ant - can move long distances
        if (distance <= 4) threats += 0.8;
        break;
      case 'G': // Grasshopper - jumps in straight lines  
        if (distance <= 3) threats += 0.6;
        break;
      case 'S': // Spider - exactly 3 moves
        if (distance === 3) threats += 0.7;
        break;
      case 'B': // Beetle - can climb and move
        if (distance <= 2) threats += 0.9;
        break;
      default:
        if (distance <= 2) threats += 0.3;
    }
  }
  
  return threats;
};

/**
 * Evaluate material value and piece positioning
 */
window.AIEngine.evaluateMaterial = function(gameState, aiColor, oppColor) {
  try {
    // Evaluating material balance
    
    if (!gameState || !gameState.tray) {
      console.error(`🤖 💥 MATERIAL ERROR: Invalid gameState or tray:`, gameState);
      return 0;
    }
    
    const aiPieces = gameState.tray.filter(p => p.color === aiColor && p.placed);
    const oppPieces = gameState.tray.filter(p => p.color === oppColor && p.placed);
    
    // Counting pieces for both sides
    
    // Dynamic piece values based on game phase and expert strategy analysis
    const pieceValues = this.getDynamicPieceValues(gameState);
    
    let aiValue = 0, oppValue = 0;
    
    // Calculate piece values with positional bonuses
    for (const piece of aiPieces) {
      try {
        if (!piece || typeof piece.key !== 'string') {
          console.error(`🤖 💥 MATERIAL ERROR: Invalid AI piece:`, piece);
          continue;
        }
        
        if (typeof piece.q !== 'number' || typeof piece.r !== 'number') {
          console.error(`🤖 💥 MATERIAL ERROR: Invalid AI piece coordinates:`, piece);
          continue;
        }
        
        let value = pieceValues[piece.key] || 1;
        
        // Hive-specific positional bonuses (not chess-like center control)
        // Focus on Queen safety and strategic positioning instead of arbitrary center
        
        // Piece-specific bonuses
        if (piece.key === 'B') {
          // Beetles are more valuable when stacked or near stacks
          const isStacked = this.isPositionStacked(gameState, piece.q, piece.r);
          if (isStacked) value += 0.5;
        }
        
        if (isNaN(value)) {
          console.error(`🤖 💥 MATERIAL ERROR: NaN value for AI piece:`, piece);
          continue;
        }
        
        aiValue += value;
      } catch (error) {
        console.error(`🤖 💥 MATERIAL ERROR: Exception processing AI piece:`, piece, error);
        continue;
      }
    }
    
    for (const piece of oppPieces) {
      try {
        if (!piece || typeof piece.key !== 'string') {
          console.error(`🤖 💥 MATERIAL ERROR: Invalid opponent piece:`, piece);
          continue;
        }
        
        if (typeof piece.q !== 'number' || typeof piece.r !== 'number') {
          console.error(`🤖 💥 MATERIAL ERROR: Invalid opponent piece coordinates:`, piece);
          continue;
        }
        
        let value = pieceValues[piece.key] || 1;
        const centerDistance = Math.abs(piece.q) + Math.abs(piece.r);
        if (isNaN(centerDistance)) {
          console.error(`🤖 💥 MATERIAL ERROR: NaN centerDistance for opponent piece:`, piece);
          continue;
        }
        
        value += Math.max(0, 3 - centerDistance) * 0.1;
        
        if (piece.key === 'B') {
          const isStacked = this.isPositionStacked(gameState, piece.q, piece.r);
          if (isStacked) value += 0.5;
        }
        
        if (isNaN(value)) {
          console.error(`🤖 💥 MATERIAL ERROR: NaN value for opponent piece:`, piece);
          continue;
        }
        
        oppValue += value;
      } catch (error) {
        console.error(`🤖 💥 MATERIAL ERROR: Exception processing opponent piece:`, piece, error);
        continue;
      }
    }
    
    if (isNaN(aiValue) || isNaN(oppValue)) {
      console.error(`🤖 💥 MATERIAL ERROR: NaN final values - aiValue:${aiValue}, oppValue:${oppValue}`);
      return 0;
    }
    
    const result = (aiValue - oppValue) / 20; // Normalize
    
    if (isNaN(result)) {
      console.error(`🤖 💥 MATERIAL ERROR: NaN result - aiValue:${aiValue}, oppValue:${oppValue}`);
      return 0;
    }
    
    // Material evaluation completed
    return result;
    
  } catch (error) {
    console.error(`🤖 💥 MATERIAL ERROR: Exception in evaluateMaterial:`, error);
    console.error(`🤖 💥 MATERIAL ERROR: Stack trace:`, error.stack);
    return 0;
  }
};

/**
 * Check if a position has stacked pieces
 */
window.AIEngine.isPositionStacked = function(gameState, q, r) {
  try {
    if (!gameState || !gameState.tray || typeof q !== 'number' || typeof r !== 'number') {
      return false;
    }
    
    const piecesAtPosition = gameState.tray.filter(p => 
      p.placed && p.q === q && p.r === r
    );
    return piecesAtPosition.length > 1;
  } catch (error) {
    console.error(`🤖 💥 ERROR in isPositionStacked:`, error);
    return false;
  }
};

/**
 * Evaluate control and mobility
 */
window.AIEngine.evaluateControl = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) {
      console.error(`🤖 💥 CONTROL ERROR: Invalid gameState`);
      return 0;
    }
    
    // Territory control - count spaces dominated by each side
    let aiControl = 0, oppControl = 0;
    
    // Check key areas around each piece
    const aiPieces = gameState.tray.filter(p => p.color === aiColor && p.placed);
    const oppPieces = gameState.tray.filter(p => p.color === oppColor && p.placed);
    
    for (const piece of aiPieces) {
      if (!piece || typeof piece.q !== 'number' || typeof piece.r !== 'number') continue;
      
      const neighbors = this.getNeighborCoords(piece.q, piece.r);
      for (const [nq, nr] of neighbors) {
        const isEmpty = !gameState.tray.some(p => p.placed && p.q === nq && p.r === nr);
        if (isEmpty) aiControl += 1;
      }
    }
    
    for (const piece of oppPieces) {
      if (!piece || typeof piece.q !== 'number' || typeof piece.r !== 'number') continue;
      
      const neighbors = this.getNeighborCoords(piece.q, piece.r);
      for (const [nq, nr] of neighbors) {
        const isEmpty = !gameState.tray.some(p => p.placed && p.q === nq && p.r === nr);
        if (isEmpty) oppControl += 1;
      }
    }
    
    // Mobility - actual piece movement options (simplified)
    const aiMobility = this.countAdvancedMobility(gameState, aiColor);
    const oppMobility = this.countAdvancedMobility(gameState, oppColor);
    
    const controlDiff = (aiControl - oppControl) / 50;
    const mobilityDiff = (aiMobility - oppMobility) / 20;
    
    const result = controlDiff + mobilityDiff;
    
    if (isNaN(result)) {
      console.error(`🤖 💥 CONTROL ERROR: NaN result - controlDiff:${controlDiff}, mobilityDiff:${mobilityDiff}`);
      return 0;
    }
    
    return result;
    
  } catch (error) {
    console.error(`🤖 💥 CONTROL ERROR: Exception in evaluateControl:`, error);
    return 0;
  }
};

/**
 * Count advanced mobility considering piece-specific movement patterns
 */
window.AIEngine.countAdvancedMobility = function(gameState, color) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    const pieces = gameState.tray.filter(p => p.color === color && p.placed);
    let mobility = 0;
    
    for (const piece of pieces) {
      if (!piece || typeof piece.q !== 'number' || typeof piece.r !== 'number') continue;
      
      // Simplified mobility based on piece type and local environment
      const neighbors = this.getNeighborCoords(piece.q, piece.r);
      const emptyNeighbors = neighbors.filter(([nq, nr]) => {
        return !gameState.tray.some(p => p.placed && p.q === nq && p.r === nr);
      });
      
      let pieceMobility = 0;
      
      switch (piece.key) {
        case 'A': // Ant - high mobility
          pieceMobility = emptyNeighbors.length * 2;
          break;
        case 'G': // Grasshopper - jumping mobility
          pieceMobility = this.countJumpOptions(gameState, piece) * 1.5;
          break;
        case 'S': // Spider - specific 3-step mobility
          pieceMobility = Math.min(emptyNeighbors.length, 3) * 1.2;
          break;
        case 'B': // Beetle - climbing mobility
          pieceMobility = (emptyNeighbors.length + neighbors.length) * 1.3;
          break;
        default:
          pieceMobility = emptyNeighbors.length;
      }
      
      if (!isNaN(pieceMobility)) {
        mobility += pieceMobility;
      }
    }
    
    return mobility;
  } catch (error) {
    console.error(`🤖 💥 MOBILITY ERROR: Exception in countAdvancedMobility:`, error);
    return 0;
  }
};

/**
 * Count jump options for grasshopper
 */
window.AIEngine.countJumpOptions = function(gameState, piece) {
  try {
    if (!gameState || !gameState.tray || !piece || typeof piece.q !== 'number' || typeof piece.r !== 'number') {
      return 0;
    }
    
    const directions = [
      [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]
    ];
    
    let jumpOptions = 0;
    
    for (const [dq, dr] of directions) {
      // Look for a piece to jump over
      let checkQ = piece.q + dq;
      let checkR = piece.r + dr;
      
      let foundPiece = false;
      while (Math.abs(checkQ) + Math.abs(checkR) <= 5) { // Reasonable search limit
        const hasPiece = gameState.tray.some(p => 
          p.placed && p.q === checkQ && p.r === checkR
        );
        
        if (hasPiece && !foundPiece) {
          foundPiece = true;
        } else if (!hasPiece && foundPiece) {
          jumpOptions++;
          break;
        }
        
        checkQ += dq;
        checkR += dr;
      }
    }
    
    return jumpOptions;
  } catch (error) {
    console.error(`🤖 💥 JUMP OPTIONS ERROR: Exception in countJumpOptions:`, error);
    return 0;
  }
};

/**
 * Evaluate tactical patterns and threats
 */
window.AIEngine.evaluateTacticalPatterns = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) {
      console.error(`🤖 💥 TACTICAL ERROR: Invalid gameState`);
      return 0;
    }
    
    let tactical = 0;
    
    // 1. ADVANCED PIN ANALYSIS - considers strategic context and timing
    tactical += this.evaluateAdvancedPinning(gameState, aiColor, oppColor);
    
    // 2. FORK DETECTION - moves that threaten multiple targets simultaneously
    const forkAdvantage = this.evaluateForkThreats(gameState, aiColor, oppColor);
    tactical += forkAdvantage * 0.4;
    
    // 3. TEMPO AND FORCING MOVES - moves that limit opponent options
    const tempoAdvantage = this.evaluateTempoMoves(gameState, aiColor, oppColor);
    tactical += tempoAdvantage * 0.3;
    
    // 4. PIECE BLOCKADE PATTERNS - controlling key squares
    const blockadeValue = this.evaluateBlockadePatterns(gameState, aiColor, oppColor);
    tactical += blockadeValue * 0.35;
    
    // 5. ESCAPE ROUTE CONTROL - limiting opponent Queen mobility
    const escapeControl = this.evaluateEscapeRouteControl(gameState, aiColor, oppColor);
    tactical += escapeControl * 0.5;
    
    // 6. SACRIFICE TACTICS - beneficial piece trades
    const sacrificeValue = this.evaluateSacrificeOpportunities(gameState, aiColor, oppColor);
    tactical += sacrificeValue * 0.25;
    
    if (isNaN(tactical)) {
      console.error(`🤖 💥 TACTICAL ERROR: NaN result`);
      return 0;
    }
    
    return Math.max(-3.0, Math.min(3.0, tactical));
  } catch (error) {
    console.error(`🤖 💥 TACTICAL ERROR: Exception in evaluateTacticalPatterns:`, error);
    return 0;
  }
};

/**
 * Count pinned pieces (simplified)
 */
window.AIEngine.countPins = function(gameState, color) {
  try {
    if (!gameState || !gameState.tray || !color) return 0;
    
    const pieces = gameState.tray.filter(p => p.color === color && p.placed);
    let pins = 0;
    
    for (const piece of pieces) {
      if (!piece || typeof piece.q !== 'number' || typeof piece.r !== 'number') continue;
      
      // A piece is potentially pinned if removing it would split the hive
      // Simplified check: count pieces that would be isolated
      const connectedPieces = this.getConnectedPieces(gameState, piece.q, piece.r, piece);
      const totalPieces = gameState.tray.filter(p => p.placed).length;
      
      if (connectedPieces < totalPieces - 1) {
        pins++;
      }
    }
    
    return pins;
  } catch (error) {
    console.error(`🤖 💥 PINS ERROR: Exception in countPins:`, error);
    return 0;
  }
};

/**
 * Smart pinning evaluation - considers strategic context
 */
window.AIEngine.evaluateSmartPinning = function(gameState, aiColor, oppColor) {
  try {
    let pinValue = 0;
    
    // Count opponent pins (always good)
    const oppPins = this.countPins(gameState, oppColor);
    pinValue += oppPins * 0.4;
    
    // Count our pins (context-dependent)
    const ourPins = this.countPins(gameState, aiColor);
    
    // Find our Queen and opponent Queen
    const aiQueen = gameState.tray.find(p => p.color === aiColor && p.key === 'Q' && p.placed);
    const oppQueen = gameState.tray.find(p => p.color === oppColor && p.key === 'Q' && p.placed);
    
    // Our pins are acceptable if:
    // 1. We're maintaining pressure on opponent Queen
    // 2. We're preventing opponent from threatening our Queen
    // 3. The pinned piece is maintaining a crucial strategic advantage
    
    if (aiQueen && oppQueen) {
      const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
      const aiQueenThreats = this.countQueenThreats(gameState, aiColor);
      
      // If opponent Queen is close to being surrounded, our pins are more acceptable
      if (oppQueenThreats >= 4) {
        pinValue -= ourPins * 0.1; // Minimal penalty - we're winning
      } else if (oppQueenThreats >= 3) {
        pinValue -= ourPins * 0.2; // Small penalty - good position
      } else if (aiQueenThreats >= 4) {
        pinValue -= ourPins * 0.5; // Higher penalty - we're in danger, need mobility
      } else {
        pinValue -= ourPins * 0.3; // Normal penalty
      }
    } else {
      // Early game - pins matter less
      pinValue -= ourPins * 0.2;
    }
    
    return pinValue;
  } catch (error) {
    console.error(`🤖 💥 SMART PINNING ERROR:`, error);
    return 0;
  }
};

/**
 * Get connected pieces (simplified connectivity check)
 */
window.AIEngine.getConnectedPieces = function(gameState, excludeQ, excludeR, excludePiece) {
  const allPieces = gameState.tray.filter(p => 
    p.placed && !(p.q === excludeQ && p.r === excludeR)
  );
  
  if (allPieces.length === 0) return 0;
  
  // Simple flood fill from first piece
  const visited = new Set();
  const queue = [allPieces[0]];
  visited.add(`${allPieces[0].q},${allPieces[0].r}`);
  
  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = this.getNeighborCoords(current.q, current.r);
    
    for (const [nq, nr] of neighbors) {
      const key = `${nq},${nr}`;
      if (!visited.has(key)) {
        const neighborPiece = allPieces.find(p => p.q === nq && p.r === nr);
        if (neighborPiece) {
          visited.add(key);
          queue.push(neighborPiece);
        }
      }
    }
  }
  
  return visited.size;
};

/**
 * Count potential fork threats
 */
window.AIEngine.countForkThreats = function(gameState, color) {
  try {
    if (!gameState || !gameState.tray || !color) return 0;
    
    // Simplified: count pieces that can threaten multiple important targets
    const pieces = gameState.tray.filter(p => p.color === color && p.placed);
    const oppColor = color === 'white' ? 'black' : 'white';
    const oppQueen = gameState.tray.find(p => p.color === oppColor && p.key === 'Q' && p.placed);
    
    let forks = 0;
    
    for (const piece of pieces) {
      if (!piece || typeof piece.q !== 'number' || typeof piece.r !== 'number') continue;
      
      if (piece.key === 'A' || piece.key === 'B') { // Mobile pieces
        const neighbors = this.getNeighborCoords(piece.q, piece.r);
        let threats = 0;
        
        for (const [nq, nr] of neighbors) {
          if (oppQueen && Math.abs(nq - oppQueen.q) + Math.abs(nr - oppQueen.r) <= 1) {
            threats++;
          }
          // Could add more threat types here
        }
        
        if (threats >= 2) forks++;
      }
    }
    
    return forks;
  } catch (error) {
    console.error(`🤖 💥 FORK THREATS ERROR: Exception in countForkThreats:`, error);
    return 0;
  }
};

/**
 * Count tempo moves (moves that force responses)
 */
window.AIEngine.countTempoMoves = function(gameState, color) {
  try {
    if (!gameState || !gameState.tray || !color) return 0;
    
    // Simplified: count threatening moves that limit opponent options
    const oppColor = color === 'white' ? 'black' : 'white';
    const oppQueen = gameState.tray.find(p => p.color === oppColor && p.key === 'Q' && p.placed);
    
    if (!oppQueen) return 0;
    
    const aiPieces = gameState.tray.filter(p => p.color === color && p.placed);
    let tempoMoves = 0;
    
    for (const piece of aiPieces) {
      if (!piece || typeof piece.q !== 'number' || typeof piece.r !== 'number') continue;
      
      const distance = Math.abs(piece.q - oppQueen.q) + Math.abs(piece.r - oppQueen.r);
      if (distance <= 2 && (piece.key === 'A' || piece.key === 'B')) {
        tempoMoves++;
      }
    }
    
    return tempoMoves;
  } catch (error) {
    console.error(`🤖 💥 TEMPO MOVES ERROR: Exception in countTempoMoves:`, error);
    return 0;
  }
};

/**
 * TEMPO EVALUATION - "Stealing Turns" Strategy from Hive Theory
 * Evaluates moves that force opponent to waste turns or gain tempo advantage
 */
window.AIEngine.evaluateTempo = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let tempoValue = 0;
    const aiPieces = gameState.tray.filter(p => p.placed && p.color === aiColor);
    const oppPieces = gameState.tray.filter(p => p.placed && p.color === oppColor);
    
    // 1. PINNING EVALUATION - Pinned pieces = wasted opponent turns
    const ourPins = this.countOpponentPiecesPinnedByUs(gameState, aiColor, oppColor);
    const theirPins = this.countOpponentPiecesPinnedByUs(gameState, oppColor, aiColor);
    
    // Each pinned opponent piece = significant tempo advantage
    tempoValue += ourPins * 0.15; // We gain tempo
    tempoValue -= theirPins * 0.12; // We lose tempo
    
    // 2. MOBILITY DIFFERENTIAL - More mobile pieces = more tempo options
    const ourMobility = this.calculateMobilityScore(gameState, aiColor);
    const theirMobility = this.calculateMobilityScore(gameState, oppColor);
    
    tempoValue += (ourMobility - theirMobility) * 0.08;
    
    // 3. FORCING MOVES - Moves that force opponent responses
    const ourForcingPower = this.calculateForcingMoves(gameState, aiColor, oppColor);
    const theirForcingPower = this.calculateForcingMoves(gameState, oppColor, aiColor);
    
    tempoValue += (ourForcingPower - theirForcingPower) * 0.1;
    
    // 4. PIECE DEVELOPMENT TEMPO - Based on book's opening theory
    const developmentDiff = this.evaluateDevelopmentTempo(gameState, aiColor, oppColor);
    tempoValue += developmentDiff * 0.12;
    
    // 5. QUEEN MOVEMENT EFFICIENCY - Moving Queen wastes tempo unless necessary
    const queenMovementPenalty = this.evaluateQueenMovementTempo(gameState, aiColor, oppColor);
    tempoValue += queenMovementPenalty;
    
    debugLog(`🏃 TEMPO ANALYSIS: Our pins: ${ourPins}, Their pins: ${theirPins}, Mobility diff: ${(ourMobility - theirMobility).toFixed(2)}, Total tempo: ${tempoValue.toFixed(3)}`);
    
    return Math.max(-0.3, Math.min(0.3, tempoValue)); // Cap tempo influence
    
  } catch (error) {
    console.error('🤖 💥 Error in tempo evaluation:', error);
    return 0;
  }
};

/**
 * Count opponent pieces that we have pinned (stealing their tempo)
 */
window.AIEngine.countOpponentPiecesPinnedByUs = function(gameState, ourColor, oppColor) {
  try {
    const oppPieces = gameState.tray.filter(p => p.placed && p.color === oppColor);
    let pinnedCount = 0;
    
    for (const piece of oppPieces) {
      if (this.isPiecePinnedInState(piece, gameState)) {
        // Check if WE are the ones pinning it (one of our pieces is adjacent)
        const adjacentPositions = this.getNeighborCoords(piece.q, piece.r);
        const hasOurAdjacent = adjacentPositions.some(([q, r]) => {
          const adjacentPiece = gameState.tray.find(p => 
            p.placed && p.q === q && p.r === r && p.color === ourColor
          );
          return adjacentPiece !== undefined;
        });
        
        if (hasOurAdjacent) {
          pinnedCount++;
        }
      }
    }
    
    return pinnedCount;
  } catch (error) {
    console.error('🤖 Error counting pinned pieces:', error);
    return 0;
  }
};

/**
 * Calculate mobility score for tempo evaluation
 */
window.AIEngine.calculateMobilityScore = function(gameState, color) {
  try {
    const pieces = gameState.tray.filter(p => p.placed && p.color === color);
    let totalMobility = 0;
    
    for (const piece of pieces) {
      // Different pieces have different base mobility values from the book
      const baseMobility = this.getPieceBaseMobility(piece.key);
      
      // Modify based on actual position constraints
      const actualMobility = this.calculateActualMobility(piece, gameState);
      
      totalMobility += baseMobility * actualMobility;
    }
    
    return totalMobility;
  } catch (error) {
    console.error('🤖 Error calculating mobility:', error);
    return 0;
  }
};

/**
 * Get base mobility from strategy book insights
 */
window.AIEngine.getPieceBaseMobility = function(pieceKey) {
  // Based on book's piece analysis and tempo theory
  const mobilityValues = {
    'Q': 1.0,  // Queen can move 1 space - moderate mobility
    'A': 3.0,  // Ant - highest mobility, can reach anywhere in one turn
    'B': 1.5,  // Beetle - slow but can reach unreachable places
    'S': 2.0,  // Spider - good mobility but constrained to 3 steps
    'G': 2.5   // Grasshopper - good mobility, can jump over pieces
  };
  
  return mobilityValues[pieceKey] || 1.0;
};

/**
 * Calculate actual mobility considering current position
 */
window.AIEngine.calculateActualMobility = function(piece, gameState) {
  try {
    if (this.isPiecePinnedInState(piece, gameState)) {
      return 0; // Pinned pieces have no mobility
    }
    
    // For now, simplified - could be enhanced with actual move generation
    const adjacentSpaces = this.getNeighborCoords(piece.q, piece.r);
    const freeAdjacentSpaces = adjacentSpaces.filter(([q, r]) => {
      const occupant = gameState.tray.find(p => p.placed && p.q === q && p.r === r);
      return !occupant;
    });
    
    // Mobility factor based on free adjacent spaces
    return Math.min(1.0, freeAdjacentSpaces.length / 6.0);
  } catch (error) {
    console.error('🤖 Error calculating actual mobility:', error);
    return 0.5;
  }
};

/**
 * Calculate forcing moves (moves that force opponent responses)
 */
window.AIEngine.calculateForcingMoves = function(gameState, ourColor, oppColor) {
  try {
    let forcingPower = 0;
    
    // Queen threats are the most forcing moves
    const oppQueen = gameState.tray.find(p => p.placed && p.color === oppColor && p.key === 'Q');
    if (oppQueen) {
      const queenThreats = this.countQueenThreatsInState(gameState, oppColor);
      forcingPower += queenThreats * 0.3; // Each threat forces defensive response
    }
    
    // Beetle threats (ability to climb on pieces)
    const ourBeetles = gameState.tray.filter(p => p.placed && p.color === ourColor && p.key === 'B');
    for (const beetle of ourBeetles) {
      const adjacentOpponents = this.getNeighborCoords(beetle.q, beetle.r).filter(([q, r]) => {
        const piece = gameState.tray.find(p => p.placed && p.q === q && p.r === r && p.color === oppColor);
        return piece !== undefined;
      });
      forcingPower += adjacentOpponents.length * 0.15; // Beetle climbing threats
    }
    
    return forcingPower;
  } catch (error) {
    console.error('🤖 Error calculating forcing moves:', error);
    return 0;
  }
};

/**
 * Evaluate development tempo based on opening theory
 */
window.AIEngine.evaluateDevelopmentTempo = function(gameState, aiColor, oppColor) {
  try {
    const turnNumber = this.estimateTurnNumber(gameState);
    if (turnNumber > 8) return 0; // Only relevant in opening
    
    let developmentScore = 0;
    
    // Check if Queen placement follows book recommendations
    const aiQueen = gameState.tray.find(p => p.placed && p.color === aiColor && p.key === 'Q');
    const oppQueen = gameState.tray.find(p => p.placed && p.color === oppColor && p.key === 'Q');
    
    if (aiQueen && oppQueen) {
      // Good: Queen placed early (tempo advantage)
      // Bad: Queen moved unnecessarily (tempo loss)
      
      // For now, simplified evaluation
      const aiPiecesPlaced = gameState.tray.filter(p => p.placed && p.color === aiColor).length;
      const oppPiecesPlaced = gameState.tray.filter(p => p.placed && p.color === oppColor).length;
      
      // More pieces developed = better tempo
      developmentScore += (aiPiecesPlaced - oppPiecesPlaced) * 0.05;
    }
    
    return developmentScore;
  } catch (error) {
    console.error('🤖 Error evaluating development tempo:', error);
    return 0;
  }
};

/**
 * Evaluate Queen movement tempo (moving Queen wastes tempo unless necessary)
 */
window.AIEngine.evaluateQueenMovementTempo = function(gameState, aiColor, oppColor) {
  try {
    // This would need move history to detect unnecessary Queen moves
    // For now, return 0 as we don't track move history in evaluation
    return 0;
  } catch (error) {
    console.error('🤖 Error evaluating Queen movement tempo:', error);
    return 0;
  }
};

/**
 * Check if piece is pinned in a given game state
 */
window.AIEngine.isPiecePinnedInState = function(piece, gameState) {
  try {
    // Temporarily remove the piece and check if hive stays connected
    const otherPieces = gameState.tray.filter(p => 
      p.placed && !(p.q === piece.q && p.r === piece.r)
    );
    
    return !this.areAllPiecesConnected(otherPieces);
  } catch (error) {
    console.error('🤖 Error checking if piece is pinned:', error);
    return false;
  }
};

/**
 * Check if all pieces are connected (for pin detection)
 */
window.AIEngine.areAllPiecesConnected = function(pieces) {
  try {
    if (pieces.length <= 1) return true;
    
    const visited = new Set();
    const queue = [pieces[0]];
    visited.add(`${pieces[0].q},${pieces[0].r}`);
    
    while (queue.length > 0) {
      const current = queue.shift();
      const neighbors = this.getNeighborCoords(current.q, current.r);
      
      for (const [nq, nr] of neighbors) {
        const key = `${nq},${nr}`;
        if (!visited.has(key)) {
          const neighborPiece = pieces.find(p => p.q === nq && p.r === nr);
          if (neighborPiece) {
            visited.add(key);
            queue.push(neighborPiece);
          }
        }
      }
    }
    
    return visited.size === pieces.length;
  } catch (error) {
    console.error('🤖 Error checking piece connectivity:', error);
    return true;
  }
};

  /**
   * Check if a piece can move to a given (q, r) position (basic rules, not full bug logic)
   * Used for pin/unpin and legal move detection. Should be side-effect free.
   */
  window.AIEngine.canPieceMoveTo = function(piece, q, r) {
    if (!piece || !piece.meta) return false;
    // Basic checks: destination must be adjacent, not occupied, and not the same cell
    if (piece.meta.q === q && piece.meta.r === r) return false;
    // Check if destination is adjacent
    const neighbors = this.getNeighborCoords(piece.meta.q, piece.meta.r);
    let isNeighbor = false;
    for (const [nq, nr] of neighbors) {
      if (nq === q && nr === r) {
        isNeighbor = true;
        break;
      }
    }
    if (!isNeighbor) return false;
    // Check if destination is occupied
    const occupied = tray.some(p => p.meta && p.meta.placed && p.meta.q === q && p.meta.r === r);
    if (occupied) return false;
    // For pin logic, ignore bug-specific movement rules (handled elsewhere)
    return true;
  };
/**
 * CIRCLING DEFENSE - Strategic positioning to protect Queen
 * Based on book's defensive strategy: "Creating circles next to Queen makes it difficult to surround"
 */
window.AIEngine.evaluateCirclingDefense = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let circlingValue = 0;
    
    // Find Queens
    const aiQueen = gameState.tray.find(p => p.placed && p.color === aiColor && p.key === 'Q');
    const oppQueen = gameState.tray.find(p => p.placed && p.color === oppColor && p.key === 'Q');
    
    if (aiQueen) {
      // Evaluate our defensive circles around our Queen
      const ourDefensiveCircles = this.evaluateQueenDefensiveCircles(aiQueen, gameState, aiColor);
      circlingValue += ourDefensiveCircles * 0.15;
    }
    
    if (oppQueen) {
      // Penalize opponent's defensive circles (harder for us to attack)
      const theirDefensiveCircles = this.evaluateQueenDefensiveCircles(oppQueen, gameState, oppColor);
      circlingValue -= theirDefensiveCircles * 0.12;
    }
    
    debugLog(`🔄 CIRCLING DEFENSE: Our defensive value: ${(aiQueen ? this.evaluateQueenDefensiveCircles(aiQueen, gameState, aiColor) : 0).toFixed(3)}, Theirs: ${(oppQueen ? this.evaluateQueenDefensiveCircles(oppQueen, gameState, oppColor) : 0).toFixed(3)}`);
    
    return Math.max(-0.2, Math.min(0.2, circlingValue));
    
  } catch (error) {
    debugLog('🤖 💥 Error in circling defense evaluation:', error);
    return 0;
  }
};

/**
 * Evaluate defensive circles around a Queen
 * From book: "Creating a circle next to a Queen makes it difficult to surround"
 */
window.AIEngine.evaluateQueenDefensiveCircles = function(queen, gameState, queenColor) {
  try {
    let defensiveValue = 0;
    
    // Get all hexes adjacent to the Queen
    const adjacentToQueen = this.getNeighborCoords(queen.q, queen.r);
    
    for (const [adjQ, adjR] of adjacentToQueen) {
      // For each hex adjacent to Queen, check if it's protected by a "circle"
      const circleProtection = this.evaluateHexCircleProtection(adjQ, adjR, gameState, queenColor);
      defensiveValue += circleProtection;
    }
    
    return defensiveValue;
  } catch (error) {
    console.error('🤖 Error evaluating Queen defensive circles:', error);
    return 0;
  }
};

/**
 * Evaluate how well a hex is protected by circling
 * From book: "if player is able to encircle one of the hexes next to his Queen, 
 * opponent may not move a piece to that place"
 */
window.AIEngine.evaluateHexCircleProtection = function(hexQ, hexR, gameState, defendingColor) {
  try {
    // Check if the hex is already occupied
    const occupant = gameState.tray.find(p => p.placed && p.q === hexQ && p.r === hexR);
    if (occupant) {
      // If occupied by our piece, it's protected. If by opponent, no protection value.
      return occupant.color === defendingColor ? 0.1 : 0;
    }
    
    // Count how many of the surrounding hexes are occupied by our pieces
    const surroundingCoords = this.getNeighborCoords(hexQ, hexR);
    let ourPiecesAround = 0;
    let totalPiecesAround = 0;
    
    for (const [sq, sr] of surroundingCoords) {
      const surroundingPiece = gameState.tray.find(p => p.placed && p.q === sq && p.r === sr);
      if (surroundingPiece) {
        totalPiecesAround++;
        if (surroundingPiece.color === defendingColor) {
          ourPiecesAround++;
        }
      }
    }
    
    // Calculate protection value based on how "circled" the hex is
    if (ourPiecesAround >= 5) {
      // Almost complete circle - very strong protection
      return 0.25; // Only Beetles and Grasshoppers can enter
    } else if (ourPiecesAround >= 4) {
      // Strong partial circle
      return 0.15;
    } else if (ourPiecesAround >= 3) {
      // Moderate protection
      return 0.08;
    } else if (ourPiecesAround >= 2) {
      // Weak protection
      return 0.03;
    }
    
    return 0;
  } catch (error) {
    console.error('🤖 Error evaluating hex circle protection:', error);
    return 0;
  }
};

/**
 * Estimate turn number from game state
 */
window.AIEngine.estimateTurnNumber = function(gameState) {
  try {
    const totalPieces = gameState.tray.filter(p => p.placed).length;
    return Math.floor(totalPieces / 2) + 1;
  } catch (error) {
    console.error('🤖 Error estimating turn number:', error);
    return 1;
  }
};

/**
 * Evaluate endgame factors
 */
window.AIEngine.evaluateEndgame = function(gameState, aiColor, oppColor) {
  try {
    // More robust gameState checking
    if (!gameState) {
      return 0;
    }
    
    // Handle both tray-based and cells-based game states
    let totalPieces = 0;
    let aiPieces = [];
    let oppPieces = [];
    let aiUnplaced = [];
    let oppUnplaced = [];
    
    if (gameState.tray && Array.isArray(gameState.tray)) {
      // Tray-based game state
      totalPieces = gameState.tray.filter(p => p && p.placed).length;
      aiPieces = gameState.tray.filter(p => p && p.placed && p.meta && p.meta.color === aiColor);
      oppPieces = gameState.tray.filter(p => p && p.placed && p.meta && p.meta.color === oppColor);
      aiUnplaced = gameState.tray.filter(p => p && !p.placed && p.meta && p.meta.color === aiColor);
      oppUnplaced = gameState.tray.filter(p => p && !p.placed && p.meta && p.meta.color === oppColor);
    } else if (gameState.cells) {
      // Cells-based game state (MCTS simulation)
      totalPieces = this.getTotalPiecesOnBoard(gameState);
      // For cells-based states, we can't easily get unplaced pieces, so skip some evaluations
      if (totalPieces >= 10) return 0; // Not endgame yet
    } else {
      return 0; // Unknown game state format
    }
    
    // Expert endgame detection - when fewer than 10 pieces on board
    if (totalPieces >= 10) return 0; // Not endgame yet
    
    let endgameScore = 0;
    
    // Find Queens - more robust search
    let aiQueen = null;
    let oppQueen = null;
    
    if (gameState.tray) {
      aiQueen = aiPieces.find(p => p && p.meta && p.meta.key === 'Q');
      oppQueen = oppPieces.find(p => p && p.meta && p.meta.key === 'Q');
    }
    
    if (!aiQueen || !oppQueen) {
      return 0; // Queens must be placed for endgame evaluation
    }
    
    // 1. BASIC THREAT ASSESSMENT (always works)
    const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
    const aiQueenThreats = this.countQueenThreats(gameState, aiColor);
    
    // Basic Queen threat evaluation
    if (oppQueenThreats >= 4) {
      endgameScore += 1.5; // Opponent Queen in serious danger
    } else if (oppQueenThreats >= 3) {
      endgameScore += 0.8; // Opponent Queen under pressure
    }
    
    if (aiQueenThreats >= 4) {
      endgameScore -= 1.5; // Our Queen in danger
    } else if (aiQueenThreats >= 3) {
      endgameScore -= 0.8; // Our Queen under pressure
    }
    
    // 2. ADVANCED ENDGAME TACTICS (only if we have full piece info)
    if (gameState.tray && aiUnplaced && oppUnplaced) {
      // HOPPER RESERVE TACTICS - "Keep hoppers in reserve for end moves"
      const aiHoppers = aiUnplaced.filter(p => p && p.meta && p.meta.key === 'G');
      const oppHoppers = oppUnplaced.filter(p => p && p.meta && p.meta.key === 'G');
      
      // If opponent Queen is getting surrounded, hoppers become game-winners
      if (oppQueenThreats >= 4) {
        endgameScore += aiHoppers.length * 2.0; // Massive hopper value
      } else if (oppQueenThreats >= 3) {
        endgameScore += aiHoppers.length * 1.0;
      }
      
      // BEETLE-ON-QUEEN STRATEGIES
      const aiBeetles = aiPieces.filter(p => p && p.meta && p.meta.key === 'B');
      for (const beetle of aiBeetles) {
        if (beetle && beetle.meta && oppQueen && oppQueen.meta) {
          const distToOppQueen = Math.abs(beetle.meta.q - oppQueen.meta.q) + 
                                Math.abs(beetle.meta.r - oppQueen.meta.r);
          if (distToOppQueen <= 2) {
            endgameScore += 1.5; // Beetle close to opponent Queen
            if (oppQueenThreats >= 3) {
              endgameScore += 1.0; // Beetle can stack for win
            }
          }
        }
      }
      
      // HOLDING SET BLOCKING
      const oppHasBeetles = oppUnplaced.some(p => p && p.meta && p.meta.key === 'B') || 
                           aiBeetles.length > 0;
      const oppHasHoppers = oppHoppers.length > 0;
      
      if (!oppHasBeetles && !oppHasHoppers && oppQueenThreats >= 3) {
        endgameScore += 1.0; // Opponent lacks mobile pieces for defense
      }
    }
    
    // 3. PIECE ACTIVITY (simplified but robust)
    try {
      const aiActivity = this.countAdvancedMobility(gameState, aiColor);
      const oppActivity = this.countAdvancedMobility(gameState, oppColor);
      endgameScore += (aiActivity - oppActivity) * 0.1;
    } catch (error) {
      // If mobility calculation fails, skip it
    }
    
    return Math.max(-5, Math.min(5, endgameScore)); // Clamp to reasonable range
    
  } catch (error) {
    console.error(`🤖 💥 ENDGAME ERROR: Exception in evaluateEndgame:`, error);
    return 0;
  }
};

/**
 * Helper functions for enhanced endgame evaluation
 */

/**
 * Check if a piece is trapped (cannot move)
 */
window.AIEngine.isPieceTrapped = function(piece, gameState) {
  // This would need access to legalMoveZones function
  if (typeof legalMoveZones === 'function') {
    const moves = legalMoveZones(piece);
    return moves.length === 0;
  }
  return false; // Assume not trapped if we can't check
};

/**
 * Count spaces around opponent Queen that can be blocked - robust version
 */
window.AIEngine.countBlockableSpacesAroundQueen = function(queen, gameState) {
  try {
    if (!queen || !queen.meta || !gameState) return 0;
    
    const neighbors = this.getNeighborCoords(queen.meta.q, queen.meta.r);
    let blockableCount = 0;
    
    for (const [nq, nr] of neighbors) {
      // Check if this space is empty and could be blocked
      let occupied = false;
      
      if (gameState.tray && Array.isArray(gameState.tray)) {
        occupied = gameState.tray.some(p => 
          p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
        );
      }
      
      if (!occupied) {
        blockableCount++;
      }
    }
    
    return blockableCount;
  } catch (error) {
    console.error(`🤖 💥 ERROR in countBlockableSpacesAroundQueen:`, error);
    return 0;
  }
};

/**
 * Get Queen escape routes - robust version
 */
window.AIEngine.getQueenEscapeRoutes = function(queen, gameState) {
  try {
    if (!queen || !queen.meta || !gameState) return [];
    
    const neighbors = this.getNeighborCoords(queen.meta.q, queen.meta.r);
    const escapeRoutes = [];
    
    for (const [nq, nr] of neighbors) {
      let occupied = false;
      
      if (gameState.tray && Array.isArray(gameState.tray)) {
        occupied = gameState.tray.some(p => 
          p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
        );
      }
      
      if (!occupied) {
        escapeRoutes.push({q: nq, r: nr});
      }
    }
    
    return escapeRoutes;
  } catch (error) {
    console.error(`🤖 💥 ERROR in getQueenEscapeRoutes:`, error);
    return [];
  }
};

/**
 * Evaluate control potential for medium+ difficulty
 */
window.AIEngine.evaluateControlPotential = function(pos, color, allPlacedPieces) {
  let control = 0;
  const neighbors = this.getNeighborCoords(pos.q, pos.r);
  
  for (const [nq, nr] of neighbors) {
    const piece = allPlacedPieces.find(p => p.meta.q === nq && p.meta.r === nr);
    if (!piece) {
      // Empty space - potential for expansion
      control += 0.1;
    } else if (piece.meta.color !== color) {
      // Opponent piece - potential for pressure
      control += 0.15;
    }
  }
  
  return control;
};

/**
 * Evaluate stacking opportunities for beetles
 */
window.AIEngine.evaluateStackingOpportunities = function(pos, allPlacedPieces) {
  let value = 0;
  const neighbors = this.getNeighborCoords(pos.q, pos.r);
  
  for (const [nq, nr] of neighbors) {
    // Check if there are stacked pieces nearby
    if (window.cells && window.cells.has(`${nq},${nr}`)) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell.stack.length > 1) {
        value += 0.2; // Near existing stacks
      } else if (cell.stack.length === 1) {
        value += 0.1; // Near single pieces (potential stacking targets)
      }
    }
  }
  
  return value;
};

/**
 * Evaluate jump chain opportunities for grasshoppers
 */
window.AIEngine.evaluateJumpChains = function(pos, allPlacedPieces) {
  let value = 0;
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]
  ];
  
  for (const [dq, dr] of directions) {
    let chainLength = 0;
    let currentQ = pos.q + dq;
    let currentR = pos.r + dr;
    
    // Count consecutive pieces in this direction
    while (true) {
      const piece = allPlacedPieces.find(p => p.meta.q === currentQ && p.meta.r === currentR);
      if (!piece) break;
      
      chainLength++;
      currentQ += dq;
      currentR += dr;
      
      if (chainLength >= 3) break; // Limit search
    }
    
    if (chainLength >= 2) {
      value += chainLength * 0.1; // Longer chains are more valuable
    }
  }
  
  return value;
};

/**
 * Evaluate spider positioning opportunities
 */
window.AIEngine.evaluateSpiderPositioning = function(pos, allPlacedPieces) {
  let value = 0;
  
  // Spider moves exactly 3 spaces - evaluate potential destinations
  const potentialMoves = this.simulateSpiderMoves(pos, allPlacedPieces);
  
  // Value based on number and quality of potential destinations
  value += potentialMoves.length * 0.05;
  
  // Bonus for central positioning
  const centerDistance = Math.abs(pos.q) + Math.abs(pos.r);
  if (centerDistance <= 2) {
    value += 0.1;
  }
  
  return value;
};

/**
 * Simulate spider moves for evaluation
 */
window.AIEngine.simulateSpiderMoves = function(pos, allPlacedPieces) {
  const destinations = [];
  
  // This is a simplified spider move simulation
  // In reality, spider moves exactly 3 steps around the hive perimeter
  const neighbors = this.getNeighborCoords(pos.q, pos.r);
  
  for (const [nq, nr] of neighbors) {
    const piece = allPlacedPieces.find(p => p.meta.q === nq && p.meta.r === nr);
    if (piece) {
      // Simulate moves around this piece
      const nextNeighbors = this.getNeighborCoords(nq, nr);
      for (const [nnq, nnr] of nextNeighbors) {
        if (nnq !== pos.q || nnr !== pos.r) { // Not back to start
          const targetPiece = allPlacedPieces.find(p => p.meta.q === nnq && p.meta.r === nnr);
          if (!targetPiece) {
            destinations.push([nnq, nnr]);
          }
        }
      }
    }
  }
  
  return destinations;
};

/**
 * Evaluate advanced patterns for medium+ difficulty
 */
window.AIEngine.evaluateAdvancedPatterns = function(gameState, aiColor, oppColor) {
  let value = 0;
  
  // 1. Piece coordination patterns
  value += this.evaluatePieceCoordination(gameState, aiColor) * 0.3;
  value -= this.evaluatePieceCoordination(gameState, oppColor) * 0.3;
  
  // 2. Formation integrity
  value += this.evaluateFormationIntegrity(gameState, aiColor) * 0.2;
  value -= this.evaluateFormationIntegrity(gameState, oppColor) * 0.2;
  
  // 3. Breakthrough potential
  value += this.evaluateBreakthroughPotential(gameState, aiColor) * 0.25;
  value -= this.evaluateBreakthroughPotential(gameState, oppColor) * 0.25;
  
  // 4. Defensive structure
  value += this.evaluateDefensiveStructure(gameState, aiColor) * 0.25;
  value -= this.evaluateDefensiveStructure(gameState, oppColor) * 0.25;
  
  return value;
};

/**
 * Evaluate piece coordination (how well pieces work together)
 */
window.AIEngine.evaluatePieceCoordination = function(gameState, color) {
  const pieces = gameState.tray.filter(p => p.color === color && p.placed);
  let coordination = 0;
  
  for (const piece of pieces) {
    const neighbors = this.getNeighborCoords(piece.q, piece.r);
    let friendlyNeighbors = 0;
    
    for (const [nq, nr] of neighbors) {
      const neighbor = pieces.find(p => p.q === nq && p.r === nr);
      if (neighbor) {
        friendlyNeighbors++;
        
        // Bonus for specific piece combinations
        if (piece.key === 'Q' && neighbor.key === 'B') coordination += 0.2; // Queen protected by beetle
        if (piece.key === 'A' && neighbor.key === 'S') coordination += 0.1; // Ant-spider combo
        if (piece.key === 'G' && neighbor.key === 'A') coordination += 0.1; // Grasshopper-ant combo
      }
    }
    
    // Connectivity bonus
    coordination += friendlyNeighbors * 0.05;
  }
  
  return coordination;
};

/**
 * Evaluate formation integrity
 */
window.AIEngine.evaluateFormationIntegrity = function(gameState, color) {
  const pieces = gameState.tray.filter(p => p.color === color && p.placed);
  if (pieces.length === 0) return 0;
  
  // Check if pieces form a compact group
  let integrity = 0;
  const averageDistance = this.calculateAverageDistance(pieces);
  
  // Prefer compact formations
  integrity += Math.max(0, 3 - averageDistance) * 0.1;
  
  // Check for isolated pieces
  for (const piece of pieces) {
    const friendlyNeighbors = this.countAdjacentFriendlyPieces(piece, color);
    if (friendlyNeighbors === 0) {
      integrity -= 0.2; // Penalty for isolated pieces
    }
  }
  
  return integrity;
};

/**
 * Evaluate breakthrough potential
 */
window.AIEngine.evaluateBreakthroughPotential = function(gameState, color) {
  const pieces = gameState.tray.filter(p => p.color === color && p.placed);
  let potential = 0;
  
  for (const piece of pieces) {
    if (piece.key === 'A') {
      // Ants have high breakthrough potential
      const mobility = this.countEmptyNeighbors(piece, gameState.tray.filter(p => p.placed));
      potential += mobility * 0.1;
    } else if (piece.key === 'G') {
      // Grasshoppers can jump over pieces
      const jumpOpps = this.countPotentialJumps(piece, gameState.tray.filter(p => p.placed));
      potential += jumpOpps * 0.15;
    }
  }
  
  return potential;
};

/**
 * Evaluate defensive structure
 */
window.AIEngine.evaluateDefensiveStructure = function(gameState, color) {
  const queen = gameState.tray.find(p => p.color === color && p.key === 'Q' && p.placed);
  if (!queen) return 0;
  
  let defense = 0;
  
  // Queen protection layers
  const layer1 = this.countAdjacentFriendlyPieces(queen, color);
  const layer2 = this.countSecondLayerProtection(queen, gameState, color);
  
  defense += layer1 * 0.2; // Direct protection
  defense += layer2 * 0.1; // Secondary protection
  
  // Escape routes
  const escapeRoutes = this.countEmptyNeighbors(queen, gameState.tray.filter(p => p.placed));
  defense += escapeRoutes * 0.1;
  
  return defense;
};

/**
 * Calculate average distance between pieces
 */
window.AIEngine.calculateAverageDistance = function(pieces) {
  if (pieces.length <= 1) return 0;
  
  let totalDistance = 0;
  let pairCount = 0;
  
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const distance = Math.abs(pieces[i].q - pieces[j].q) + Math.abs(pieces[i].r - pieces[j].r);
      totalDistance += distance;
      pairCount++;
    }
  }
  
  return pairCount > 0 ? totalDistance / pairCount : 0;
};

/**
 * CRITICAL: Check if a move will WIN the game by surrounding opponent Queen
 */
window.AIEngine.isWinningMove = function(move) {
  if (!move || move.type !== 'place') return false;
  
  try {
    // Find opponent Queen
    const oppColor = this.color === 'white' ? 'black' : 'white';
    const oppQueen = tray.find(p => 
      p.meta && p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed
    );
    
    if (!oppQueen) return false;
    
    // Count current threats around opponent Queen
    let threatsAfterMove = 0;
    const queenNeighbors = this.getNeighborCoords(oppQueen.meta.q, oppQueen.meta.r);
    
    for (const [nq, nr] of queenNeighbors) {
      // Check if neighbor is already occupied
      const occupied = tray.some(p => p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr);
      
      // Check if this move will occupy this neighbor
      if (move.q === nq && move.r === nr) {
        threatsAfterMove++;
      } else if (occupied) {
        threatsAfterMove++;
      }
    }
    
    debugLog(`🤖 👑 Winning check: ${threatsAfterMove}/6 neighbors would be threatened`);
    // More aggressive winning recognition
    if (threatsAfterMove >= 6) return true;  // Definite win
    if (threatsAfterMove >= 5) return true;  // Almost certain win - force it!
    return false;
    
  } catch (error) {
    console.error('🤖 Error in isWinningMove:', error);
    return false;
  }
};

/**
 * CRITICAL: Check if AI Queen is in immediate danger and this move saves it
 */
window.AIEngine.isEmergencyDefensive = function(move) {
  if (!move) return false;
  
  try {
    // Find AI Queen
    const aiQueen = tray.find(p => 
      p.meta && p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed
    );
    
    if (!aiQueen) return false;
    
    // Count current threats around AI Queen
    let currentThreats = 0;
    const queenNeighbors = this.getNeighborCoords(aiQueen.meta.q, aiQueen.meta.r);
    
    for (const [nq, nr] of queenNeighbors) {
      const occupied = tray.some(p => p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr);
      if (occupied) currentThreats++;
    }
    
    console.log(`🤖 🛡️ Defense check: AI Queen has ${currentThreats}/6 threats`);
    
    // Trigger personality mid-game response when AI Queen gets half-surrounded
    if (currentThreats === 3 && window.Personalities && !window.Personalities._midGameTriggered) {
      setTimeout(() => {
        window.Personalities.showVoiceLine('midGame');
        window.Personalities._midGameTriggered = true; // Prevent spam
      }, 1000);
    }
    
    // If Queen has 4+ threats, this is emergency territory
    if (currentThreats >= 4) {
      // CRITICAL: Queen in extreme danger! 
      console.log(`🤖 🛡️ CRITICAL: Queen has ${currentThreats}/6 threats - emergency action required!`);
      
      // Check if this move is a Queen move that escapes danger
      if (move.type === 'move' && move.piece && move.piece.meta.key === 'Q') {
        console.log(`🤖 🛡️ EMERGENCY: Moving Queen to escape danger!`);
        return true;
      }
      
      // Check if this move opens an escape route for our Queen
      if (move.type === 'move') {
        // Moving a piece that was blocking Queen's escape
        const fromQ = move.fromQ || (move.piece && move.piece.meta.q);
        const fromR = move.fromR || (move.piece && move.piece.meta.r);
        if (fromQ !== undefined && fromR !== undefined) {
          const wasBlockingEscape = queenNeighbors.some(([nq, nr]) => nq === fromQ && nr === fromR);
          if (wasBlockingEscape) {
            console.log(`🤖 🛡️ EMERGENCY: Moving piece to open Queen escape route!`);
            return true;
          }
        }
      }
    }
    
    // NEVER place pieces next to our own Queen when it's threatened!
    // This logic was backwards and causing the AI to surround its own Queen
    if (currentThreats >= 3) {
      // Check if this move would ADD a threat to our Queen (BAD!)
      const wouldThreatenOurQueen = queenNeighbors.some(([nq, nr]) => {
        return move.q === nq && move.r === nr;
      });
      
      if (wouldThreatenOurQueen) {
        console.log(`🤖 🛡️ DANGER: Move would threaten our own Queen - AVOIDING!`);
        return false; // This is NOT a good defensive move!
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('🤖 Error in isEmergencyDefensive:', error);
    return false;
  }
};

/**
 * CRITICAL: Calculate Queen-focused bonus for moves - MASSIVELY ENHANCED
 */
window.AIEngine.getQueenFocusBonus = function(move) {
  if (!move) return 0;
  
  try {
    let bonus = 0;
    const oppColor = this.color === 'white' ? 'black' : 'white';
    const difficulty = this.difficulty;
    
    // Difficulty multipliers for strategic thinking
    let strategicMultiplier = 1.0;
    if (difficulty === 'medium') strategicMultiplier = 1.8;
    else if (difficulty === 'hard') strategicMultiplier = 3.0; // MUCH more strategic
    
    // Find both Queens
    const oppQueen = tray.find(p => 
      p.meta && p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed
    );
    const aiQueen = tray.find(p => 
      p.meta && p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed
    );
    
    // Count threats to opponent Queen (declare at function level for reuse)
    let oppQueenThreats = 0;
    if (oppQueen) {
      const oppQueenNeighbors = this.getNeighborCoords(oppQueen.meta.q, oppQueen.meta.r);
      for (const [nq, nr] of oppQueenNeighbors) {
        const occupied = tray.some(p => p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr);
        if (occupied) oppQueenThreats++;
      }
    }
    
    // OFFENSIVE: MASSIVE bonus for moves that threaten opponent Queen
    if (oppQueen) {
      const distToOppQueen = Math.abs(move.q - oppQueen.meta.q) + Math.abs(move.r - oppQueen.meta.r);
      
      if (distToOppQueen === 1) {
        // This move would add a threat to opponent Queen
        const newThreatCount = oppQueenThreats + 1;
        
        // CRITICAL: Check if this piece was already threatening the queen
        let wasAlreadyThreatening = false;
        if (move.type === 'move' && move.piece && move.piece.meta) {
          const oldDist = Math.abs(move.piece.meta.q - oppQueen.meta.q) + Math.abs(move.piece.meta.r - oppQueen.meta.r);
          wasAlreadyThreatening = (oldDist === 1);
        }
        
        // Base threat bonus based on new threat count
        let threatBonus = 0;
        if (newThreatCount >= 6) {
          threatBonus = 20.0; // WINNING MOVE! 
          debugLog(`🤖 👑 WINNING: Move would surround opponent Queen (6/6)!`);
        } else if (newThreatCount >= 5) {
          threatBonus = 12.0; // ALMOST WINNING!
          debugLog(`🤖 👑 CRITICAL: Move would threaten opponent Queen (5/6)!`);
        } else if (newThreatCount >= 4) {
          threatBonus = 8.0; // MASSIVE pressure boost!
          console.log(`🤖 ⚔️ EXCELLENT: Strong threat to opponent Queen (4/6)!`);
        } else if (newThreatCount >= 3) {
          threatBonus = 5.0; // Strong pressure bonus
          console.log(`🤖 ⚔️ GOOD: Building pressure on opponent Queen (3/6)!`);
        } else {
          threatBonus = 3.0; // Starting pressure
          console.log(`🤖 ⚔️ PROGRESS: Starting to threaten opponent Queen!`);
        }
        
        // HUGE BONUS: Stay adjacent when already threatening (maintain pressure!)
        if (wasAlreadyThreatening) {
          threatBonus *= 1.5; // Extra bonus for staying close!
          console.log(`🤖 🎯 MAINTAIN PRESSURE: Staying adjacent to continue threatening!`);
        }
        
        // SPECIAL BONUS: Prefer moves that create MULTIPLE threats in one turn
        if (move.piece && move.piece.meta && move.piece.meta.key === 'B') {
          // Beetles can climb and block pieces - extra value for queen area control
          threatBonus += 2.0;
          console.log(`🤖 🪲 BEETLE SUPREMACY: Extra bonus for beetle threatening queen!`);
        }
        
        bonus += threatBonus * strategicMultiplier;
        
      } else if (distToOppQueen === 2) {
        // Check if we're moving AWAY from the queen when we could stay close
        if (move.type === 'move' && move.piece && move.piece.meta) {
          const oldDist = Math.abs(move.piece.meta.q - oppQueen.meta.q) + Math.abs(move.piece.meta.r - oppQueen.meta.r);
          if (oldDist === 1) {
            // PENALTY: We're moving AWAY from threatening the queen!
            bonus -= 3.0 * strategicMultiplier;
            console.log(`🤖 ❌ BACKING OFF: Moving away from queen threat - BAD!`);
          } else {
            bonus += 0.4 * strategicMultiplier; // Normal positioning
          }
        } else {
          bonus += 0.4 * strategicMultiplier; // Positioning for future threat
        }
      } else if (distToOppQueen === 3) {
        // Check if we're moving further away
        if (move.type === 'move' && move.piece && move.piece.meta) {
          const oldDist = Math.abs(move.piece.meta.q - oppQueen.meta.q) + Math.abs(move.piece.meta.r - oppQueen.meta.r);
          if (oldDist <= 2) {
            // PENALTY: Moving away from good position
            bonus -= 1.5 * strategicMultiplier;
            console.log(`🤖 ⚠️ RETREATING: Moving further from queen attack - suboptimal!`);
          } else {
            bonus += 0.1 * strategicMultiplier; // Distant positioning
          }
        } else {
          bonus += 0.1 * strategicMultiplier; // Distant positioning
        }
      } else if (distToOppQueen >= 4 && move.type === 'move' && move.piece && move.piece.meta) {
        // Big penalty for moving very far away from queen attacks
        const oldDist = Math.abs(move.piece.meta.q - oppQueen.meta.q) + Math.abs(move.piece.meta.r - oppQueen.meta.r);
        if (oldDist <= 2) {
          bonus -= 2.0 * strategicMultiplier;
          console.log(`🤖 ❌ ABANDONING ATTACK: Moving far away from queen pressure!`);
        }
      }
    }
    
    // DEFENSIVE: MASSIVE PENALTY for moves that expose our Queen!
    if (aiQueen) {
      const distToAiQueen = Math.abs(move.q - aiQueen.meta.q) + Math.abs(move.r - aiQueen.meta.r);
      
      // Count current threats to AI Queen
      let currentThreats = 0;
      const queenNeighbors = this.getNeighborCoords(aiQueen.meta.q, aiQueen.meta.r);
      
      for (const [nq, nr] of queenNeighbors) {
        const occupied = tray.some(p => p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr);
        if (occupied) currentThreats++;
      }
      
      if (distToAiQueen === 1) {
        // This move is adjacent to our Queen - CHECK IF IT'S SAFE
        const newThreatCount = currentThreats + (move.type === 'place' ? 1 : 0);
        
        if (newThreatCount >= 5) {
          bonus -= 10.0 * strategicMultiplier; // CATASTROPHIC - almost lost!
          console.log(`🤖 💀 CATASTROPHIC: Move would almost surround our Queen (5/6)!`);
        } else if (newThreatCount >= 4) {
          bonus -= 5.0 * strategicMultiplier; // VERY DANGEROUS 
          console.log(`🤖 � DANGEROUS: Move would heavily threaten our Queen (4/6)!`);
        } else if (newThreatCount >= 3) {
          // Check if opponent Queen is also under pressure (mutual threat situation)
          const oppHasPressure = oppQueen ? oppQueenThreats >= 3 : false;
          const penalty = oppHasPressure ? 0.8 : 2.5; // Much less penalty if we're winning the race
          bonus -= penalty * strategicMultiplier;
          console.log(`🤖 ⚠️ RISKY: Move would threaten our Queen (3/6)!`);
        } else {
          // Only small penalty if Queen isn't in immediate danger
          bonus -= 0.5 * strategicMultiplier;
        }
      }
      
      // Bonus for defending our Queen when it's in danger
      if (currentThreats >= 3 && distToAiQueen === 2) {
        bonus += 1.0 * strategicMultiplier; // Good defensive positioning
        console.log(`🤖 🛡️ DEFENSIVE: Good position to defend our Queen!`);
      }
    }
    
    return Math.max(-5.0, Math.min(10.0, bonus)); // Cap the bonus range
    
  } catch (error) {
    console.error('🤖 Error in getQueenFocusBonus:', error);
    return 0;
  }
};

/**
 * CRITICAL: Analyze Queen threats for a move
 */
window.AIEngine.analyzeQueenThreats = function(move) {
  if (!move) return 'none';
  
  try {
    const oppColor = this.color === 'white' ? 'black' : 'white';
    const oppQueen = tray.find(p => 
      p.meta && p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed
    );
    
    if (!oppQueen) return 'no-queen';
    
    const distToOppQueen = Math.abs(move.q - oppQueen.meta.q) + Math.abs(move.r - oppQueen.meta.r);
    
    if (distToOppQueen === 1) return 'threatens-queen';
    if (distToOppQueen === 2) return 'near-queen';
    if (distToOppQueen <= 3) return 'approaching-queen';
    return 'distant';
    
  } catch (error) {
    return 'error';
  }
};

/**
 * Count second layer protection around a piece
 */
window.AIEngine.countSecondLayerProtection = function(piece, gameState, color) {
  let protection = 0;
  const neighbors = this.getNeighborCoords(piece.q, piece.r);
  
  for (const [nq, nr] of neighbors) {
    const secondLayerNeighbors = this.getNeighborCoords(nq, nr);
    for (const [nnq, nnr] of secondLayerNeighbors) {
      if (nnq === piece.q && nnr === piece.r) continue; // Skip the original piece
      
      const protector = gameState.tray.find(p => 
        p.placed && p.color === color && p.q === nnq && p.r === nnr
      );
      if (protector) protection++;
    }
  }
  
  return protection;
};

// Initialize AI engine when script loads
console.log('🤖 AI Engine loaded successfully');

/**
 * ADVANCED HEURISTICS: Evaluate piece coordination and synergy
 */
window.AIEngine.evaluatePieceCoordination = function(gameState, aiColor, oppColor) {
  try {
    let coordination = 0;
    
    if (!gameState || !gameState.tray) return 0;
    
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    const oppPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === oppColor
    );
    
    // AI piece coordination
    for (let i = 0; i < aiPieces.length; i++) {
      for (let j = i + 1; j < aiPieces.length; j++) {
        const piece1 = aiPieces[i];
        const piece2 = aiPieces[j];
        
        if (piece1.meta && piece2.meta) {
          const distance = Math.abs(piece1.meta.q - piece2.meta.q) + Math.abs(piece1.meta.r - piece2.meta.r);
          
          // Reward nearby pieces (mutual support)
          if (distance <= 2) {
            coordination += 0.2;
            
            // Special coordination bonuses
            if ((piece1.meta.key === 'A' && piece2.meta.key === 'S') ||
                (piece1.meta.key === 'S' && piece2.meta.key === 'A')) {
              coordination += 0.3; // Ant-Spider coordination
            }
            
            if (piece1.meta.key === 'B' || piece2.meta.key === 'B') {
              coordination += 0.25; // Beetle is versatile
            }
          }
        }
      }
    }
    
    // Opponent piece coordination (negative)
    for (let i = 0; i < oppPieces.length; i++) {
      for (let j = i + 1; j < oppPieces.length; j++) {
        const piece1 = oppPieces[i];
        const piece2 = oppPieces[j];
        
        if (piece1.meta && piece2.meta) {
          const distance = Math.abs(piece1.meta.q - piece2.meta.q) + Math.abs(piece1.meta.r - piece2.meta.r);
          
          if (distance <= 2) {
            coordination -= 0.15; // Penalize opponent coordination
          }
        }
      }
    }
    
    return Math.max(-2.0, Math.min(2.0, coordination));
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluatePieceCoordination:`, error);
    return 0;
  }
};

/**
 * ADVANCED HEURISTICS: Evaluate central board control
 */
window.AIEngine.evaluateCentralControl = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let centralControl = 0;
    const centerRadius = 3; // Consider positions within 3 of origin as "central"
    
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    const oppPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === oppColor
    );
    
    // AI central control
    for (const piece of aiPieces) {
      if (piece.meta) {
        const distanceFromCenter = Math.abs(piece.meta.q) + Math.abs(piece.meta.r);
        if (distanceFromCenter <= centerRadius) {
          const centralValue = (centerRadius - distanceFromCenter + 1) / centerRadius;
          centralControl += centralValue * 0.3;
          
          // Extra bonus for key pieces in center
          if (piece.meta.key === 'A') centralControl += 0.2; // Ants control edges well from center
          if (piece.meta.key === 'S') centralControl += 0.15; // Spiders have good mobility from center
        }
      }
    }
    
    // Opponent central control (negative)
    for (const piece of oppPieces) {
      if (piece.meta) {
        const distanceFromCenter = Math.abs(piece.meta.q) + Math.abs(piece.meta.r);
        if (distanceFromCenter <= centerRadius) {
          const centralValue = (centerRadius - distanceFromCenter + 1) / centerRadius;
          centralControl -= centralValue * 0.25;
        }
      }
    }
    
    return Math.max(-1.5, Math.min(1.5, centralControl));
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateCentralControl:`, error);
    return 0;
  }
};

/**
 * ADVANCED HEURISTICS: Evaluate piece network connectivity
 */
window.AIEngine.evaluatePieceNetwork = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let networkStrength = 0;
    
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    const oppPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === oppColor
    );
    
    // AI network analysis
    for (const piece of aiPieces) {
      if (piece.meta) {
        const neighbors = this.getNeighborCoords(piece.meta.q, piece.meta.r);
        let friendlyNeighbors = 0;
        let supportingPieces = 0;
        
        for (const [nq, nr] of neighbors) {
          const neighbor = gameState.tray.find(p => 
            p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
          );
          
          if (neighbor && neighbor.meta) {
            if (neighbor.meta.color === aiColor) {
              friendlyNeighbors++;
              
              // Bonus for specific piece combinations
              if ((piece.meta.key === 'Q' && neighbor.meta.key === 'B') ||
                  (piece.meta.key === 'B' && neighbor.meta.key === 'Q')) {
                supportingPieces += 0.5; // Queen-Beetle synergy
              }
              
              if ((piece.meta.key === 'A' && neighbor.meta.key === 'S') ||
                  (piece.meta.key === 'S' && neighbor.meta.key === 'A')) {
                supportingPieces += 0.4; // Ant-Spider synergy
              }
            }
          }
        }
        
        // Reward well-connected pieces
        networkStrength += friendlyNeighbors * 0.1 + supportingPieces;
        
        // Penalty for isolated pieces
        if (friendlyNeighbors === 0) {
          networkStrength -= 0.3;
        }
      }
    }
    
    // Opponent network (negative evaluation)
    for (const piece of oppPieces) {
      if (piece.meta) {
        const neighbors = this.getNeighborCoords(piece.meta.q, piece.meta.r);
        let friendlyNeighbors = 0;
        
        for (const [nq, nr] of neighbors) {
          const neighbor = gameState.tray.find(p => 
            p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr && p.meta.color === oppColor
          );
          if (neighbor) friendlyNeighbors++;
        }
        
        networkStrength -= friendlyNeighbors * 0.08;
      }
    }
    
    return Math.max(-2.0, Math.min(2.0, networkStrength));
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluatePieceNetwork:`, error);
    return 0;
  }
};

/**
 * ADVANCED TACTICAL: Sophisticated pin analysis with strategic context
 */
window.AIEngine.evaluateAdvancedPinning = function(gameState, aiColor, oppColor) {
  try {
    let pinValue = 0;
    
    // Count opponent pins (good for us)
    const oppPins = this.countPins(gameState, oppColor);
    pinValue += oppPins * 0.5;
    
    // Count our pins (context-dependent)
    const ourPins = this.countPins(gameState, aiColor);
    
    const aiQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === aiColor && p.meta.key === 'Q'
    );
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
    );
    
    if (aiQueen && aiQueen.meta && oppQueen && oppQueen.meta) {
      const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
      const aiQueenThreats = this.countQueenThreats(gameState, aiColor);
      
      // Strategic pin evaluation
      if (oppQueenThreats >= 5) {
        pinValue -= ourPins * 0.05; // Almost winning - pins don't matter
      } else if (oppQueenThreats >= 4) {
        pinValue -= ourPins * 0.1; // Winning position - acceptable pins
      } else if (oppQueenThreats >= 3) {
        pinValue -= ourPins * 0.25; // Good position - moderate pin penalty
      } else if (aiQueenThreats >= 4) {
        pinValue -= ourPins * 0.6; // Danger - need mobility
      } else {
        pinValue -= ourPins * 0.3; // Normal penalty
      }
    } else {
      pinValue -= ourPins * 0.2; // Early game - pins less critical
    }
    
    return pinValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateAdvancedPinning:`, error);
    return 0;
  }
};

/**
 * ADVANCED TACTICAL: Fork threat evaluation
 */
window.AIEngine.evaluateForkThreats = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let forkValue = 0;
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    
    // Look for potential fork positions for our pieces
    for (const piece of aiPieces) {
      if (!piece.meta) continue;
      
      const possibleMoves = this.getPossibleMoves(piece, gameState);
      
      for (const move of possibleMoves) {
        const threatenedPieces = this.getThreatenedPieces(move.q, move.r, oppColor, gameState);
        
        if (threatenedPieces.length >= 2) {
          forkValue += 0.8; // Strong fork opportunity
          
          // Extra bonus for forking Queen + other piece
          const threatsQueen = threatenedPieces.some(p => p.meta && p.meta.key === 'Q');
          if (threatsQueen) {
            forkValue += 1.2; // Devastating fork
          }
        }
      }
    }
    
    // Subtract opponent fork threats against us
    const oppPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === oppColor
    );
    
    for (const piece of oppPieces) {
      if (!piece.meta) continue;
      
      const possibleMoves = this.getPossibleMoves(piece, gameState);
      
      for (const move of possibleMoves) {
        const threatenedPieces = this.getThreatenedPieces(move.q, move.r, aiColor, gameState);
        
        if (threatenedPieces.length >= 2) {
          forkValue -= 0.6; // Opponent fork threat
          
          const threatsQueen = threatenedPieces.some(p => p.meta && p.meta.key === 'Q');
          if (threatsQueen) {
            forkValue -= 1.0; // Dangerous opponent fork
          }
        }
      }
    }
    
    return forkValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateForkThreats:`, error);
    return 0;
  }
};

/**
 * ADVANCED TACTICAL: Tempo and forcing move evaluation
 */
window.AIEngine.evaluateTempoMoves = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let tempoValue = 0;
    
    // Moves that force opponent responses
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    
    for (const piece of aiPieces) {
      if (!piece.meta) continue;
      
      const possibleMoves = this.getPossibleMoves(piece, gameState);
      
      for (const move of possibleMoves) {
        // Check if this move creates immediate threats
        const immediateThreats = this.countImmediateThreats(move.q, move.r, oppColor, gameState);
        
        if (immediateThreats > 0) {
          tempoValue += immediateThreats * 0.3; // Forcing moves
          
          // Bonus for tempo moves that also improve our position
          const positionalGain = this.evaluatePositionalGain(move, gameState, aiColor);
          tempoValue += positionalGain * 0.2;
        }
      }
    }
    
    return tempoValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateTempoMoves:`, error);
    return 0;
  }
};

/**
 * ADVANCED TACTICAL: Blockade pattern evaluation
 */
window.AIEngine.evaluateBlockadePatterns = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let blockadeValue = 0;
    
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
    );
    
    if (oppQueen && oppQueen.meta) {
      // Evaluate how well we're blockading the opponent Queen
      const neighbors = this.getNeighborCoords(oppQueen.meta.q, oppQueen.meta.r);
      let blockedNeighbors = 0;
      let ourBlockingPieces = 0;
      
      for (const [nq, nr] of neighbors) {
        const neighbor = gameState.tray.find(p => 
          p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
        );
        
        if (neighbor && neighbor.meta) {
          blockedNeighbors++;
          if (neighbor.meta.color === aiColor) {
            ourBlockingPieces++;
          }
        }
      }
      
      // Reward having many pieces around opponent Queen
      blockadeValue += ourBlockingPieces * 0.4;
      
      // Special bonus for nearly complete blockades
      if (blockedNeighbors >= 5) {
        blockadeValue += 1.5; // Almost checkmate
      } else if (blockedNeighbors >= 4) {
        blockadeValue += 0.8; // Strong blockade
      }
    }
    
    return blockadeValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateBlockadePatterns:`, error);
    return 0;
  }
};

/**
 * ADVANCED TACTICAL: Escape route control evaluation
 */
window.AIEngine.evaluateEscapeRouteControl = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let escapeControl = 0;
    
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
    );
    
    if (oppQueen && oppQueen.meta) {
      // Count escape routes for opponent Queen
      const escapeRoutes = this.getQueenEscapeRoutes(gameState, oppColor);
      
      // Fewer escape routes = better for us
      if (escapeRoutes <= 1) {
        escapeControl += 2.0; // Almost trapped
      } else if (escapeRoutes <= 2) {
        escapeControl += 1.2; // Very limited
      } else if (escapeRoutes <= 3) {
        escapeControl += 0.6; // Somewhat limited
      }
      
      // Check how many of remaining routes we can cover
      const controllableRoutes = this.countControllableEscapeRoutes(gameState, aiColor, oppQueen);
      escapeControl += controllableRoutes * 0.3;
    }
    
    return escapeControl;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateEscapeRouteControl:`, error);
    return 0;
  }
};

/**
 * ADVANCED TACTICAL: Sacrifice opportunity evaluation
 */
window.AIEngine.evaluateSacrificeOpportunities = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let sacrificeValue = 0;
    
    // Look for beneficial piece trades or sacrifices
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    
    for (const piece of aiPieces) {
      if (!piece.meta) continue;
      
      // Calculate if sacrificing this piece leads to Queen capture
      const sacrificeGain = this.calculateSacrificeGain(piece, gameState, aiColor, oppColor);
      
      if (sacrificeGain > 0) {
        sacrificeValue += sacrificeGain;
      }
    }
    
    return sacrificeValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateSacrificeOpportunities:`, error);
    return 0;
  }
};

/**
 * HELPER: Get possible moves for a piece (simplified for tactical analysis)
 */
window.AIEngine.getPossibleMoves = function(piece, gameState) {
  try {
    if (!piece || !piece.meta) return [];
    
    const moves = [];
    const neighbors = this.getNeighborCoords(piece.meta.q, piece.meta.r);
    
    // Simplified: just check adjacent positions
    for (const [nq, nr] of neighbors) {
      const occupied = gameState.tray.some(p => 
        p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
      );
      
      if (!occupied) {
        moves.push({q: nq, r: nr});
      }
    }
    
    return moves;
  } catch (error) {
    console.error(`🤖 💥 ERROR in getPossibleMoves:`, error);
    return [];
  }
};

/**
 * HELPER: Get pieces threatened by a position
 */
window.AIEngine.getThreatenedPieces = function(q, r, targetColor, gameState) {
  try {
    const threatened = [];
    const neighbors = this.getNeighborCoords(q, r);
    
    for (const [nq, nr] of neighbors) {
      const piece = gameState.tray.find(p => 
        p && p.placed && p.meta && p.meta.color === targetColor && 
        p.meta.q === nq && p.meta.r === nr
      );
      
      if (piece) {
        threatened.push(piece);
      }
    }
    
    return threatened;
  } catch (error) {
    console.error(`🤖 💥 ERROR in getThreatenedPieces:`, error);
    return [];
  }
};

/**
 * HELPER: Count immediate threats from a position
 */
window.AIEngine.countImmediateThreats = function(q, r, targetColor, gameState) {
  try {
    const threatened = this.getThreatenedPieces(q, r, targetColor, gameState);
    let threats = threatened.length;
    
    // Extra weight for threatening Queen
    const threatsQueen = threatened.some(p => p.meta && p.meta.key === 'Q');
    if (threatsQueen) {
      threats += 2; // Queen threats are more significant
    }
    
    return threats;
  } catch (error) {
    console.error(`🤖 💥 ERROR in countImmediateThreats:`, error);
    return 0;
  }
};

/**
 * HELPER: Evaluate positional gain from a move
 */
window.AIEngine.evaluatePositionalGain = function(move, gameState, color) {
  try {
    let gain = 0;
    
    // Central positions are better
    const centralValue = 3 - (Math.abs(move.q) + Math.abs(move.r)) * 0.1;
    gain += Math.max(0, centralValue) * 0.1;
    
    // Positions near opponent Queen are valuable
    const oppColor = color === 'white' ? 'black' : 'white';
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
    );
    
    if (oppQueen && oppQueen.meta) {
      const distToOppQueen = Math.abs(move.q - oppQueen.meta.q) + Math.abs(move.r - oppQueen.meta.r);
      if (distToOppQueen <= 2) {
        gain += (3 - distToOppQueen) * 0.2;
      }
    }
    
    return gain;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluatePositionalGain:`, error);
    return 0;
  }
};

/**
 * HELPER: Count controllable escape routes
 */
window.AIEngine.countControllableEscapeRoutes = function(gameState, aiColor, oppQueen) {
  try {
    if (!oppQueen || !oppQueen.meta) return 0;
    
    let controllable = 0;
    const neighbors = this.getNeighborCoords(oppQueen.meta.q, oppQueen.meta.r);
    
    for (const [nq, nr] of neighbors) {
      const occupied = gameState.tray.some(p => 
        p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
      );
      
      if (!occupied) {
        // Check if we can move a piece to control this escape route
        const canControl = this.canControlPosition(nq, nr, aiColor, gameState);
        if (canControl) {
          controllable++;
        }
      }
    }
    
    return controllable;
  } catch (error) {
    console.error(`🤖 💥 ERROR in countControllableEscapeRoutes:`, error);
    return 0;
  }
};

/**
 * HELPER: Check if we can control a position
 */
window.AIEngine.canControlPosition = function(q, r, color, gameState) {
  try {
    const ourPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === color
    );
    
    for (const piece of ourPieces) {
      if (!piece.meta) continue;
      
      const distance = Math.abs(piece.meta.q - q) + Math.abs(piece.meta.r - r);
      
      // Simplified: if piece is adjacent and can move
      if (distance === 1) {
        return true;
      }
      
      // Ants can potentially reach many positions
      if (piece.meta.key === 'A' && distance <= 3) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`🤖 💥 ERROR in canControlPosition:`, error);
    return false;
  }
};

/**
 * HELPER: Calculate sacrifice gain
 */
window.AIEngine.calculateSacrificeGain = function(piece, gameState, aiColor, oppColor) {
  try {
    if (!piece || !piece.meta) return 0;
    
    // Simple heuristic: sacrificing a piece near opponent Queen
    // might be worth it if it leads to Queen capture
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
    );
    
    if (oppQueen && oppQueen.meta) {
      const distance = Math.abs(piece.meta.q - oppQueen.meta.q) + Math.abs(piece.meta.r - oppQueen.meta.r);
      
      if (distance === 1) {
        // Piece adjacent to opponent Queen - might be worth sacrificing
        const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
        
        if (oppQueenThreats >= 4) {
          return 3.0; // Sacrifice to deliver checkmate
        } else if (oppQueenThreats >= 3) {
          return 1.5; // Sacrifice to get very close to checkmate
        }
      }
    }
    
    return 0;
  } catch (error) {
    console.error(`🤖 💥 ERROR in calculateSacrificeGain:`, error);
    return 0;
  }
};

/**
 * TACTICAL LOOKAHEAD: Analyze forced sequences and tactical motifs
 */
window.AIEngine.evaluateTacticalLookahead = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let tacticalScore = 0;
    
    // 1. CHECKMATE THREATS - immediate Queen capture opportunities
    const checkmateThreats = this.analyzeCheckmateThreats(gameState, aiColor, oppColor);
    tacticalScore += checkmateThreats * 5.0; // Massive weight for checkmate
    
    // 2. FORCED SEQUENCES - moves that compel opponent responses
    const forcedSequences = this.analyzeForcedSequences(gameState, aiColor, oppColor);
    tacticalScore += forcedSequences * 2.0;
    
    // 3. TACTICAL COMBINATIONS - multi-move patterns
    const combinations = this.analyzeTacticalCombinations(gameState, aiColor, oppColor);
    tacticalScore += combinations * 1.5;
    
    // 4. DEFENSIVE TACTICS - counter-threats and escapes
    const defensiveTactics = this.analyzeDefensiveTactics(gameState, aiColor, oppColor);
    tacticalScore += defensiveTactics * 1.0;
    
    return Math.max(-5.0, Math.min(5.0, tacticalScore));
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateTacticalLookahead:`, error);
    return 0;
  }
};

/**
 * Analyze immediate checkmate threats (simplified for now)
 */
window.AIEngine.analyzeCheckmateThreats = function(gameState, aiColor, oppColor) {
  try {
    let checkmateValue = 0;
    
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
    );
    
    if (oppQueen && oppQueen.meta) {
      const currentThreats = this.countQueenThreats(gameState, oppColor);
      
      // Check if we can deliver checkmate in 1 move
      if (currentThreats >= 5) {
        checkmateValue += 10.0; // Immediate checkmate available
      } else if (currentThreats >= 4) {
        checkmateValue += 5.0; // Very close to checkmate
      } else if (currentThreats >= 3) {
        checkmateValue += 2.0; // Building toward checkmate
      }
    }
    
    return checkmateValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in analyzeCheckmateThreats:`, error);
    return 0;
  }
};

/**
 * Analyze forced sequences (simplified)
 */
window.AIEngine.analyzeForcedSequences = function(gameState, aiColor, oppColor) {
  try {
    let forcedValue = 0;
    
    // Look for moves that create multiple simultaneous threats
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    
    for (const piece of aiPieces) {
      if (!piece.meta) continue;
      
      const possibleMoves = this.getPossibleMoves(piece, gameState);
      
      for (const move of possibleMoves) {
        const threatsCreated = this.countImmediateThreats(move.q, move.r, oppColor, gameState);
        
        if (threatsCreated >= 2) {
          forcedValue += 1.0; // Multiple threats = forced response
        }
      }
    }
    
    return forcedValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in analyzeForcedSequences:`, error);
    return 0;
  }
};

/**
 * Analyze tactical combinations (simplified)
 */
window.AIEngine.analyzeTacticalCombinations = function(gameState, aiColor, oppColor) {
  try {
    let combinationValue = 0;
    
    // Simple combination detection - pieces that support each other
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    
    for (let i = 0; i < aiPieces.length; i++) {
      for (let j = i + 1; j < aiPieces.length; j++) {
        const piece1 = aiPieces[i];
        const piece2 = aiPieces[j];
        
        if (piece1.meta && piece2.meta) {
          const distance = Math.abs(piece1.meta.q - piece2.meta.q) + Math.abs(piece1.meta.r - piece2.meta.r);
          
          if (distance <= 2) {
            // Close pieces can form combinations
            combinationValue += 0.3;
          }
        }
      }
    }
    
    return combinationValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in analyzeTacticalCombinations:`, error);
    return 0;
  }
};

/**
 * Analyze defensive tactics (simplified)
 */
window.AIEngine.analyzeDefensiveTactics = function(gameState, aiColor, oppColor) {
  try {
    let defensiveValue = 0;
    
    const aiQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === aiColor && p.meta.key === 'Q'
    );
    
    if (aiQueen && aiQueen.meta) {
      const aiQueenThreats = this.countQueenThreats(gameState, aiColor);
      
      if (aiQueenThreats >= 4) {
        // Our Queen in danger - defensive value for escape routes
        const escapeRoutes = this.getQueenEscapeRoutes(gameState, aiColor);
        defensiveValue += Math.max(0, escapeRoutes) * 1.0;
      }
    }
    
    return defensiveValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in analyzeDefensiveTactics:`, error);
    return 0;
  }
};

/**
 * ADVANCED ENDGAME: Specialized analysis for endgame positions
 */
window.AIEngine.evaluateAdvancedEndgame = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) return 0;
    
    let endgameValue = 0;
    const totalPieces = this.getTotalPiecesOnBoard(gameState);
    
    // Only apply in true endgame (8 or fewer pieces)
    if (totalPieces > 8) return 0;
    
    // 1. KING SAFETY PATTERNS - evaluate Queen safety in endgame
    const kingSafety = this.evaluateEndgameKingSafety(gameState, aiColor, oppColor);
    endgameValue += kingSafety * 2.0;
    
    // 2. PIECE ACTIVITY - mobile pieces are crucial in endgame
    const pieceActivity = this.evaluateEndgamePieceActivity(gameState, aiColor, oppColor);
    endgameValue += pieceActivity * 1.5;
    
    // 3. MATERIAL IMBALANCES - different piece values in endgame
    const materialImbalance = this.evaluateEndgameMaterial(gameState, aiColor, oppColor);
    endgameValue += materialImbalance * 1.8;
    
    // 4. OPPOSITION AND TEMPO - controlling key squares
    const opposition = this.evaluateEndgameOpposition(gameState, aiColor, oppColor);
    endgameValue += opposition * 1.3;
    
    // 5. CHECKMATE PATTERNS - specific endgame checkmate motifs
    const checkmatePatterns = this.evaluateEndgameCheckmatePatterns(gameState, aiColor, oppColor);
    endgameValue += checkmatePatterns * 3.0;
    
    return Math.max(-3.0, Math.min(3.0, endgameValue));
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateAdvancedEndgame:`, error);
    return 0;
  }
};

/**
 * Evaluate King safety in endgame
 */
window.AIEngine.evaluateEndgameKingSafety = function(gameState, aiColor, oppColor) {
  try {
    let safety = 0;
    
    const aiQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === aiColor && p.meta.key === 'Q'
    );
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
    );
    
    if (aiQueen && aiQueen.meta && oppQueen && oppQueen.meta) {
      const aiQueenThreats = this.countQueenThreats(gameState, aiColor);
      const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
      
      // In endgame, Queen safety is paramount
      if (oppQueenThreats >= 4) {
        safety += 2.0; // Opponent Queen in serious danger
      } else if (oppQueenThreats >= 3) {
        safety += 1.0; // Building pressure
      }
      
      if (aiQueenThreats >= 4) {
        safety -= 2.5; // Our Queen in serious danger
      } else if (aiQueenThreats >= 3) {
        safety -= 1.2; // Under pressure
      }
      
      // Distance between Queens matters in endgame
      const queenDistance = Math.abs(aiQueen.meta.q - oppQueen.meta.q) + Math.abs(aiQueen.meta.r - oppQueen.meta.r);
      if (queenDistance <= 3) {
        safety += 0.5; // Close combat favors active play
      }
    }
    
    return safety;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateEndgameKingSafety:`, error);
    return 0;
  }
};

/**
 * Evaluate piece activity in endgame
 */
window.AIEngine.evaluateEndgamePieceActivity = function(gameState, aiColor, oppColor) {
  try {
    let activity = 0;
    
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    const oppPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === oppColor
    );
    
    // Count mobile pieces (pieces that can potentially move)
    for (const piece of aiPieces) {
      if (!piece.meta) continue;
      
      const mobility = this.calculatePieceMobility(piece, gameState);
      activity += mobility * this.getEndgamePieceValue(piece.meta.key);
    }
    
    for (const piece of oppPieces) {
      if (!piece.meta) continue;
      
      const mobility = this.calculatePieceMobility(piece, gameState);
      activity -= mobility * this.getEndgamePieceValue(piece.meta.key);
    }
    
    return activity;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateEndgamePieceActivity:`, error);
    return 0;
  }
};

/**
 * Get piece values adjusted for endgame
 */
window.AIEngine.getEndgamePieceValue = function(pieceKey) {
  switch (pieceKey) {
    case 'Q': return 0.1; // Queen doesn't capture in Hive
    case 'A': return 0.8; // Ants very valuable for mobility
    case 'S': return 0.7; // Spiders good for tactics
    case 'G': return 0.6; // Grasshoppers good for jumping
    case 'B': return 0.5; // Beetles useful but slower
    default: return 0.3;
  }
};

/**
 * Calculate basic piece mobility
 */
window.AIEngine.calculatePieceMobility = function(piece, gameState) {
  try {
    if (!piece || !piece.meta) return 0;
    
    const neighbors = this.getNeighborCoords(piece.meta.q, piece.meta.r);
    let mobility = 0;
    
    for (const [nq, nr] of neighbors) {
      const occupied = gameState.tray.some(p => 
        p && p.placed && p.meta && p.meta.q === nq && p.meta.r === nr
      );
      
      if (!occupied) {
        mobility += 1;
      }
    }
    
    // Adjust for piece type
    if (piece.meta.key === 'A') {
      mobility *= 1.5; // Ants can move further
    } else if (piece.meta.key === 'G') {
      mobility *= 1.3; // Grasshoppers can jump
    }
    
    return mobility;
  } catch (error) {
    console.error(`🤖 💥 ERROR in calculatePieceMobility:`, error);
    return 0;
  }
};

/**
 * Evaluate endgame material imbalances
 */
window.AIEngine.evaluateEndgameMaterial = function(gameState, aiColor, oppColor) {
  try {
    let materialValue = 0;
    
    const aiPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === aiColor
    );
    const oppPieces = gameState.tray.filter(p => 
      p && p.placed && p.meta && p.meta.color === oppColor
    );
    
    // Count pieces by type
    const aiCounts = this.countPieceTypes(aiPieces);
    const oppCounts = this.countPieceTypes(oppPieces);
    
    // Ants are particularly valuable in endgame
    materialValue += (aiCounts.A - oppCounts.A) * 0.8;
    
    // Spiders good for tactics
    materialValue += (aiCounts.S - oppCounts.S) * 0.6;
    
    // Grasshoppers for jumping attacks
    materialValue += (aiCounts.G - oppCounts.G) * 0.5;
    
    // Beetles less valuable in endgame
    materialValue += (aiCounts.B - oppCounts.B) * 0.3;
    
    return materialValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateEndgameMaterial:`, error);
    return 0;
  }
};

/**
 * Count pieces by type
 */
window.AIEngine.countPieceTypes = function(pieces) {
  const counts = {Q: 0, A: 0, S: 0, G: 0, B: 0};
  
  for (const piece of pieces) {
    if (piece && piece.meta && piece.meta.key) {
      counts[piece.meta.key] = (counts[piece.meta.key] || 0) + 1;
    }
  }
  
  return counts;
};

/**
 * Evaluate opposition and tempo in endgame
 */
window.AIEngine.evaluateEndgameOpposition = function(gameState, aiColor, oppColor) {
  try {
    let opposition = 0;
    
    // Control of central squares is important
    const centerControl = this.evaluateCentralControl(gameState, aiColor, oppColor);
    opposition += centerControl * 0.5;
    
    // Tempo advantage - who has the initiative
    const tempoAdvantage = this.evaluateTempoAndInitiative(gameState, aiColor, oppColor);
    opposition += tempoAdvantage * 0.3;
    
    return opposition;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateEndgameOpposition:`, error);
    return 0;
  }
};

/**
 * Evaluate specific endgame checkmate patterns
 */
window.AIEngine.evaluateEndgameCheckmatePatterns = function(gameState, aiColor, oppColor) {
  try {
    let checkmateValue = 0;
    
    const oppQueen = gameState.tray.find(p => 
      p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
    );
    
    if (oppQueen && oppQueen.meta) {
      const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
      
      // Classic checkmate patterns in Hive
      if (oppQueenThreats >= 5) {
        checkmateValue += 5.0; // Immediate checkmate
      } else if (oppQueenThreats >= 4) {
        // Look for forced checkmate sequences
        const forcedMate = this.analyzeForcedCheckmate(gameState, aiColor, oppQueen);
        checkmateValue += forcedMate * 3.0;
      } else if (oppQueenThreats >= 3) {
        // Building toward checkmate
        checkmateValue += 1.0;
      }
    }
    
    return checkmateValue;
  } catch (error) {
    console.error(`🤖 💥 ERROR in evaluateEndgameCheckmatePatterns:`, error);
    return 0;
  }
};

/**
 * Analyze forced checkmate sequences (simplified)
 */
window.AIEngine.analyzeForcedCheckmate = function(gameState, aiColor, oppQueen) {
  try {
    if (!oppQueen || !oppQueen.meta) return 0;
    
    // Simple heuristic: if opponent Queen has very few escape routes
    // and we have pieces that can attack the remaining routes
    const escapeRoutes = this.getQueenEscapeRoutes(gameState, oppQueen.meta.color);
    
    if (escapeRoutes <= 1) {
      return 2.0; // Very likely forced mate
    } else if (escapeRoutes <= 2) {
      return 1.0; // Possible forced mate
    }
    
    return 0;
  } catch (error) {
    console.error(`🤖 💥 ERROR in analyzeForcedCheckmate:`, error);
    return 0;
  }
};

// Strategic intelligence system for progressive queen pinning
window.AIEngine.createStrategicPlan = function(gameState) {
  const plan = {
    phase: 'deployment',
    objectives: [],
    priorities: []
  };

  const myColor = this.color;
  const opponentColor = myColor === 'white' ? 'black' : 'white';
  
  // Count deployed pieces
  const myPieces = gameState.pieces.filter(p => p.color === myColor && p.placed);
  const opponentPieces = gameState.pieces.filter(p => p.color === opponentColor && p.placed);
  
  // Phase determination
  if (myPieces.length < 3) {
    plan.phase = 'deployment-crisis';
    plan.objectives.push('Deploy essential pieces first');
    plan.priorities.push('piece-placement');
  } else if (myPieces.length < opponentPieces.length) {
    plan.phase = 'catch-up';
    plan.objectives.push('Match opponent piece count');
    plan.priorities.push('piece-placement');
  } else {
    // Find opponent queen
    const opponentQueen = opponentPieces.find(p => p.meta.key === 'Q');
    if (opponentQueen) {
      const queenNeighbors = this.getNeighbors(opponentQueen.q, opponentQueen.r);
      const occupiedNeighbors = queenNeighbors.filter(([q, r]) => {
        return gameState.pieces.some(p => p.placed && p.q === q && p.r === r);
      });
      
      if (occupiedNeighbors.length === 0) {
        plan.phase = 'initial-pin';
        plan.objectives.push('Establish first queen pin');
        plan.priorities.push('queen-pin');
      } else if (occupiedNeighbors.length < 4) {
        plan.phase = 'build-pressure';
        plan.objectives.push('Add more pinning pieces');
        plan.priorities.push('queen-pin');
      } else {
        plan.phase = 'near-victory';
        plan.objectives.push('Complete queen surrounding');
        plan.priorities.push('queen-pin');
      }
    }
  }
  
  return plan;
};

window.AIEngine.applyStrategicFilter = function(moves) {
  try {
    // Build comprehensive game state for strategic analysis
    const gameState = {
      currentPlayer: this.color,
      tray: typeof tray !== 'undefined' ? tray : [],
      queenPlaced: typeof state !== 'undefined' ? state.queenPlaced : {}
    };
    
    console.log(`🎯 STRATEGIC FILTER: Analyzing ${moves.length} moves for intelligent play`);
    
    const oppColor = this.color === 'white' ? 'black' : 'white';
    const strategicMoves = [];
    
    // Find both Queens for strategic analysis
    const oppQueen = gameState.tray.find(p => 
      p && p.meta && p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed
    );
    const aiQueen = gameState.tray.find(p => 
      p && p.meta && p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed
    );
    
    console.log(`🎯 Queens found - AI: ${aiQueen ? 'YES' : 'NO'}, Opponent: ${oppQueen ? 'YES' : 'NO'}`);
    
    // ✨ INTELLIGENT QUEEN PINNING STRATEGY ✨
    // "Pin the queen, keep the pin, add more bugs, pin the queen with those"
    if (oppQueen && oppQueen.meta) {
      console.log(`🎯 👑 IMPLEMENTING INTELLIGENT QUEEN PINNING STRATEGY`);
      
      // Count current threats to opponent Queen
      let currentThreats = 0;
      const queenNeighbors = this.getNeighborCoords(oppQueen.meta.q, oppQueen.meta.r);
      
      for (const [nq, nr] of queenNeighbors) {
        const occupied = gameState.tray.some(p => 
          p && p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr
        );
        if (occupied) currentThreats++;
      }
      
      console.log(`🎯 👑 Opponent Queen has ${currentThreats}/6 threats - planning progressive pinning`);
      
      // PRIORITY 1: WINNING MOVES - Surround the Queen completely!
      const winningMoves = moves.filter(move => {
        if (move.type !== 'place') return false;
        
        const wouldBeAdjacent = queenNeighbors.some(([nq, nr]) => 
          nq === move.q && nr === move.r
        );
        
        if (wouldBeAdjacent) {
          const newThreats = currentThreats + 1;
          if (newThreats >= 6) {
            console.log(`🎯 👑 🏆 WINNING MOVE: ${move.piece.meta.key} at ${move.q},${move.r} would WIN THE GAME!`);
            move.priority = 'winning-move';
            move.strategicValue = 100.0;
            return true;
          }
        }
        return false;
      });
      
      if (winningMoves.length > 0) {
        console.log(`🎯 👑 🏆 FOUND ${winningMoves.length} WINNING MOVES!`);
        return winningMoves; // Always take the win!
      }
      
      // PRIORITY 2: PROGRESSIVE PINNING - Add pieces around Queen systematically
      const pinningMoves = moves.filter(move => {
        if (move.type !== 'place') return false;
        
        const wouldBeAdjacent = queenNeighbors.some(([nq, nr]) => 
          nq === move.q && nr === move.r
        );
        
        if (wouldBeAdjacent) {
          const newThreats = currentThreats + 1;
          
          if (newThreats >= 5) {
            console.log(`🎯 👑 ⚡ CRITICAL PINNING: ${move.piece.meta.key} would create ${newThreats}/6 threats!`);
            move.priority = 'critical-pinning';
            move.strategicValue = 50.0;
            return true;
          } else if (newThreats >= 4) {
            console.log(`🎯 👑 📌 STRONG PINNING: ${move.piece.meta.key} would create ${newThreats}/6 threats`);
            move.priority = 'strong-pinning';
            move.strategicValue = 25.0;
            return true;
          } else if (newThreats >= 3) {
            console.log(`🎯 👑 🎯 BUILDING PRESSURE: ${move.piece.meta.key} would create ${newThreats}/6 threats`);
            move.priority = 'building-pressure';
            move.strategicValue = 15.0;
            return true;
          } else if (newThreats >= 2) {
            console.log(`🎯 👑 📍 STARTING PINNING: ${move.piece.meta.key} would create ${newThreats}/6 threats`);
            move.priority = 'start-pinning';
            move.strategicValue = 8.0;
            return true;
          }
        }
        return false;
      });
      
      // PRIORITY 3: MAINTAIN THE PIN - Keep existing pressure while adding more
      const maintainMoves = moves.filter(move => {
        if (move.type !== 'move') return false;
        
        // Check if this piece is currently threatening the Queen
        const currentlyThreatening = queenNeighbors.some(([nq, nr]) => 
          nq === move.piece.meta.q && nr === move.piece.meta.r
        );
        
        if (currentlyThreatening) {
          // Check if the move would maintain the threat
          const wouldStillThreaten = queenNeighbors.some(([nq, nr]) => 
            nq === move.q && nr === move.r
          );
          
          if (wouldStillThreaten) {
            console.log(`🎯 👑 🔒 MAINTAIN PIN: ${move.piece.meta.key} keeps Queen pressure`);
            move.priority = 'maintain-pressure';
            move.strategicValue = 12.0;
            return true;
          } else {
            console.log(`🎯 👑 ❌ ABANDONING PIN: ${move.piece.meta.key} would stop threatening Queen - AVOID!`);
            move.priority = 'abandon-pressure';
            move.strategicValue = -10.0; // Strong penalty for losing pressure
            return false;
          }
        }
        return false;
      });
      
      // PRIORITY 4: SUPPORT PINS - Place pieces that support the pinning pieces
      const supportMoves = moves.filter(move => {
        if (move.type !== 'place') return false;
        
        // Find our pieces that are already threatening the Queen
        const ourThreateningPieces = gameState.tray.filter(p => 
          p && p.meta && p.meta.placed && p.meta.color === this.color &&
          queenNeighbors.some(([nq, nr]) => nq === p.meta.q && nr === p.meta.r)
        );
        
        // Check if this move would be adjacent to our threatening pieces (support them)
        let supportValue = 0;
        const moveNeighbors = this.getNeighborCoords(move.q, move.r);
        
        for (const threatPiece of ourThreateningPieces) {
          const isAdjacent = moveNeighbors.some(([nq, nr]) => 
            nq === threatPiece.meta.q && nr === threatPiece.meta.r
          );
          
          if (isAdjacent) {
            supportValue += 3.0;
            console.log(`🎯 👑 🤝 SUPPORT PIN: ${move.piece.meta.key} supports ${threatPiece.meta.key} pinning Queen`);
          }
        }
        
        if (supportValue > 0) {
          move.priority = 'support-pinning';
          move.strategicValue = supportValue;
          return true;
        }
        
        return false;
      });
      
      // Combine all strategic pinning moves
      strategicMoves.push(...pinningMoves, ...maintainMoves, ...supportMoves);
      
      console.log(`🎯 👑 PINNING ANALYSIS: ${pinningMoves.length} pinning, ${maintainMoves.length} maintain, ${supportMoves.length} support moves`);
    }
    
    // ✨ PIECE DEVELOPMENT STRATEGY ✨
    // "If it notices white placing more pieces, AI needs to keep up"
    const allPlaced = gameState.tray.filter(p => p && p.meta && p.meta.placed);
    const aiPlaced = allPlaced.filter(p => p.meta.color === this.color);
    const oppPlaced = allPlaced.filter(p => p.meta.color === oppColor);
    
    console.log(`🎯 📊 PIECE COUNT: AI has ${aiPlaced.length}, Opponent has ${oppPlaced.length}`);
    
    if (oppPlaced.length > aiPlaced.length) {
      console.log(`🎯 📈 DEVELOPMENT URGENCY: Opponent ahead by ${oppPlaced.length - aiPlaced.length} pieces - prioritizing placement!`);
      
      const developmentMoves = moves.filter(move => {
        if (move.type === 'place') {
          console.log(`🎯 📈 DEVELOPMENT: Placing ${move.piece.meta.key} to catch up`);
          move.priority = 'catch-up-development';
          move.strategicValue = (move.strategicValue || 0) + 5.0;
          return true;
        }
        return false;
      });
      
      strategicMoves.push(...developmentMoves);
    }
    
    // ✨ DEFENSIVE QUEEN PROTECTION ✨
    if (aiQueen && aiQueen.meta) {
      let aiQueenThreats = 0;
      const aiQueenNeighbors = this.getNeighborCoords(aiQueen.meta.q, aiQueen.meta.r);
      
      for (const [nq, nr] of aiQueenNeighbors) {
        const occupied = gameState.tray.some(p => 
          p && p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr
        );
        if (occupied) aiQueenThreats++;
      }
      
      if (aiQueenThreats >= 3) {
        console.log(`🎯 🛡️ QUEEN DEFENSE: Our Queen has ${aiQueenThreats}/6 threats - prioritizing defense!`);
        
        const defensiveMoves = moves.filter(move => {
          if (move.type === 'move' && move.piece.meta.key === 'Q') {
            console.log(`🎯 🛡️ QUEEN ESCAPE: Moving Queen to safety`);
            move.priority = 'queen-escape';
            move.strategicValue = 30.0;
            return true;
          }
          
          // Don't place pieces that would further threaten our Queen
          if (move.type === 'place') {
            const wouldThreatenUs = aiQueenNeighbors.some(([nq, nr]) => 
              nq === move.q && nr === move.r
            );
            
            if (wouldThreatenUs) {
              console.log(`🎯 🛡️ AVOID SELF-THREAT: Not placing ${move.piece.meta.key} next to our Queen`);
              move.priority = 'dangerous-self-threat';
              move.strategicValue = -50.0; // Heavy penalty
              return false;
            }
          }
          
          return false;
        });
        
        strategicMoves.push(...defensiveMoves);
      }
    }
    
    // Apply strategic scoring to remaining moves
    for (const move of moves) {
      if (!strategicMoves.includes(move)) {
        const strategicValue = this.evaluateMoveStrategically(move, gameState);
        if (strategicValue > 1.0) { // Only include moves with decent strategic value
          move.strategicValue = strategicValue;
          strategicMoves.push(move);
        }
      }
    }
    
    // Sort by strategic value (highest first)
    strategicMoves.sort((a, b) => (b.strategicValue || 0) - (a.strategicValue || 0));
    
    console.log(`🎯 STRATEGIC FILTER RESULT: ${strategicMoves.length}/${moves.length} strategic moves selected`);
    console.log(`🎯 TOP 3 MOVES:`, strategicMoves.slice(0, 3).map(m => 
      `${m.piece?.meta?.key || '?'} ${m.type} to ${m.q},${m.r} (${m.priority || 'normal'}, value: ${(m.strategicValue || 0).toFixed(1)})`
    ));
    
    // Return strategic moves or fallback to all moves if none found
    return strategicMoves.length > 0 ? strategicMoves : moves;
    
  } catch (error) {
    console.error('🎯 💥 STRATEGIC FILTER ERROR:', error);
    return moves; // Fallback to all moves on error
  }
};

/**
 * Evaluate a move strategically for the improved filtering system
 */
window.AIEngine.evaluateMoveStrategically = function(move, gameState) {
  try {
    let value = 0;
    
    // Base piece value
    const pieceValues = {
      'Q': 3.0,  // Queen moves are critical
      'A': 2.5,  // Ants are highly mobile and versatile
      'B': 2.0,  // Beetles can climb and control
      'G': 1.5,  // Grasshoppers can jump over pieces
      'S': 1.0   // Spiders have more limited movement
    };
    
    if (move.piece && move.piece.meta && move.piece.meta.key) {
      value += pieceValues[move.piece.meta.key] || 1.0;
    }
    
    // Center control bonus
    if (move.q !== undefined && move.r !== undefined) {
      const centerDistance = Math.abs(move.q) + Math.abs(move.r);
      if (centerDistance <= 2) {
        value += 1.0; // Central positions are valuable
      } else if (centerDistance <= 3) {
        value += 0.5; // Near-central positions have some value
      }
    }
    
    // Coordination bonus - pieces working together
    if (move.type === 'place') {
      const neighbors = this.getNeighborCoords(move.q, move.r);
      let friendlyNeighbors = 0;
      
      for (const [nq, nr] of neighbors) {
        const friendly = gameState.tray.find(p => 
          p && p.meta && p.meta.placed && p.meta.color === this.color && 
          p.meta.q === nq && p.meta.r === nr
        );
        if (friendly) friendlyNeighbors++;
      }
      
      value += friendlyNeighbors * 0.5; // Coordination bonus
    }
    
    // Mobility and flexibility bonus
    if (move.type === 'move') {
      const piece = move.piece;
      if (piece && piece.meta) {
        // Moving from a crowded position to open space is good
        const fromNeighbors = this.getNeighborCoords(piece.meta.q, piece.meta.r);
        const toNeighbors = this.getNeighborCoords(move.q, move.r);
        
        const fromCrowded = fromNeighbors.filter(([nq, nr]) => 
          gameState.tray.some(p => p && p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr)
        ).length;
        
        const toCrowded = toNeighbors.filter(([nq, nr]) => 
          gameState.tray.some(p => p && p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr)
        ).length;
        
        if (fromCrowded > toCrowded) {
          value += 0.5; // Moving to less crowded space
        }
      }
    }
    
    return value;
  } catch (error) {
    console.error('🎯 Error evaluating move strategically:', error);
    return 1.0; // Default value
  }
};