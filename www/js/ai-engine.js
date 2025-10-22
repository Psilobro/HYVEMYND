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
  
  // MCTS Parameters - NO TIME LIMITS, DEEP THINKING ONLY
  explorationConstant: Math.sqrt(2),
  simulationDepth: 25,
  iterationsPerMove: {
    easy: 100,       // Actually think (your original goal)
    medium: 500,     // Think deeply (your original goal)  
    hard: 1500       // Think VERY deeply (your original goal)
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
  }, this.thinkingTime);
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
  const maxIterations = this.iterationsPerMove[this.difficulty];
  const timeLimit = this.timeLimit[this.difficulty];
  
  console.log(`🤖 Running ${maxIterations} MCTS iterations (NO TIME LIMIT - thinking deeply)...`);
  
  const startTime = Date.now();
  let iterations = 0;
  
  // Deep thinking approach: Run ALL iterations, no time pressure
  while (iterations < maxIterations) {
    try {
      const leaf = this.selectLeaf(rootNode);
      const child = this.expandNode(leaf);
      const result = this.simulate(child || leaf);
      this.backpropagate(child || leaf, result);
      iterations++;
      
      // Update progress and yield control periodically
      if (iterations % 50 === 0) {
        // Update thinking indicator with progress
        if (hud) {
          const progress = Math.round((iterations / maxIterations) * 100);
          hud.textContent = `🤖 AI thinking deeply... ${progress}% (${iterations}/${maxIterations} iterations)`;
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.warn(`🤖 Error in MCTS iteration ${iterations}:`, error);
      break;
    }
  }
  
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
    const score = queenBonus * 0.4 + winRate * 0.3 + (visits / iterations) * 0.2 + strategicBonus * 0.1;
    
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
    
    // **ABSOLUTE PRIORITY: FORCE Queen placement if required (MUST BE FIRST)**
    if (!hasQueen && myTurnNumber >= 3) {
      console.log(`🤖 🚨 CRITICAL: Must place Queen NOW on turn ${myTurnNumber}! (placing by turn 3)`);
      
      const queen = availablePieces.find(p => p.meta.key === 'Q');
      console.log(`🤖 🚨 Queen piece found:`, queen ? 'YES' : 'NO');
      console.log(`🤖 🚨 legalPlacementZones available:`, typeof legalPlacementZones);
      
      if (queen && typeof legalPlacementZones === 'function') {
        console.log(`🤖 🚨 About to call legalPlacementZones...`);
        try {
          const zones = legalPlacementZones(currentColor);
          console.log(`🤖 🚨 Emergency Queen zones:`, zones.size);
          console.log(`🤖 🚨 Emergency zones details:`, Array.from(zones));
          
          if (zones.size > 0) {
            const firstZone = Array.from(zones)[0];
            const [q, r] = firstZone.split(',').map(Number);
            
            console.log(`🤖 👑 EMERGENCY: Placing Queen at ${q},${r}`);
            return [{
              type: 'place',
              piece: queen,
              q: q,
              r: r,
              priority: 'emergency-queen'
            }];
          } else {
            console.error(`🤖 💥 EMERGENCY: NO ZONES for Queen placement!`);
          }
        } catch (error) {
          console.error(`🤖 💥 Emergency Queen placement failed:`, error);
          console.error(`🤖 💥 Stack trace:`, error.stack);
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
    
    // PRIORITY 2: Opening book moves (first 6 turns, if Queen not required)
    if (totalTurnNumber <= 6) {
      console.log(`🤖 📖 Using opening book for turn ${totalTurnNumber}`);
      const openingMoves = this.generateOpeningMoves(currentColor, myTurnNumber, availablePieces, allPlacedPieces, difficulty);
      console.log(`🤖 📖 Opening book generated ${openingMoves.length} moves`);
      return openingMoves;
    }
    
    // Strategic piece placement
    if (availablePieces.length > 0 && typeof legalPlacementZones === 'function') {
      const zones = legalPlacementZones(currentColor);
      console.log(`🤖 Placement zones available:`, zones.size);
      
      for (const piece of availablePieces) {
        const placements = this.generateStrategicPlacements(piece, zones, currentColor, allPlacedPieces);
        moves.push(...placements);
      }
    }
    
    // Piece movement (after Queen is placed)
    if (hasQueen && queensPlaced >= 1) {
      console.log(`🤖 Generating movement moves...`);
      for (const piece of placedPieces) {
        try {
          if (typeof legalMoveZones === 'function') {
            const moveZones = legalMoveZones(piece);
            console.log(`🤖 ${piece.meta.key} can move to ${moveZones?.length || 0} zones`);
            
            if (moveZones && moveZones.length > 0) {
              for (const zone of moveZones) {
                const [q, r] = zone.split(',').map(Number);
                const move = {
                  type: 'move',
                  piece: piece,
                  fromQ: piece.meta.q,
                  fromR: piece.meta.r,
                  q: q,
                  r: r,
                  priority: this.evaluateMoveStrategicValue(piece, q, r, allPlacedPieces, oppColor)
                };
                moves.push(move);
              }
            }
          }
        } catch (error) {
          console.warn(`🤖 Error generating moves for ${piece.meta.key}:`, error);
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
 * Opening book - strategic moves for early game
 */
window.AIEngine.generateOpeningMoves = function(currentColor, myTurnNumber, availablePieces, allPlacedPieces, difficulty = 'easy') {
  const moves = [];
  
  console.log(`🤖 📖 Opening book for my turn ${myTurnNumber} as ${currentColor} (${difficulty} difficulty)`);
  
  if (myTurnNumber === 1) {
    // My first move - if no pieces on board, place at origin; otherwise place adjacent
    if (allPlacedPieces.length === 0) {
      // Very first move of the game
      if (availablePieces.length > 0) {
        let preferredPiece;
        
        // Difficulty-specific piece selection
        if (difficulty === 'easy') {
          // Easy: simple piece preference
          preferredPiece = availablePieces.find(p => 
            p.meta.key === 'A' || p.meta.key === 'B'
          ) || availablePieces[0];
        } else if (difficulty === 'medium') {
          // Medium: strategic opening pieces
          preferredPiece = availablePieces.find(p => 
            p.meta.key === 'A' || p.meta.key === 'G' || p.meta.key === 'B'
          ) || availablePieces[0];
        } else {
          // Hard: advanced opening theory
          preferredPiece = availablePieces.find(p => 
            p.meta.key === 'A' || p.meta.key === 'S' || p.meta.key === 'G'
          ) || availablePieces[0];
        }
        
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
            const centerDistance = Math.abs(nq) + Math.abs(nr);
            let priority = centerDistance <= 1 ? 'opening-center' : 'opening-side';
            
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
    
    // Center control bonus
    const centerDistance = Math.abs(q) + Math.abs(r);
    strategicValue += Math.max(0, 3 - centerDistance) * 0.2;
    
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
        
        if (centerDistance <= 2 && protection >= 1) {
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
        
        if (isOpening && centerDistance <= 1) {
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
        if (centerDistance <= 2) {
          strategicValue += 0.2 * strategyMultiplier;
          priority = 'spider-flexible';
        }
        
        if (difficulty !== 'easy') {
          // Medium+ considers 3-step positioning
          const spiderValue = this.evaluateSpiderPositioning({q, r}, allPlacedPieces);
          strategicValue += spiderValue * 0.18;
        }
        break;
    }
    
    // Threat opponent queen if possible
    if (oppQueen) {
      const queenDistance = Math.abs(q - oppQueen.meta.q) + Math.abs(r - oppQueen.meta.r);
      if (queenDistance <= 2) {
        strategicValue += 0.3;
        priority = 'threaten-queen';
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
 * Evaluate strategic value of a piece movement
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
  const neighbors = this.getNeighborCoords(pos.q, pos.r);
  let count = 0;
  
  for (const [nq, nr] of neighbors) {
    const occupied = allPlacedPieces.some(p => p.meta.q === nq && p.meta.r === nr);
    if (!occupied) count++;
  }
  
  return count;
};

window.AIEngine.countPotentialJumps = function(pos, allPlacedPieces) {
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]
  ];
  
  let jumps = 0;
  
  for (const [dq, dr] of directions) {
    let checkQ = pos.q + dq;
    let checkR = pos.r + dr;
    let foundPiece = false;
    
    // Look for a piece to jump over
    while (Math.abs(checkQ) + Math.abs(checkR) <= 4) {
      const hasPiece = allPlacedPieces.some(p => p.meta.q === checkQ && p.meta.r === checkR);
      
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
 * Get strategic bonus for move prioritization
 */
window.AIEngine.getStrategicMoveBonus = function(move) {
  if (!move || !move.priority) return 0;
  
  // MASSIVELY enhanced Queen-focused priorities
  const priorityValues = {
    'queen-placement': 1.0,     // Must place Queen
    'forced-queen': 0.95,       // Emergency Queen placement
    'threaten-queen': 0.9,      // ATTACK opponent Queen
    'defend-queen': 0.85,       // DEFEND our Queen
    'surround-queen': 0.8,      // Close to winning
    'escape-queen': 0.75,       // Save our Queen from danger
    'opening-first': 0.7,
    'opening-center': 0.6,
    'queen-safe': 0.8,
    'beetle-aggressive': 0.5,
    'ant-opening': 0.4,
    'spider-flexible': 0.3,
    'high-value': 0.7,
    'medium-value': 0.4,
    'low-value': 0.1,
    'opening-side': 0.2,
    'normal': 0.0
  };
  
  let bonus = priorityValues[move.priority] || 0;
  
  // EXTRA bonuses for Queen-related moves
  if (move.piece && move.piece.meta && move.piece.meta.key === 'Q') {
    bonus += 0.2; // Any Queen move gets extra priority
  }
  
  // Bonus for moves that affect areas near Queens
  if (move.targetingQueen) {
    bonus += 0.3; // Moves targeting opponent Queen area
  }
  
  if (move.protectingQueen) {
    bonus += 0.25; // Moves protecting our Queen area
  }
  
  return Math.min(1.0, bonus); // Cap at 1.0
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
  
  // Position-based bonuses
  const centerDistance = Math.abs(move.q) + Math.abs(move.r);
  score += Math.max(0, 3 - centerDistance) * 0.1; // Center preference
  
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
  
  // Get difficulty for evaluation weights
  // Enhanced evaluation weights with heavy Queen focus
  const difficulty = window.AIEngine.difficulty;
  let evaluationDepth = 1.0;
  if (difficulty === 'medium') evaluationDepth = 1.5;
  else if (difficulty === 'hard') evaluationDepth = 2.0;
  
  // 1. Queen safety evaluation (CRITICAL PRIORITY - 50% weight)
  const aiQueenThreats = this.countQueenThreats(gameState, this.color);
  const oppQueenThreats = this.countQueenThreats(gameState, oppColor);
  const queenDangerDiff = this.evaluateQueenDanger(gameState, this.color, oppColor);
  
  // MASSIVE penalty for AI Queen in danger, HUGE bonus for threatening opponent Queen
  let queenScore = 0;
  
  // Defensive Queen safety (protect our Queen)
  if (aiQueenThreats >= 5) {
    queenScore -= 0.8; // Emergency: Queen almost surrounded
  } else if (aiQueenThreats >= 4) {
    queenScore -= 0.4; // High danger: Queen needs protection
  } else if (aiQueenThreats >= 3) {
    queenScore -= 0.2; // Moderate danger: Be careful
  }
  
  // Offensive Queen targeting (attack opponent Queen)
  if (oppQueenThreats >= 5) {
    queenScore += 0.9; // WIN: Opponent Queen almost surrounded
  } else if (oppQueenThreats >= 4) {
    queenScore += 0.5; // Excellent: Close to winning
  } else if (oppQueenThreats >= 3) {
    queenScore += 0.3; // Good: Building pressure
  } else if (oppQueenThreats >= 2) {
    queenScore += 0.1; // OK: Some pressure
  }
  
  score += queenScore + queenDangerDiff * 0.3 * evaluationDepth;
  
  // 2. Material value and piece positioning (20% weight)
  const materialDiff = this.evaluateMaterial(gameState, this.color, oppColor);
  score += materialDiff * 0.20;
  
  // 3. Control and mobility (20% weight)
  const controlDiff = this.evaluateControl(gameState, this.color, oppColor);
  score += controlDiff * 0.2 * evaluationDepth;
  
  // 4. Tactical patterns and threats (10% weight)
  const tacticalDiff = this.evaluateTacticalPatterns(gameState, this.color, oppColor);
  score += tacticalDiff * 0.1 * evaluationDepth;
  
  // 5. Endgame factors (5% weight)
  const endgameDiff = this.evaluateEndgame(gameState, this.color, oppColor);
  score += endgameDiff * 0.05;
  
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
    gameOver: window.state ? (window.state.gameOver || false) : false
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
  const aiPieces = gameState.tray.filter(p => p.color === aiColor && p.placed);
  const oppPieces = gameState.tray.filter(p => p.color === oppColor && p.placed);
  
  const pieceValues = { 'Q': 0, 'A': 3, 'G': 2.5, 'S': 2, 'B': 3.5 };
  
  let aiValue = 0, oppValue = 0;
  
  // Calculate piece values with positional bonuses
  for (const piece of aiPieces) {
    let value = pieceValues[piece.key] || 1;
    
    // Positional bonuses
    const centerDistance = Math.abs(piece.q) + Math.abs(piece.r);
    value += Math.max(0, 3 - centerDistance) * 0.1; // Center control bonus
    
    // Piece-specific bonuses
    if (piece.key === 'B') {
      // Beetles are more valuable when stacked or near stacks
      const isStacked = this.isPositionStacked(gameState, piece.q, piece.r);
      if (isStacked) value += 0.5;
    }
    
    aiValue += value;
  }
  
  for (const piece of oppPieces) {
    let value = pieceValues[piece.key] || 1;
    const centerDistance = Math.abs(piece.q) + Math.abs(piece.r);
    value += Math.max(0, 3 - centerDistance) * 0.1;
    
    if (piece.key === 'B') {
      const isStacked = this.isPositionStacked(gameState, piece.q, piece.r);
      if (isStacked) value += 0.5;
    }
    
    oppValue += value;
  }
  
  return (aiValue - oppValue) / 20; // Normalize
};

/**
 * Check if a position has stacked pieces
 */
window.AIEngine.isPositionStacked = function(gameState, q, r) {
  const piecesAtPosition = gameState.tray.filter(p => 
    p.placed && p.q === q && p.r === r
  );
  return piecesAtPosition.length > 1;
};

/**
 * Evaluate control and mobility
 */
window.AIEngine.evaluateControl = function(gameState, aiColor, oppColor) {
  // Territory control - count spaces dominated by each side
  let aiControl = 0, oppControl = 0;
  
  // Check key areas around each piece
  const aiPieces = gameState.tray.filter(p => p.color === aiColor && p.placed);
  const oppPieces = gameState.tray.filter(p => p.color === oppColor && p.placed);
  
  for (const piece of aiPieces) {
    const neighbors = this.getNeighborCoords(piece.q, piece.r);
    for (const [nq, nr] of neighbors) {
      const isEmpty = !gameState.tray.some(p => p.placed && p.q === nq && p.r === nr);
      if (isEmpty) aiControl += 1;
    }
  }
  
  for (const piece of oppPieces) {
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
  
  return controlDiff + mobilityDiff;
};

/**
 * Count advanced mobility considering piece-specific movement patterns
 */
window.AIEngine.countAdvancedMobility = function(gameState, color) {
  const pieces = gameState.tray.filter(p => p.color === color && p.placed);
  let mobility = 0;
  
  for (const piece of pieces) {
    // Simplified mobility based on piece type and local environment
    const neighbors = this.getNeighborCoords(piece.q, piece.r);
    const emptyNeighbors = neighbors.filter(([nq, nr]) => {
      return !gameState.tray.some(p => p.placed && p.q === nq && p.r === nr);
    });
    
    switch (piece.key) {
      case 'A': // Ant - high mobility
        mobility += emptyNeighbors.length * 2;
        break;
      case 'G': // Grasshopper - jumping mobility
        mobility += this.countJumpOptions(gameState, piece) * 1.5;
        break;
      case 'S': // Spider - specific 3-step mobility
        mobility += Math.min(emptyNeighbors.length, 3) * 1.2;
        break;
      case 'B': // Beetle - climbing mobility
        mobility += (emptyNeighbors.length + neighbors.length) * 1.3;
        break;
      default:
        mobility += emptyNeighbors.length;
    }
  }
  
  return mobility;
};

/**
 * Count jump options for grasshopper
 */
window.AIEngine.countJumpOptions = function(gameState, piece) {
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
};

/**
 * Evaluate tactical patterns and threats
 */
window.AIEngine.evaluateTacticalPatterns = function(gameState, aiColor, oppColor) {
  let tactical = 0;
  
  // Check for pins (pieces that can't move without breaking hive connectivity)
  tactical += this.countPins(gameState, oppColor) * 0.3;
  tactical -= this.countPins(gameState, aiColor) * 0.3;
  
  // Check for forks (moves that threaten multiple targets)
  tactical += this.countForkThreats(gameState, aiColor) * 0.2;
  tactical -= this.countForkThreats(gameState, oppColor) * 0.2;
  
  // Check for tempo moves (forcing opponent responses)
  tactical += this.countTempoMoves(gameState, aiColor) * 0.1;
  
  return tactical;
};

/**
 * Count pinned pieces (simplified)
 */
window.AIEngine.countPins = function(gameState, color) {
  const pieces = gameState.tray.filter(p => p.color === color && p.placed);
  let pins = 0;
  
  for (const piece of pieces) {
    // A piece is potentially pinned if removing it would split the hive
    // Simplified check: count pieces that would be isolated
    const connectedPieces = this.getConnectedPieces(gameState, piece.q, piece.r, piece);
    const totalPieces = gameState.tray.filter(p => p.placed).length;
    
    if (connectedPieces < totalPieces - 1) {
      pins++;
    }
  }
  
  return pins;
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
  // Simplified: count pieces that can threaten multiple important targets
  const pieces = gameState.tray.filter(p => p.color === color && p.placed);
  const oppColor = color === 'white' ? 'black' : 'white';
  const oppQueen = gameState.tray.find(p => p.color === oppColor && p.key === 'Q' && p.placed);
  
  let forks = 0;
  
  for (const piece of pieces) {
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
};

/**
 * Count tempo moves (moves that force responses)
 */
window.AIEngine.countTempoMoves = function(gameState, color) {
  // Simplified: count threatening moves that limit opponent options
  const oppColor = color === 'white' ? 'black' : 'white';
  const oppQueen = gameState.tray.find(p => p.color === oppColor && p.key === 'Q' && p.placed);
  
  if (!oppQueen) return 0;
  
  const aiPieces = gameState.tray.filter(p => p.color === color && p.placed);
  let tempoMoves = 0;
  
  for (const piece of aiPieces) {
    const distance = Math.abs(piece.q - oppQueen.q) + Math.abs(piece.r - oppQueen.r);
    if (distance <= 2 && (piece.key === 'A' || piece.key === 'B')) {
      tempoMoves++;
    }
  }
  
  return tempoMoves;
};

/**
 * Evaluate endgame factors
 */
window.AIEngine.evaluateEndgame = function(gameState, aiColor, oppColor) {
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
  
  return endgame;
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
    return threatsAfterMove >= 6; // All 6 neighbors occupied = win
    
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
    
    // If Queen has 4+ threats, this is emergency territory
    if (currentThreats >= 4) {
      // Check if this move is a Queen move that escapes danger
      if (move.type === 'move' && move.piece && move.piece.meta.key === 'Q') {
        console.log(`🤖 🛡️ EMERGENCY: Moving Queen to escape!`);
        return true;
      }
      
      // Check if this move blocks a threat to Queen
      const wouldBlock = queenNeighbors.some(([nq, nr]) => {
        const isEmpty = !tray.some(p => p.meta && p.meta.placed && p.meta.q === nq && p.meta.r === nr);
        return isEmpty && (move.q === nq && move.r === nr);
      });
      
      if (wouldBlock) {
        console.log(`🤖 🛡️ EMERGENCY: Blocking threat to Queen!`);
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('🤖 Error in isEmergencyDefensive:', error);
    return false;
  }
};

/**
 * CRITICAL: Calculate Queen-focused bonus for moves
 */
window.AIEngine.getQueenFocusBonus = function(move) {
  if (!move) return 0;
  
  try {
    let bonus = 0;
    const oppColor = this.color === 'white' ? 'black' : 'white';
    
    // Find both Queens
    const oppQueen = tray.find(p => 
      p.meta && p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed
    );
    const aiQueen = tray.find(p => 
      p.meta && p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed
    );
    
    // OFFENSIVE: Bonus for moves that threaten opponent Queen
    if (oppQueen) {
      const distToOppQueen = Math.abs(move.q - oppQueen.meta.q) + Math.abs(move.r - oppQueen.meta.r);
      
      if (distToOppQueen === 1) {
        bonus += 0.8; // Adjacent to opponent Queen - EXCELLENT
        console.log(`🤖 ⚔️ OFFENSIVE: Move threatens opponent Queen directly!`);
      } else if (distToOppQueen === 2) {
        bonus += 0.3; // Near opponent Queen - good positioning
      }
    }
    
    // DEFENSIVE: Bonus for moves that protect our Queen
    if (aiQueen) {
      const distToAiQueen = Math.abs(move.q - aiQueen.meta.q) + Math.abs(move.r - aiQueen.meta.r);
      
      if (distToAiQueen === 1) {
        bonus += 0.4; // Protect our Queen
        console.log(`🤖 🛡️ DEFENSIVE: Move protects AI Queen!`);
      }
    }
    
    return Math.min(1.0, bonus);
    
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