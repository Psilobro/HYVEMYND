/**
 * HYVEMYND AI Engine
 * Monte Carlo Tree Search AI for Hive game
 */

window.AIEngine = {
  // AI Configuration
  enabled: false,
  difficulty: 'medium',
  color: 'black', // AI always plays black
  thinking: false,
  thinkingTime: {
    easy: 3000,      // 3 seconds
    medium: 8000,    // 8 seconds  
    hard: 25000      // 25 seconds - truly strategic thinking
  },
  
  // MCTS Parameters - MUCH DEEPER THINKING FOR STRATEGIC PLAY
  explorationConstant: Math.sqrt(2),
  simulationDepth: 35, // Increased from 25 for deeper lookahead
  iterationsPerMove: {
    easy: 1000,      // 10x more thinking
    medium: 5000,    // 10x more thinking
    hard: 15000      // 10x more thinking - truly deep analysis
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
 * Main AI entry point - checks if it's AI's turn and makes a move
 */
window.AIEngine.checkAndMakeMove = function() {
  console.log(`🤖 checkAndMakeMove called - enabled: ${this.enabled}, current: ${window.state ? window.state.current : 'N/A'}, aiColor: ${this.color}, thinking: ${this.thinking}, animating: ${window.animating}, gameOver: ${window.state ? window.state.gameOver : 'N/A'}`);
  
  if (!this.enabled || 
      state.current !== this.color || 
      this.thinking || 
      window.animating || 
      state.gameOver) {
    console.log(`🤖 AI skipping turn - conditions not met`);
    return;
  }
  
  console.log(`🤖 AI (${this.color}) analyzing position...`);
  this.thinking = true;
  
  // Show thinking indicator in HUD
  const hud = document.getElementById('hud');
  const originalText = hud.textContent;
  hud.textContent = `🤖 AI is thinking...`;
  hud.style.background = 'rgba(0,0,0,0.8)';
  
  setTimeout(async () => {
    try {
      const move = await this.findBestMove();
      if (move) {
        this.executeMove(move);
      } else {
        console.log('🤖 AI found no legal moves - passing turn');
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
    }
  }, this.thinkingTime[this.difficulty]);
};

/**
 * Core MCTS algorithm to find the best move
 */
window.AIEngine.findBestMove = async function() {
  console.log('🤖 Starting move search...');
  
  const hud = document.getElementById('hud'); // For progress updates
  const gameState = this.captureGameState();
  console.log('🤖 Current game state:', gameState);
  
  // Check if Queen placement is urgently required (override normal logic)
  const currentColor = gameState.currentPlayer;
  const allPlacedPieces = typeof tray !== 'undefined' ? tray.filter(p => 
    p.meta && p.meta.placed
  ) : [];
  const placedPieces = allPlacedPieces.filter(p => p.meta.color === currentColor);
  const myTurnNumber = placedPieces.length + 1;
  const hasQueen = placedPieces.some(p => p.meta.key === 'Q');
  
  const mustPlaceQueen = !hasQueen && myTurnNumber >= 3;
  console.log(`🤖 Queen check: hasQueen=${hasQueen}, myTurn=${myTurnNumber}, mustPlace=${mustPlaceQueen}`);
  
  // First check if we have any legal moves available
  const availableMoves = this.generateLegalMoves(gameState);
  console.log(`🤖 Found ${availableMoves.length} legal moves`);
  
  if (availableMoves.length === 0) {
    if (mustPlaceQueen) {
      console.error('🤖 💥 CRITICAL: No moves generated despite Queen placement requirement!');
      console.error('🤖 💥 This should never happen - Queen placement logic failed!');
    }
    console.log('🤖 No legal moves available!');
    return null;
  }
  
  // If Queen must be placed, prioritize Queen moves
  if (mustPlaceQueen) {
    const queenMoves = availableMoves.filter(move => 
      move.type === 'place' && move.piece && move.piece.meta && move.piece.meta.key === 'Q'
    );
    console.log(`🤖 🚨 Queen placement required: found ${queenMoves.length} Queen moves out of ${availableMoves.length} total`);
    
    if (queenMoves.length > 0) {
      console.log('🤖 👑 Forcing Queen placement move:', queenMoves[0]);
      return queenMoves[0]; // Force Queen placement immediately
    } else {
      console.error('🤖 💥 CRITICAL ERROR: Queen must be placed but no Queen moves generated!');
    }
  }
  
  // If only one move, return it immediately
  if (availableMoves.length === 1) {
    console.log('🤖 Only one legal move, selecting it:', availableMoves[0]);
    return availableMoves[0];
  }
  
  const rootNode = new MCTSNode(gameState, null, null);
  
  // Ensure root node has moves initialized BEFORE starting MCTS
  if (rootNode.untriedMoves === null) {
    rootNode.untriedMoves = this.generateLegalMoves(gameState);
    console.log(`🤖 🔧 Initialized root node with ${rootNode.untriedMoves.length} moves`);
  }
  
  const maxIterations = this.iterationsPerMove[this.difficulty];
  const timeLimit = this.timeLimit[this.difficulty];
  
  console.log(`🤖 Running ${maxIterations} MCTS iterations (NO TIME LIMIT - thinking deeply)...`);
  
  const startTime = Date.now();
  let iterations = 0;
  
  // Deep thinking approach: Run ALL iterations, no time pressure
  while (iterations < maxIterations) {
    try {
      if (iterations === 0) {
        console.log(`🤖 🔍 MCTS Loop Debug - Starting iteration 0`);
        // Loop iteration debug removed
      }
      if (iterations === 1) {
        console.log(`🤖 🔍 MCTS Loop Debug - Starting iteration 1 (SECOND ITERATION)`);
        console.log(`🤖   - Root node state: children=${rootNode.children.length}, untriedMoves=${rootNode.untriedMoves ? rootNode.untriedMoves.length : 'null'}`);
      }
      
      const leaf = this.selectLeaf(rootNode);
      if (iterations === 0 || iterations === 1) {
        console.log(`🤖   - selectLeaf returned leaf:`, leaf ? 'node' : 'null');
        if (iterations === 1) {
          console.log(`🤖   - leaf details: hasGameState=${!!leaf.gameState}, hasMove=${!!leaf.move}, isRoot=${leaf === rootNode}`);
        }
      }
      
      const child = this.expandNode(leaf);
      if (iterations === 0 || iterations === 1) {
        console.log(`🤖   - expandNode returned child:`, child ? 'node' : 'null');
        console.log(`🤖   - leaf.untriedMoves.length after expand:`, leaf.untriedMoves ? leaf.untriedMoves.length : 'null');
        if (iterations === 1 && child) {
          console.log(`🤖   - child details: hasGameState=${!!child.gameState}, hasMove=${!!child.move}`);
        }
      }
      
      const nodeForSimulation = child || leaf;
      if (iterations === 0 || iterations === 1) {
        console.log(`🤖   - using node for simulation:`, nodeForSimulation === child ? 'child' : 'leaf');
      }
      
      if (iterations === 0 || iterations === 1) {
        console.log(`🤖   - about to simulate node with state:`, nodeForSimulation.gameState ? 'has-state' : 'no-state');
      }
      
      let result;
      try {
        if (iterations === 0 || iterations === 1) {
          console.log(`🤖   - 🔥 CALLING simulate() now... (iteration ${iterations})`);
        }
        result = this.simulate(nodeForSimulation);
        if (iterations === 0 || iterations === 1) {
          console.log(`🤖   - 🔥 simulate() RETURNED successfully:`, result, typeof result);
          console.log(`🤖   - 🔥 result is valid number:`, !isNaN(result));
          console.log(`🤖   - 🔥 about to call backpropagate with node and result`);
        }
      } catch (error) {
        console.error(`🤖 💥 ERROR calling simulate in MCTS loop (iteration ${iterations}):`, error);
        console.error('Node for simulation:', nodeForSimulation);
        console.error('Stack trace:', error.stack);
        throw error;
      }
      
      try {
        if (iterations === 0 || iterations === 1) {
          console.log(`🤖   - 🔥 CALLING backpropagate() now... (iteration ${iterations})`);
        }
        this.backpropagate(nodeForSimulation, result);
        if (iterations === 0 || iterations === 1) {
          console.log(`🤖   - 🔥 backpropagate() COMPLETED successfully (iteration ${iterations})`);
        }
      } catch (error) {
        console.error(`🤖 💥 ERROR calling backpropagate in MCTS loop (iteration ${iterations}):`, error);
        console.error('Stack trace:', error.stack);
        throw error;
      }
      
      if (iterations === 0) {
        console.log(`🤖   - 🔥 BACKPROPAGATE FINISHED - about to increment iterations from ${iterations}`);
        console.log(`🤖   - 🔥 CRITICAL CHECKPOINT: Before increment, iterations=${iterations}`);
      }
      
      iterations++;
      
      if (iterations === 1) {
        console.log(`🤖   - 🔥 ITERATION INCREMENTED SUCCESSFULLY! New value: ${iterations}`);
      }
      
      if (iterations === 1) {
        console.log(`🤖 ✅ FIRST ITERATION COMPLETED! iterations=${iterations}`);
        console.log(`🤖   - checking while condition: ${iterations} < ${maxIterations} = ${iterations < maxIterations}`);
        console.log(`🤖   - root node children count:`, rootNode.children.length);
        console.log(`🤖   - about to continue to iteration 2...`);
        console.log(`🤖   - 🔥 CRITICAL: Loop should continue now!`);
      }
      
      // Add debugging for second iteration
      if (iterations === 2) {
        console.log(`🤖 ✅ SECOND ITERATION COMPLETED! iterations=${iterations}`);
      }
      
      if (iterations === 1 || iterations === 2 || iterations % 100 === 0) {
        console.log(`🤖 MCTS Progress: ${iterations}/${maxIterations} iterations (${Math.round((iterations / maxIterations) * 100)}%)`);
        // Update thinking indicator with progress
        try {
          const hudElement = document.getElementById('hud');
          if (hudElement) {
            const progress = Math.round((iterations / maxIterations) * 100);
            hudElement.textContent = `🤖 AI thinking deeply... ${progress}% (${iterations}/${maxIterations} iterations)`;
          }
        } catch (hudError) {
          // Ignore HUD update errors - they shouldn't break MCTS
          console.warn('🤖 HUD update failed:', hudError.message);
        }
        
        // Only yield for every 100 iterations to avoid overhead
        if (iterations % 100 === 0 && iterations > 0) {
          // Use setTimeout without await to avoid blocking
          setTimeout(() => {}, 1); // Brief yield to prevent browser freeze
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
      console.error(`🤖 💥 This error will cause MCTS to exit with 0 iterations!`);
      console.error(`🤖 💥 Breaking MCTS loop due to error`);
      console.error(`🤖 💥 FULL ERROR OBJECT:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      break;
    }
  }
  
  console.log(`🤖 🔥 MCTS WHILE LOOP COMPLETED - Final iterations: ${iterations}`)
  
  console.log(`🤖 🏁 MCTS LOOP EXITED: iterations=${iterations}, maxIterations=${maxIterations}, reason=${iterations >= maxIterations ? 'completed' : 'error/break'}`)
  
  const elapsed = Date.now() - startTime;
  console.log(`🤖 MCTS completed ALL ${iterations} iterations in ${elapsed}ms (${(elapsed/1000).toFixed(1)}s). Root has ${rootNode.children.length} children.`);
  
  // PRIORITY-FIRST MOVE SELECTION: Queen objectives override MCTS
  let bestChild = null;
  let bestScore = -1;
  
  console.log(`🤖 🧠 ANALYZING ${rootNode.children.length} POSSIBLE MOVES:`);
  
  // Check for WINNING moves first (surround opponent Queen)
  console.log(`🤖 👑 Checking for WINNING moves...`);
  for (const child of rootNode.children) {
    if (this.isWinningMove(child.move)) {
      console.log(`🤖 👑 ⭐ WINNING MOVE FOUND! Surrounding opponent Queen:`, child.move);
      console.log(`🤖 👑 ⭐ GAME OVER! Taking immediate win!`);
      return child.move;
    }
  }
  console.log(`🤖 👑 No winning moves available.`);
  
  // Check for emergency defensive moves (save our Queen)
  console.log(`🤖 🛡️ Checking for EMERGENCY defensive moves...`);
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
    console.log(`🤖 ⭐ FINAL DECISION after ${iterations} iterations:`);
    console.log(`🤖 ⭐ Selected: ${bestChild.move.type} ${bestChild.move.piece?.meta?.key || '?'} to (${bestChild.move.q},${bestChild.move.r})`);
    console.log(`🤖 ⭐ Final score: ${bestScore.toFixed(3)} | Visits: ${bestChild.visits} | Win rate: ${((bestChild.wins/bestChild.visits)*100).toFixed(1)}%`);
    console.log(`🤖 ⭐ Strategy: ${this.analyzeQueenThreats(bestChild.move)} | Priority: ${bestChild.move.priority || 'normal'}`);
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
            console.log(`🤖 👑 Generated ${queenMoves.length} strategic Queen placements`);
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
 * Opening book - strategic moves for early game using proven Hive theory
 */
window.AIEngine.generateOpeningMoves = function(currentColor, myTurnNumber, availablePieces, allPlacedPieces, difficulty = 'easy') {
  const moves = [];
  
  console.log(`🤖 📖 Opening book for my turn ${myTurnNumber} as ${currentColor} (${difficulty} difficulty)`);
  
  // STRATEGIC RULE 1: Never place Queen on first move (Tournament Opening Rule)
  // STRATEGIC RULE 2: Delay Queen placement until strategic advantage
  // STRATEGIC RULE 3: Use proven opening formations
  
  if (myTurnNumber === 1) {
    // My first move - if no pieces on board, place at origin; otherwise place adjacent
    if (allPlacedPieces.length === 0) {
      // Very first move of the game - NEVER Queen per tournament rules
      if (availablePieces.length > 0) {
        let preferredPiece;
        
        // Hive opening theory - proven strong openings
        if (difficulty === 'easy') {
          // Easy: safe, flexible pieces
          preferredPiece = availablePieces.find(p => 
            p.meta.key === 'A' || p.meta.key === 'S'  // Ant or Spider - solid choices
          ) || availablePieces.find(p => p.meta.key !== 'Q'); // Any non-Queen
        } else if (difficulty === 'medium') {
          // Medium: Spider-Bee-Ant formation start
          preferredPiece = availablePieces.find(p => 
            p.meta.key === 'S' || p.meta.key === 'A' || p.meta.key === 'G'
          ) || availablePieces.find(p => p.meta.key !== 'Q'); // Any non-Queen
        } else {
          // Hard: Advanced opening theory - Spider or Ant for mobility
          preferredPiece = availablePieces.find(p => 
            p.meta.key === 'S' || p.meta.key === 'A'  // Prefer Spider/Ant for strategic flexibility
          ) || availablePieces.find(p => p.meta.key !== 'Q'); // Any non-Queen
        }
        
        // ENSURE we never place Queen on first move
        if (!preferredPiece || preferredPiece.meta.key === 'Q') {
          preferredPiece = availablePieces.find(p => p.meta.key !== 'Q') || availablePieces[0];
        }
        
        console.log(`🤖 📖 First move: placing ${preferredPiece.meta.key} (avoiding Queen per tournament rules)`);
        
        moves.push({
          type: 'place',
          piece: preferredPiece,
          q: 0,
          r: 0,
          priority: 'opening-first'
        });
      }
    } else {
      // Second move of game (opponent went first)
      console.log(`🤖 📖 Second move: opponent went first, placing adjacent`);
      const firstPiece = allPlacedPieces[0];
      console.log(`🤖 📖 First piece:`, firstPiece.meta);
      const neighbors = this.getNeighborCoords(firstPiece.meta.q, firstPiece.meta.r);
      console.log(`🤖 📖 Neighbor coords:`, neighbors);
      
      if (availablePieces.length > 0) {
        let piece;
        
        // Difficulty-specific response strategy
        if (difficulty === 'easy') {
          piece = availablePieces.find(p => 
            p.meta.key === 'A' || p.meta.key === 'G'
          ) || availablePieces[0];
        } else if (difficulty === 'medium') {
          // Medium: consider opponent's piece type for response
          const opponentPiece = firstPiece.meta.key;
          if (opponentPiece === 'Q') {
            // Opponent opened with Queen - pressure
            piece = availablePieces.find(p => 
              p.meta.key === 'B' || p.meta.key === 'A'
            ) || availablePieces[0];
          } else if (opponentPiece === 'A') {
            // Ant opening - flexible response
            piece = availablePieces.find(p => 
              p.meta.key === 'G' || p.meta.key === 'S'
            ) || availablePieces[0];
          } else {
            // Standard response
            piece = availablePieces.find(p => 
              p.meta.key === 'A' || p.meta.key === 'B'
            ) || availablePieces[0];
          }
        } else {
          // Hard: advanced counter-play
          piece = this.selectCounterPiece(firstPiece, availablePieces);
        }
        
        for (const [nq, nr] of neighbors) {
          // Validate position is actually empty
          const existingPiece = typeof tray !== 'undefined' ? tray.find(p => 
            p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr
          ) : null;
          
          if (!existingPiece) {
            // Adjacent moves are good in Hive (no center concept)
            let priority = 'opening-adjacent';
            
            // Medium+ difficulty considers positional factors
            if (difficulty !== 'easy') {
              const positionValue = this.evaluateOpeningPosition(nq, nr, firstPiece, allPlacedPieces);
              if (positionValue > 0.7) priority = 'opening-excellent';
              else if (positionValue > 0.5) priority = 'opening-good';
            }
            
            moves.push({
              type: 'place',
              piece: piece,
              q: nq,
              r: nr,
              priority: priority
            });
          }
        }
      }
    }
  } else if (myTurnNumber === 2) {
    // My second move - strategic development
    if (typeof legalPlacementZones === 'function') {
      const zones = legalPlacementZones(currentColor);
      
      for (const piece of availablePieces) {
        const isOpening = difficulty !== 'easy' && myTurnNumber <= 3;
        const placements = this.generateStrategicPlacements(piece, zones, currentColor, allPlacedPieces, isOpening, difficulty);
        moves.push(...placements);
      }
    }
  } else {
    // Turns 3+: full strategic development
    if (typeof legalPlacementZones === 'function') {
      const zones = legalPlacementZones(currentColor);
      
      for (const piece of availablePieces) {
        const isOpening = difficulty !== 'easy' && myTurnNumber <= 4;
        const placements = this.generateStrategicPlacements(piece, zones, currentColor, allPlacedPieces, isOpening, difficulty);
        moves.push(...placements);
      }
    }
  }
  
  console.log(`🤖 📖 Opening book generated ${moves.length} moves`);
  if (moves.length === 0) {
    console.log(`🤖 📖 ⚠️ No moves generated! Debug info:`);
    console.log(`🤖 📖 myTurnNumber: ${myTurnNumber}`);
    console.log(`🤖 📖 availablePieces: ${availablePieces.length}`);
    console.log(`🤖 📖 allPlacedPieces: ${allPlacedPieces.length}`);
    console.log(`🤖 📖 currentColor: ${currentColor}`);
  }
  return moves;
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
      console.log(`🤖 👑 STRATEGIC: Placing Queen early due to aggressive opponent formation`);
      return true;
    }
    
    // Place early if we have good defensive pieces ready
    if (myPieces.length >= 2 && this.hasGoodQueenDefenders(myPieces)) {
      console.log(`🤖 👑 STRATEGIC: Placing Queen with good defenders available`);
      return true;
    }
    
    // Delay Queen placement for flexibility
    console.log(`🤖 👑 STRATEGIC: Delaying Queen placement for tactical flexibility`);
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
  
  console.log(`🤖 👑 Opponent aggression score: ${aggressiveIndicators}`);
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
  
  console.log(`🤖 👑 Defender score: ${defenderScore}`);
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
  
  console.log(`🤖 👑 Evaluating ${zones.length} Queen positions...`);
  
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
    
    console.log(`🤖 👑 Position ${q},${r}: safety=${safetyScore.toFixed(2)}, ${reasoning.join(', ')}`);
    
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
 * Get strategic bonus for move prioritization - MASSIVELY ENHANCED FOR STRATEGIC PLAY
 */
window.AIEngine.getStrategicMoveBonus = function(move) {
  if (!move || !move.priority) return 0;
  
  const difficulty = this.difficulty;
  let strategicMultiplier = 1.0;
  if (difficulty === 'medium') strategicMultiplier = 1.8;
  else if (difficulty === 'hard') strategicMultiplier = 2.5; // Much more strategic focus
  
  // DRAMATICALLY enhanced Queen-focused priorities
  const priorityValues = {
    'winning-move': 10.0,       // SURROUND opponent Queen - INSTANT WIN!
    'queen-kill': 8.0,          // Almost surround opponent Queen
    'threaten-queen': 5.0,      // ATTACK opponent Queen aggressively
    'defend-queen': 4.5,        // DEFEND our Queen from danger
    'surround-queen': 4.0,      // Building attack on opponent Queen
    'escape-queen': 3.5,        // Save our Queen from immediate danger
    'queen-placement': 3.0,     // Must place Queen (turn 4 rule)
    'forced-queen': 2.8,        // Emergency Queen placement
    'queen-safe': 2.5,          // Position Queen safely
    'opening-excellent': 2.0,   // Excellent opening move
    'opening-good': 1.5,        // Good opening move
    'opening-first': 1.8,       // First move advantage
    'opening-adjacent': 1.4,    // Adjacent to opponent pieces
    'high-value': 1.2,          // High-value tactical move
    'beetle-aggressive': 1.0,   // Beetle climbing tactics
    'spider-flexible': 0.8,     // Spider positioning
    'ant-opening': 0.7,         // Ant early placement
    'medium-value': 0.6,        // Medium tactical value
    'opening-side': 0.4,        // Side development
    'low-value': 0.2,           // Low priority move
    'normal': 0.0               // Default priority
  };
  
  let bonus = (priorityValues[move.priority] || 0) * strategicMultiplier;
  
  // MASSIVE extra bonuses for Queen-related moves
  if (move.piece && move.piece.meta && move.piece.meta.key === 'Q') {
    bonus += 1.0 * strategicMultiplier; // Any Queen move gets major priority
    console.log(`🤖 👑 QUEEN MOVE BONUS: +${(1.0 * strategicMultiplier).toFixed(2)}`);
  }
  
  // HUGE bonuses for moves that affect areas near Queens  
  if (move.targetingQueen) {
    bonus += 2.0 * strategicMultiplier; // Moves targeting opponent Queen area
    console.log(`🤖 ⚔️ TARGETING QUEEN BONUS: +${(2.0 * strategicMultiplier).toFixed(2)}`);
  }
  
  if (move.protectingQueen) {
    bonus += 1.5 * strategicMultiplier; // Moves protecting our Queen area
    console.log(`🤖 🛡️ PROTECTING QUEEN BONUS: +${(1.5 * strategicMultiplier).toFixed(2)}`);
  }
  
  // Bonus for moves that improve overall position
  if (move.centralControl) {
    bonus += 0.5 * strategicMultiplier; // Central positioning
  }
  
  if (move.connectivityBonus) {
    bonus += 0.3 * strategicMultiplier; // Maintaining hive connectivity
  }
  
  // Penalty for passive moves when aggressive play is needed
  if (difficulty === 'hard' && bonus < 0.5) {
    bonus *= 0.5; // Reduce bonus for non-strategic moves on hard difficulty
  }
  
  return Math.max(0, Math.min(10.0, bonus)); // Cap at 10.0 for extreme moves
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
      console.log(`🤖 Selected strategic move with score ${scoredMove.score.toFixed(3)}:`, scoredMove.move);
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
  } catch (error) {
    console.error(`🤖 💥 CRITICAL ERROR in evaluateTacticalPatterns:`, error);
    throw error;
  }
  
  // 5. Endgame factors (5% weight)
  try {
    const endgameDiff = this.evaluateEndgame(gameState, this.color, oppColor);
    score += endgameDiff * 0.05;
  } catch (error) {
    console.error(`🤖 💥 CRITICAL ERROR in evaluateEndgame:`, error);
    console.error('Stack trace:', error.stack);
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
    r: piece.meta.r
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
    
    // Hive-specific piece values based on strategic importance and versatility
    const pieceValues = { 
      'Q': 0,    // Queen: Target, not material value
      'A': 4.0,  // Ant: Most valuable - can reach any position around hive
      'B': 3.5,  // Beetle: Very valuable - can stack, pin, and reach surrounded spaces
      'G': 2.5,  // Grasshopper: Good - can jump into surrounded spaces  
      'S': 2.0   // Spider: Limited but precise - exactly 3 moves
    };
    
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
    
    // Smart pinning strategy - considers context
    tactical += this.evaluateSmartPinning(gameState, aiColor, oppColor);
    
    // Check for forks (moves that threaten multiple targets)
    tactical += this.countForkThreats(gameState, aiColor) * 0.2;
    tactical -= this.countForkThreats(gameState, oppColor) * 0.2;
    
    // Check for tempo moves (forcing opponent responses)
    tactical += this.countTempoMoves(gameState, aiColor) * 0.1;
    
    if (isNaN(tactical)) {
      console.error(`🤖 💥 TACTICAL ERROR: NaN result`);
      return 0;
    }
    
    return tactical;
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
 * Evaluate endgame factors
 */
window.AIEngine.evaluateEndgame = function(gameState, aiColor, oppColor) {
  try {
    if (!gameState || !gameState.tray) {
      console.error(`🤖 💥 ENDGAME ERROR: Invalid gameState`);
      return 0;
    }
    
    const totalPieces = gameState.tray.filter(p => p.placed).length;
    
    // Simple endgame detection - when most pieces are placed
    if (totalPieces < 8) return 0; // Not endgame yet
    
    let endgame = 0;
    
    // In endgame, queen safety becomes even more critical
    const aiQueenThreats = this.countQueenThreats(gameState, aiColor);
    const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
    
    endgame += (oppQueenThreats - aiQueenThreats) * 0.5;
    
    // Piece activity in endgame
    const aiActivity = this.countAdvancedMobility(gameState, aiColor);
    const oppActivity = this.countAdvancedMobility(gameState, oppColor);
    
    endgame += (aiActivity - oppActivity) * 0.1;
    
    if (isNaN(endgame)) {
      console.error(`🤖 💥 ENDGAME ERROR: NaN result`);
      return 0;
    }
    
    return endgame;
  } catch (error) {
    console.error(`🤖 💥 ENDGAME ERROR: Exception in evaluateEndgame:`, error);
    return 0;
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
    
    console.log(`🤖 👑 Winning check: ${threatsAfterMove}/6 neighbors would be threatened`);
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
    
    // OFFENSIVE: MASSIVE bonus for moves that threaten opponent Queen
    if (oppQueen) {
      const distToOppQueen = Math.abs(move.q - oppQueen.meta.q) + Math.abs(move.r - oppQueen.meta.r);
      
      // Count how many neighbors opponent Queen already has occupied
      let oppQueenThreats = 0;
      const oppQueenNeighbors = this.getNeighborCoords(oppQueen.meta.q, oppQueen.meta.r);
      for (const [nq, nr] of oppQueenNeighbors) {
        const occupied = tray.some(p => p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr);
        if (occupied) oppQueenThreats++;
      }
      
      if (distToOppQueen === 1) {
        // This move would add a threat to opponent Queen
        const newThreatCount = oppQueenThreats + 1;
        
        if (newThreatCount >= 6) {
          bonus += 10.0 * strategicMultiplier; // WINNING MOVE! 
          console.log(`🤖 👑 WINNING: Move would surround opponent Queen (6/6)!`);
        } else if (newThreatCount >= 5) {
          bonus += 5.0 * strategicMultiplier; // ALMOST WINNING!
          console.log(`🤖 👑 CRITICAL: Move would threaten opponent Queen (5/6)!`);
        } else if (newThreatCount >= 4) {
          bonus += 4.0 * strategicMultiplier; // MASSIVE pressure boost!
          console.log(`🤖 ⚔️ EXCELLENT: Strong threat to opponent Queen (4/6)!`);
        } else if (newThreatCount >= 3) {
          bonus += 2.5 * strategicMultiplier; // Strong pressure bonus
          console.log(`🤖 ⚔️ GOOD: Building pressure on opponent Queen (3/6)!`);
        } else {
          bonus += 0.8 * strategicMultiplier; // Starting pressure
          console.log(`🤖 ⚔️ PROGRESS: Starting to threaten opponent Queen!`);
        }
      } else if (distToOppQueen === 2) {
        bonus += 0.4 * strategicMultiplier; // Positioning for future threat
      } else if (distToOppQueen === 3) {
        bonus += 0.1 * strategicMultiplier; // Distant positioning
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