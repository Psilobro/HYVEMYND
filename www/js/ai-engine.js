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
  thinkingTime: 1500, // ms delay for move calculation
  
  // MCTS Parameters
  explorationConstant: Math.sqrt(2),
  simulationDepth: 25,
  iterationsPerMove: {
    easy: 100,
    medium: 500,
    hard: 1500
  },
  
  // Game state cache
  gameStateCache: null,
  lastMoveIndex: -1
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
  if (!this.enabled || 
      state.current !== this.color || 
      this.thinking || 
      window.animating || 
      state.gameOver) {
    return;
  }
  
  console.log(`🤖 AI (${this.color}) analyzing position...`);
  this.thinking = true;
  
  // Show thinking indicator in HUD
  const hud = document.getElementById('hud');
  const originalText = hud.textContent;
  hud.textContent = `🤖 AI is thinking...`;
  hud.style.background = 'rgba(0,0,0,0.8)';
  
  setTimeout(() => {
    try {
      const move = this.findBestMove();
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
  }, this.thinkingTime);
};

/**
 * Core MCTS algorithm to find the best move
 */
window.AIEngine.findBestMove = function() {
  console.log('🤖 Starting move search...');
  
  const gameState = this.captureGameState();
  console.log('🤖 Current game state:', gameState);
  
  // First check if we have any legal moves available
  const availableMoves = this.generateLegalMoves(gameState);
  console.log(`🤖 Found ${availableMoves.length} legal moves`);
  
  if (availableMoves.length === 0) {
    console.log('🤖 No legal moves available!');
    return null;
  }
  
  // If only one move, return it immediately
  if (availableMoves.length === 1) {
    console.log('🤖 Only one legal move, selecting it:', availableMoves[0]);
    return availableMoves[0];
  }
  
  const rootNode = new MCTSNode(gameState, null, null);
  const iterations = this.iterationsPerMove[this.difficulty];
  
  console.log(`🤖 Running ${iterations} MCTS iterations...`);
  
  // Run MCTS iterations
  for (let i = 0; i < iterations; i++) {
    try {
      const leaf = this.selectLeaf(rootNode);
      const child = this.expandNode(leaf);
      const result = this.simulate(child || leaf);
      this.backpropagate(child || leaf, result);
    } catch (error) {
      console.warn(`🤖 Error in MCTS iteration ${i}:`, error);
    }
  }
  
  console.log(`🤖 MCTS completed. Root has ${rootNode.children.length} children.`);
  
  // Select best move based on visit count
  let bestChild = null;
  let bestVisits = -1;
  
  for (const child of rootNode.children) {
    const winRate = child.visits > 0 ? (child.wins/child.visits*100).toFixed(1) : '0.0';
    console.log(`🤖 Move ${child.move.type} ${child.move.piece?.key || '?'} to ${child.move.q},${child.move.r}: ${child.visits} visits, ${winRate}% win rate`);
    
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      bestChild = child;
    }
  }
  
  if (bestChild) {
    console.log('🤖 Selected best move:', bestChild.move);
    return bestChild.move;
  } else {
    console.log('🤖 No best move found, falling back to first available move');
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
  let currentState = JSON.parse(JSON.stringify(node.gameState));
  let depth = 0;
  
  while (!this.isGameOver(currentState) && depth < this.simulationDepth) {
    const moves = this.generateLegalMoves(currentState);
    if (moves.length === 0) break;
    
    // Use weighted selection for better simulation quality
    const move = this.selectSimulationMove(moves, currentState);
    currentState = this.applyMoveToState(currentState, move);
    depth++;
  }
  
  return this.evaluatePosition(currentState);
};

/**
 * MCTS Backpropagation phase
 */
window.AIEngine.backpropagate = function(node, result) {
  while (node !== null) {
    node.visits++;
    // Result is from current player's perspective
    if (node.gameState.currentPlayer === this.color) {
      node.wins += result;
    } else {
      node.wins += (1 - result);
    }
    node = node.parent;
  }
};

/**
 * Generate all legal moves for the current position
 */
window.AIEngine.generateLegalMoves = function(gameState) {
  const moves = [];
  const currentColor = gameState.currentPlayer;
  
  console.log(`🤖 Generating moves for ${currentColor}, game state:`, gameState);
  
  // For the root node, use live game state functions
  // For simulated states, use simplified move generation
  const isRootNode = gameState === this.captureGameState() || 
                    JSON.stringify(gameState) === JSON.stringify(this.captureGameState());
  
  if (isRootNode) {
    // Use live game functions for accurate move generation
    return this.generateLiveGameMoves(currentColor);
  } else {
    // Use simplified simulation moves for internal MCTS nodes
    return this.generateSimulationMoves(gameState, currentColor);
  }
};

/**
 * Generate moves using live game state functions
 */
window.AIEngine.generateLiveGameMoves = function(currentColor) {
  const moves = [];
  
  console.log(`🤖 Using live game functions for ${currentColor}`);
  
  // Get available pieces from actual tray
  const availablePieces = window.tray ? window.tray.filter(p => 
    p.color === currentColor && !p.placed
  ) : [];
  
  // Get placed pieces from actual tray
  const placedPieces = window.tray ? window.tray.filter(p => 
    p.color === currentColor && p.placed
  ) : [];
  
  console.log(`🤖 Available pieces: ${availablePieces.length}, Placed pieces: ${placedPieces.length}`);
  
  // Generate placement moves using live game function
  try {
    if (typeof legalPlacementZones === 'function') {
      const placementZones = legalPlacementZones(currentColor);
      console.log(`🤖 Legal placement zones:`, placementZones);
      
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
  } catch (error) {
    console.error('🤖 Error in placement move generation:', error);
  }
  
  // Generate movement moves using live game function
  try {
    if (typeof legalMoveZones === 'function') {
      for (const piece of placedPieces) {
        try {
          const moveZones = legalMoveZones(piece);
          const zones = Array.isArray(moveZones) ? moveZones : Array.from(moveZones || []);
          
          for (const destKey of zones) {
            const [q, r] = destKey.split(',').map(Number);
            moves.push({
              type: 'move',
              piece: piece,
              q: q,
              r: r
            });
          }
        } catch (pieceError) {
          console.warn('🤖 Error generating moves for piece:', piece, pieceError);
        }
      }
    }
  } catch (error) {
    console.error('🤖 Error in movement move generation:', error);
  }
  
  console.log(`🤖 Generated ${moves.length} total moves`);
  return moves;
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
 * Position evaluation using Hive-specific heuristics
 */
window.AIEngine.evaluatePosition = function(gameState) {
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
  
  // Queen safety evaluation (most critical)
  const aiQueenThreats = this.countQueenThreats(gameState, this.color);
  const oppColor = this.color === 'white' ? 'black' : 'white';
  const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
  
  // Favor threatening opponent queen while keeping own queen safe
  score += (oppQueenThreats - aiQueenThreats) * 0.15;
  
  // Piece mobility evaluation
  const aiMobility = this.countMobility(gameState, this.color);
  const oppMobility = this.countMobility(gameState, oppColor);
  score += (aiMobility - oppMobility) * 0.02;
  
  // Development and center control
  const aiDevelopment = this.evaluateDevelopment(gameState, this.color);
  const oppDevelopment = this.evaluateDevelopment(gameState, oppColor);
  score += (aiDevelopment - oppDevelopment) * 0.03;
  
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
    if (typeof selectPlacement === 'function' && typeof commitPlacement === 'function') {
      console.log(`🤖 Placing ${move.piece?.key || '?'} at ${move.q},${move.r}`);
      try {
        selectPlacement(move.piece);
        setTimeout(() => {
          try {
            commitPlacement(move.q, move.r);
            console.log('🤖 Placement completed successfully');
          } catch (error) {
            console.error('🤖 Error in commitPlacement:', error);
          }
        }, 300);
      } catch (error) {
        console.error('🤖 Error in selectPlacement:', error);
      }
    } else {
      console.error('🤖 Placement functions not available');
    }
  } else if (move.type === 'move') {
    if (typeof selectMove === 'function' && typeof commitMove === 'function') {
      console.log(`🤖 Moving ${move.piece?.key || '?'} to ${move.q},${move.r}`);
      try {
        selectMove(move.piece);
        setTimeout(() => {
          try {
            commitMove(move.q, move.r);
            console.log('🤖 Movement completed successfully');
          } catch (error) {
            console.error('🤖 Error in commitMove:', error);
          }
        }, 300);
      } catch (error) {
        console.error('🤖 Error in selectMove:', error);
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
  return {
    currentPlayer: state.current,
    moveNumber: state.moveNumber || 0,
    tray: JSON.parse(JSON.stringify(tray)), // Deep copy
    gameOver: state.gameOver || false
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
  
  console.log(`🤖 AI enabled as ${this.color} player (${difficulty} difficulty)`);
  
  // Hook into the game's turn system
  this.hookIntoGame();
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

// Initialize AI engine when script loads
console.log('🤖 AI Engine loaded successfully');