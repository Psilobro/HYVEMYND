/**
 * HYVEMYND AI Engine V2 - True Hybrid Architecture
 * Intelligent MCTS + Minimax + Strategic Patterns
 */

// V2 AI Engine with Smart Iteration Scaling
window.AIEngineV2 = {
  // AI Configuration
  enabled: false,
  difficulty: 'medium',
  color: 'black',
  thinking: false,
  debugMode: false,
  
  // INTELLIGENT ITERATION SCALING
  baseIterations: {
    easy: 500,      // Fast decisions
    medium: 1500,   // Balanced
    hard: 3000      // Deep thinking when needed
  },
  
  // STRATEGIC DEPTH SYSTEM
  phases: {
    opening: { depth: 2, iterations: 200 },   // Quick opening book
    early: { depth: 3, iterations: 800 },     // Piece development
    middle: { depth: 4, iterations: 1500 },   // Queen threats
    endgame: { depth: 6, iterations: 3000 }   // Deep calculation
  },
  
  // POSITION EVALUATION CACHE
  positionCache: new Map(),
  evaluationDepth: 0,
  
  /**
   * Enhanced thinking UI with progress tracking
   */
  updateThinkingUI: function(phase, progress, data = {}) {
    // Get the current opponent's name, fallback to "Beedric" for V2 engine
    let aiName = "Beedric";
    if (window.Personalities && window.Personalities.currentOpponent) {
      aiName = window.Personalities.currentOpponent.name.split(' ')[0]; // Use first name only
    }
    
    const messages = {
      'analyzing': `🧠 ${aiName}: Analyzing position complexity...`,
      'tactical': `⚡ ${aiName}: Seeking tactical solutions...`,
      'strategic': `🎯 ${aiName}: Strategic pattern recognition...`,
      'searching': `🌳 ${aiName}: Focused tree search...`,
      'evaluating': `📊 ${aiName}: Deep position evaluation...`,
      'simulating': `🎲 ${aiName}: Monte Carlo simulations...`,
      'calculating': `🧮 ${aiName}: Calculating variations...`,
      'optimizing': `⚙️ ${aiName}: Optimizing move selection...`,
      'finalizing': `✨ ${aiName}: Selecting optimal move...`,
      'complete': `✅ ${aiName}: Analysis complete!`
    };
    
    const message = messages[phase] || `🧠 ${aiName}: Thinking...`;
    const progressBar = this.createProgressBar(progress);
    
    // Calculate time
    const elapsed = data.elapsed || 0;
    const timeDisplay = elapsed > 0 ? ` (${(elapsed/1000).toFixed(1)}s)` : '';
    
    // Update UI
    const thinkingElement = document.getElementById('thinking-status');
    if (thinkingElement) {
      thinkingElement.innerHTML = `${message}<br>${progressBar} ${progress}%${timeDisplay}`;
    }
  },
  
  /**
   * Create ASCII progress bar
   */
  createProgressBar: function(progress) {
    const width = 20;
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  },
  
  /**
   * SMART ITERATION CALCULATION
   * Scales iterations based on position complexity
   */
  calculateOptimalIterations: function(gameState) {
    const phase = this.getGamePhase(gameState);
    const complexity = this.analyzePositionComplexity(gameState);
    const urgency = this.detectUrgentSituations(gameState);
    
    let baseCount = this.phases[phase].iterations;
    
    // Scale based on complexity
    if (complexity > 0.8) baseCount *= 1.5;
    else if (complexity < 0.3) baseCount *= 0.6;
    
    // Scale based on urgency
    if (urgency.level === 'critical') baseCount *= 2;
    else if (urgency.level === 'high') baseCount *= 1.3;
    
    // Cap at reasonable limits (500-5000 instead of 30k)
    return Math.min(5000, Math.max(500, Math.round(baseCount)));
  },
  
  /**
   * HYBRID MOVE ANALYSIS - Main entry point
   */
  findBestMove: async function() {
    console.log('🧠 AI V2: Starting hybrid analysis...');
    
    // Initial progress
    this.updateThinkingUI('analyzing', 5);
    
    const gameState = this.captureGameState();
    const phase = this.getGamePhase(gameState);
    const urgency = this.detectUrgentSituations(gameState);
    
    console.log(`🧠 Game Phase: ${phase}, Urgency: ${urgency.level} (${urgency.reason})`);
    
    // PHASE 1: Check for immediate tactical solutions
    if (urgency.level === 'critical') {
      this.updateThinkingUI('tactical', 15);
      console.log('🧠 ⚡ CRITICAL SITUATION - Using deep minimax...');
      const tacticalMove = await this.solveTacticalPosition(gameState, 6);
      if (tacticalMove) {
        console.log('🧠 ✅ Tactical solution found!');
        this.updateThinkingUI('complete', 100);
        return tacticalMove;
      }
    }
    
    // PHASE 2: Opening book for early game
    if (phase === 'opening') {
      this.updateThinkingUI('strategic', 25);
      console.log('🧠 📖 Using optimized opening book...');
      const openingMove = this.getOptimizedOpeningMove(gameState);
      if (openingMove) {
        console.log('🧠 ✅ Opening book move selected!');
        this.updateThinkingUI('complete', 100);
        return openingMove;
      }
    }
    
    // PHASE 3: Strategic pattern recognition
    this.updateThinkingUI('strategic', 40);
    console.log('🧠 🎯 Analyzing strategic patterns...');
    const strategicMoves = this.analyzeStrategicPatterns(gameState);
    
    // PHASE 4: Focused MCTS with smart iteration count
    const iterations = this.calculateOptimalIterations(gameState);
    console.log(`🧠 🌳 Running focused MCTS with ${iterations} iterations...`);
    
    const mctsResult = await this.runFocusedMCTS(gameState, strategicMoves, iterations);
    
    // PHASE 5: Final selection and validation
    this.updateThinkingUI('finalizing', 90);
    console.log('🧠 ⚡ Selecting optimal move...');
    
    // Fallback to basic move if no MCTS result
    const finalMove = mctsResult || this.selectBestBasicMove(gameState);
    
    console.log('🧠 ✅ V2 Hybrid Analysis Complete!');
    this.updateThinkingUI('complete', 100);
    
    return finalMove;
  },
  
  /**
   * Get all possible moves for current player
   */
  getAllPossibleMoves: function() {
    const moves = [];
    
    // Get placement moves
    const placementZones = legalPlacementZones(this.color);
    for (const destination of placementZones) {
      const [q, r] = destination.split(',').map(Number);
      
      // Try each unplaced piece
      for (const piece of tray) {
        if (piece.meta.color === this.color && !piece.placed) {
          // Queen must be placed by 4th move
          if (piece.meta.key === 'Q') {
            const placedCount = tray.filter(p => p.meta.color === this.color && p.placed).length;
            if (placedCount >= 3) {
              moves.push({ type: 'place', piece, q, r });
            }
          } else {
            // Other pieces (check queen requirement)
            const queenPlaced = tray.some(p => p.meta.color === this.color && p.meta.key === 'Q' && p.placed);
            if (queenPlaced || tray.filter(p => p.meta.color === this.color && p.placed).length < 3) {
              moves.push({ type: 'place', piece, q, r });
            }
          }
        }
      }
    }
    
    // Get movement moves
    for (const piece of tray) {
      if (piece.meta.color === this.color && piece.placed) {
        const moveZones = legalMoveZones(piece);
        if (moveZones && moveZones.length > 0) {
          for (const destination of moveZones) {
            const [q, r] = destination.split(',').map(Number);
            moves.push({ type: 'move', piece, q, r });
          }
        }
      }
    }
    
    return moves;
  },

  /**
   * Get neighboring hex coordinates
   */
  getNeighbors: function(q, r) {
    return [
      [q + 1, r],     [q + 1, r - 1],
      [q, r - 1],     [q - 1, r],
      [q - 1, r + 1], [q, r + 1]
    ];
  },

  /**
   * Fallback move selection using basic evaluation
   */
  selectBestBasicMove: function(gameState) {
    console.log('🧠 Using fallback basic move selection with aggressive queen pinning...');
    
    // Get all possible moves
    const allMoves = this.getAllPossibleMoves();
    if (allMoves.length === 0) return null;
    
    // AGGRESSIVE evaluation - prioritize queen pinning over everything
    let bestMove = null;
    let bestScore = -10000;
    
    console.log(`🧠 Evaluating ${allMoves.length} moves with aggressive queen pinning logic...`);
    
    for (const move of allMoves) {
      let score = 0;
      
      // FIRST: Apply aggressive move scoring (includes wussy move penalties)
      const aggressiveScore = this.scoreAggressiveMove(move);
      score += aggressiveScore;
      
      // SECOND: Basic positional scoring (lower priority)
      const distance = Math.abs(move.q) + Math.abs(move.r);
      score -= distance * 5; // Reduced weight compared to aggression
      
      // THIRD: Piece type bonuses (much lower priority)
      if (move.piece) {
        const pieceValues = { 'Q': 20, 'B': 15, 'S': 12, 'G': 10, 'A': 8 };
        score += pieceValues[move.piece.meta.key] || 5;
      }
      
      // FOURTH: Basic threat detection (lower priority)
      if (move.type === 'move' && this.threatensPieces(move)) {
        score += 15;
      }
      
      console.log(`🧠 Move ${move.type} ${move.piece?.meta.key || '?'} to (${move.q},${move.r}): Score = ${score} (Aggressive: ${aggressiveScore})`);
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    console.log(`🧠 Selected move with score ${bestScore}: ${bestMove.type} ${bestMove.piece?.meta.key || '?'} to (${bestMove.q},${bestMove.r})`);
    return bestMove;
  },
  
  /**
   * Check if a move threatens opponent pieces
   */
  threatensPieces: function(move) {
    // Basic threat detection - check adjacent cells for opponent pieces
    const neighbors = this.getNeighbors(move.q, move.r);
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta.color !== this.color) {
          return true;
        }
      }
    }
    return false;
  },

  /**
   * AGGRESSIVE QUEEN PINNING DETECTION
   * Find opponent queens and assess pinning opportunities
   */
  analyzeQueenPinning: function() {
    const opponentColor = this.color === 'white' ? 'black' : 'white';
    const analysis = {
      queens: [],
      pinningOpportunities: [],
      totalPinningScore: 0
    };
    
    // Find all opponent queens
    for (const piece of tray) {
      if (piece.meta.color === opponentColor && piece.meta.key === 'Q' && piece.placed) {
        const queenPos = { q: piece.q, r: piece.r };
        const surroundingInfo = this.analyzeQueenSurrounding(queenPos, opponentColor);
        
        analysis.queens.push({
          position: queenPos,
          piece: piece,
          ...surroundingInfo
        });
        
        analysis.totalPinningScore += surroundingInfo.pinningScore;
      }
    }
    
    return analysis;
  },

  /**
   * Analyze how well a queen is surrounded/pinned
   */
  analyzeQueenSurrounding: function(queenPos, queenColor) {
    const neighbors = this.getNeighbors(queenPos.q, queenPos.r);
    let occupiedAdjacent = 0;
    let myPiecesAdjacent = 0;
    let emptyAdjacent = [];
    let moveBlockedCount = 0;
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        occupiedAdjacent++;
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta.color === this.color) {
          myPiecesAdjacent++;
        }
      } else {
        emptyAdjacent.push({ q: nq, r: nr });
      }
    }
    
    // Calculate how blocked the queen's movement is
    moveBlockedCount = 6 - emptyAdjacent.length;
    
    const pinningScore = (myPiecesAdjacent * 20) + (moveBlockedCount * 10);
    const isHighPriority = myPiecesAdjacent >= 2 || moveBlockedCount >= 4;
    
    return {
      occupiedAdjacent,
      myPiecesAdjacent,
      emptyAdjacent,
      moveBlockedCount,
      pinningScore,
      isHighPriority,
      canWinNextMove: myPiecesAdjacent >= 5,
      needsMorePressure: myPiecesAdjacent < 4
    };
  },

  /**
   * NO WUSSY MOVES FILTER
   * Heavily penalize passive or non-productive moves
   */
  isWussyMove: function(move) {
    // Check if move returns piece to same position (major wussy move)
    if (move.type === 'move' && move.piece.q === move.q && move.piece.r === move.r) {
      console.log('🚫 WUSSY ALERT: Piece moving to same position!');
      return true;
    }
    
    // Check if move doesn't contribute to queen pressure when queen is vulnerable
    const queenAnalysis = this.analyzeQueenPinning();
    if (queenAnalysis.queens.length > 0) {
      const vulnerableQueens = queenAnalysis.queens.filter(q => q.needsMorePressure);
      
      if (vulnerableQueens.length > 0) {
        // Check if this move contributes to pinning any vulnerable queen
        const contributesToPinning = vulnerableQueens.some(queen => {
          const distance = Math.abs(move.q - queen.position.q) + Math.abs(move.r - queen.position.r);
          return distance <= 2; // Within striking distance
        });
        
        if (!contributesToPinning) {
          console.log('🚫 WUSSY ALERT: Move doesn\'t contribute to queen pinning!');
          return true;
        }
      }
    }
    
    return false;
  },

  /**
   * AGGRESSIVE MOVE SCORING
   * Heavily reward moves that contribute to queen pinning
   */
  scoreAggressiveMove: function(move) {
    let score = 0;
    
    // MASSIVE penalty for wussy moves
    if (this.isWussyMove(move)) {
      return -1000;
    }
    
    // Analyze queen pinning potential
    const queenAnalysis = this.analyzeQueenPinning();
    
    for (const queen of queenAnalysis.queens) {
      const beforeDistance = Math.abs(move.piece.q - queen.position.q) + Math.abs(move.piece.r - queen.position.r);
      const afterDistance = Math.abs(move.q - queen.position.q) + Math.abs(move.r - queen.position.r);
      
      // Reward getting closer to vulnerable queens
      if (queen.needsMorePressure) {
        if (afterDistance < beforeDistance) {
          score += 100; // Major bonus for approaching queen
        }
        
        // HUGE bonus for moves that directly pin the queen
        if (afterDistance === 1) {
          score += 200; // Adjacent to queen = major pressure
        }
        
        // Check if this move would block queen's escape routes
        const wouldBlockEscape = queen.emptyAdjacent.some(empty => 
          Math.abs(move.q - empty.q) + Math.abs(move.r - empty.r) <= 1
        );
        
        if (wouldBlockEscape) {
          score += 150; // Bonus for blocking escape routes
        }
      }
      
      // Game-winning moves get massive bonus
      if (queen.myPiecesAdjacent >= 4 && afterDistance === 1) {
        score += 500; // Near win condition
      }
    }
    
    return score;
  },

  /**
   * FOCUSED MCTS - Only explore promising moves with progress tracking
   */
  runFocusedMCTS: async function(gameState, candidateMoves, maxIterations) {
    const startTime = Date.now();
    
    // Limit candidate moves to top 8 most promising
    const focusedMoves = candidateMoves.slice(0, 8);
    console.log(`🧠 Focusing MCTS on top ${focusedMoves.length} moves instead of all possibilities`);
    
    if (focusedMoves.length === 0) {
      return null;
    }
    
    let bestMove = null;
    let bestScore = -Infinity;
    
    // Simulate each promising move
    for (let i = 0; i < focusedMoves.length; i++) {
      const move = focusedMoves[i];
      
      // Progress tracking for each move
      const moveProgress = Math.round(50 + (i / focusedMoves.length) * 40);
      const elapsed = Date.now() - startTime;
      this.updateThinkingUI('searching', moveProgress, { elapsed });
      
      // Run smaller MCTS for this specific move
      const iterationsPerMove = Math.round(maxIterations / focusedMoves.length);
      const score = await this.evaluateMoveWithMCTS(move, iterationsPerMove);
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return bestMove;
  },

  /**
   * Evaluate a specific move using mini-MCTS
   */
  evaluateMoveWithMCTS: async function(move, iterations) {
    // Simplified MCTS evaluation
    let totalScore = 0;
    
    for (let i = 0; i < iterations; i++) {
      // Simulate the move
      const score = this.simulateRandomGame(move);
      totalScore += score;
      
      // Periodic progress updates for long simulations
      if (i % 100 === 0 && iterations > 500) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }
    
    return totalScore / iterations;
  },

  /**
   * Simulate a random game from a move - Enhanced with aggressive evaluation
   */
  simulateRandomGame: function(initialMove) {
    let score = 0;
    
    // PRIMARY: Aggressive queen pinning evaluation
    const aggressiveScore = this.scoreAggressiveMove(initialMove);
    score += aggressiveScore * 3; // Triple weight in simulation
    
    // SECONDARY: Basic move evaluation
    if (initialMove.type === 'place') {
      score += 10; // Placement bonus
      if (initialMove.piece.meta.key === 'Q') score += 20; // Queen placement
    } else {
      score += 15; // Movement bonus
      if (this.threatensPieces(initialMove)) score += 25; // Threatening moves
    }
    
    // TERTIARY: Add some randomness (much reduced)
    score += Math.random() * 5 - 2.5;
    
    return score;
  },

  // PLACEHOLDER METHODS - Will use simplified implementations
  captureGameState: function() {
    return {
      pieces: tray.filter(p => p.placed),
      turn: state.current,
      moveCount: tray.filter(p => p.placed).length
    };
  },

  getGamePhase: function(gameState) {
    const moveCount = gameState.moveCount;
    if (moveCount < 6) return 'opening';
    if (moveCount < 12) return 'early';
    if (moveCount < 20) return 'middle';
    return 'endgame';
  },

  analyzePositionComplexity: function(gameState) {
    // Simple complexity based on number of pieces and possible moves
    const pieceCount = gameState.pieces.length;
    const possibleMoves = this.getAllPossibleMoves().length;
    
    // Normalize to 0-1 scale
    return Math.min(1, (pieceCount * possibleMoves) / 100);
  },

  detectUrgentSituations: function(gameState) {
    // Simplified urgency detection
    const possibleMoves = this.getAllPossibleMoves().length;
    
    if (possibleMoves < 3) {
      return { level: 'critical', reason: 'Very few moves available' };
    } else if (possibleMoves < 8) {
      return { level: 'high', reason: 'Limited moves available' };
    } else {
      return { level: 'normal', reason: 'Multiple options available' };
    }
  },

  solveTacticalPosition: async function(gameState, depth) {
    // Simplified tactical solver - just return the first available move
    const moves = this.getAllPossibleMoves();
    return moves.length > 0 ? moves[0] : null;
  },

  getOptimizedOpeningMove: function(gameState) {
    // Simple opening book - prefer queen or center placement
    const moves = this.getAllPossibleMoves();
    
    // Look for queen placement first
    for (const move of moves) {
      if (move.type === 'place' && move.piece.meta.key === 'Q') {
        return move;
      }
    }
    
    // Otherwise, prefer center positions
    return moves.find(move => Math.abs(move.q) + Math.abs(move.r) <= 2) || moves[0];
  },

  analyzeStrategicPatterns: function(gameState) {
    // Get all possible moves and score them strategically with AGGRESSIVE PRIORITY
    const allMoves = this.getAllPossibleMoves();
    
    console.log(`🧠 Analyzing ${allMoves.length} moves with aggressive queen pinning priority...`);
    
    // Score each move with aggressive pinning as top priority
    const scoredMoves = allMoves.map(move => {
      let score = 0;
      
      // PRIMARY: Aggressive queen pinning (highest priority)
      const aggressiveScore = this.scoreAggressiveMove(move);
      score += aggressiveScore * 2; // Double weight for aggression
      
      // SECONDARY: Center preference (lower priority)
      const distance = Math.abs(move.q) + Math.abs(move.r);
      score += (10 - distance) * 0.5; // Reduced weight
      
      // TERTIARY: Piece type preference (lowest priority)
      if (move.piece) {
        const pieceValues = { 'Q': 25, 'B': 20, 'S': 15, 'G': 12, 'A': 10 };
        score += (pieceValues[move.piece.meta.key] || 5) * 0.3; // Much reduced weight
      }
      
      // QUATERNARY: Movement vs placement preference
      if (move.type === 'move') score += 3;
      
      return { move, score, aggressiveScore };
    });
    
    // Sort by score with aggressive moves at top
    scoredMoves.sort((a, b) => b.score - a.score);
    
    // Log top moves for debugging
    console.log('🧠 Top 5 strategic moves:');
    for (let i = 0; i < Math.min(5, scoredMoves.length); i++) {
      const item = scoredMoves[i];
      console.log(`  ${i+1}. ${item.move.type} ${item.move.piece?.meta.key || '?'} to (${item.move.q},${item.move.r}) - Score: ${item.score.toFixed(1)} (Aggressive: ${item.aggressiveScore})`);
    }
    
    return scoredMoves.map(item => item.move);
  }
};

console.log('🧠 AI Engine V2 loaded with Smart Iteration Scaling!');