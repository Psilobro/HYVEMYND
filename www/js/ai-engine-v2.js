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
    
  // Cap at reasonable limits (500-3000 instead of 30k)
  return Math.min(3000, Math.max(500, Math.round(baseCount)));
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
    
    // TEMPORARY: Force strategic scoring instead of MCTS to test Queen attack fixes
    console.log('🧠 � FORCING STRATEGIC SCORING (MCTS disabled for testing)');
    
    // PHASE 5: Final selection and validation
    this.updateThinkingUI('finalizing', 90);
    console.log('🧠 ⚡ Selecting optimal move...');
    
    // Use strategic moves directly instead of MCTS
    const finalMove = strategicMoves.length > 0 ? strategicMoves[0] : this.selectBestBasicMove(gameState);
    
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
            const placedCount = tray.filter(p => p.meta.color === this.color && p.meta.placed).length;
            if (placedCount >= 3) {
              moves.push({ type: 'place', piece, q, r });
            }
          } else {
            // Other pieces (check queen requirement)
            const queenPlaced = tray.some(p => p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed);
            if (queenPlaced || tray.filter(p => p.meta.color === this.color && p.meta.placed).length < 3) {
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
    
    // CRITICAL FIRST MOVE SAFEGUARD
    const totalPiecesPlaced = (typeof tray !== 'undefined') ? tray.filter(p => p.meta && p.meta.placed).length : 0;
    if (totalPiecesPlaced === 0 && allMoves.length === 0) {
      console.error(`🧠 💥 CRITICAL: No first moves generated in V2 engine! Creating emergency move...`);
      const availablePieces = tray.filter(p => p.meta && p.meta.color === this.getAIColor() && !p.meta.placed);
      if (availablePieces.length > 0) {
        return {
          type: 'place',
          piece: availablePieces[0],
          q: 0,
          r: 0,
          priority: 'emergency-first-move-v2',
          reasoning: 'V2 Emergency fallback to prevent illegal pass on first move'
        };
      }
    }
    
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
   * STRATEGIC GAME PLAN SYSTEM
   * Creates multi-move plans focused on queen pinning progression
   */
  createStrategicGamePlan: function(gameState) {
    const queenAnalysis = this.analyzeQueenPinning();
    const plan = {
      phase: 'none',
      priority: 'low',
      objectives: [],
      immediateGoal: null,
      pieceDeploymentTarget: 0
    };
    
    // CRITICAL: Check if our queen is isolated and vulnerable
    const ourQueenIsolation = this.checkOurQueenIsolation();
    if (ourQueenIsolation.isIsolated) {
      plan.phase = 'emergency-support';
      plan.priority = 'critical';
      plan.immediateGoal = 'PROTECT_OUR_QUEEN';
      plan.objectives = [
        'URGENT: Place pieces next to our Queen immediately!',
        'Prevent opponent from pinning our Queen',
        'Build defensive cluster around Queen'
      ];
      return plan;
    }
    
    if (queenAnalysis.queens.length === 0) {
      plan.phase = 'pre-queen';
      plan.objectives = ['Place pieces aggressively', 'Prepare for queen hunting'];
      return plan;
    }
    
    const targetQueen = queenAnalysis.queens[0]; // Focus on first opponent queen
    const piecesPlaced = this.getMyPlacedPieces().length;
    const opponentPieces = this.getOpponentPlacedPieces().length;
    
    // CRITICAL: Must keep up with opponent piece count
    if (piecesPlaced < opponentPieces) {
      plan.phase = 'catch-up-deployment';
      plan.priority = 'critical';
      plan.immediateGoal = 'DEPLOY_MORE_PIECES';
      plan.objectives = [
        'Deploy pieces immediately - we are behind!',
        'Place pieces near queen to maintain pressure',
        'Do NOT waste moves repositioning'
      ];
      plan.pieceDeploymentTarget = opponentPieces + 1;
      return plan;
    }
    
    // NEW: If we have equal or more pieces, prioritize movement and tactics
    if (piecesPlaced >= opponentPieces && piecesPlaced >= 4) { // Increased threshold from 3 to 4
      plan.phase = 'tactical-movement';
      plan.priority = 'high';
      plan.immediateGoal = 'MOVE_AND_THREATEN';
      plan.objectives = [
        'Move pieces into threatening positions',
        'Look for tactical opportunities',
        'Only place pieces when absolutely necessary'
      ];
      return plan;
    }
    
    // Analyze queen pinning status
    if (targetQueen.myPiecesAdjacent === 0) {
      plan.phase = 'initial-pin';
      plan.priority = 'high';
      plan.immediateGoal = 'ESTABLISH_FIRST_PIN';
      plan.objectives = [
        'Get first piece adjacent to enemy queen',
        'Establish initial pin pressure',
        'Deploy supporting pieces nearby'
      ];
    } else if (targetQueen.myPiecesAdjacent < 3) {
      plan.phase = 'build-pressure';
      plan.priority = 'high';
      plan.immediateGoal = 'ADD_MORE_PINNING_PIECES';
      plan.objectives = [
        'Add more pieces adjacent to queen',
        'Block queen escape routes',
        'Deploy remaining pieces for support'
      ];
    } else if (targetQueen.myPiecesAdjacent < 5) {
      plan.phase = 'near-victory';
      plan.priority = 'critical';
      plan.immediateGoal = 'COMPLETE_SURROUND';
      plan.objectives = [
        'Complete queen surrounding',
        'Block all remaining escape routes',
        'Victory is within reach!'
      ];
    } else {
      plan.phase = 'victory-execution';
      plan.priority = 'critical';
      plan.immediateGoal = 'WIN_GAME';
      plan.objectives = ['Close the final gap and win!'];
    }
    
    return plan;
  },

  /**
   * Check if our queen is isolated and vulnerable to pinning
   */
  checkOurQueenIsolation: function() {
    const pieces = window.tray || tray;
    const ourQueen = pieces?.find(p => p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed);
    
    if (!ourQueen) {
      return { isIsolated: false, reason: 'Queen not placed' };
    }
    
    // Count our pieces adjacent to our queen
    const neighbors = this.getNeighbors(ourQueen.q, ourQueen.r);
    let ourAdjacentPieces = 0;
    let totalOurPieces = 0;
    
    // Count total pieces we have placed
    for (const piece of pieces) {
      if (piece.meta.color === this.color && piece.meta.placed) {
        totalOurPieces++;
      }
    }
    
    // Count our pieces adjacent to queen
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta.color === this.color) {
          ourAdjacentPieces++;
        }
      }
    }
    
    // Queen is isolated if:
    // 1. It's the ONLY piece we have (extremely dangerous!)
    // 2. We have multiple pieces but none adjacent to queen
    const isIsolated = (totalOurPieces === 1) || (totalOurPieces > 1 && ourAdjacentPieces === 0);
    
    let reason = '';
    if (totalOurPieces === 1) {
      reason = 'Queen is our ONLY piece - extremely vulnerable to pinning!';
    } else if (ourAdjacentPieces === 0) {
      reason = `Queen has no adjacent support pieces (${totalOurPieces} total pieces)`;
    } else {
      reason = `Queen has ${ourAdjacentPieces} adjacent support pieces`;
    }
    
    return {
      isIsolated,
      reason,
      totalPieces: totalOurPieces,
      adjacentSupport: ourAdjacentPieces,
      queenPosition: { q: ourQueen.q, r: ourQueen.r }
    };
  },

  /**
   * Get opponent placed pieces count  
   */
  getOpponentPlacedPieces: function() {
    const opponentColor = this.color === 'white' ? 'black' : 'white';
    return tray.filter(p => p.meta.color === opponentColor && p.meta.placed);
  },

  /**
   * STRATEGIC MOVE FILTERING
   * Heavily penalize moves that don't align with current game plan
   */
  filterMovesByStrategy: function(moves, gameState) {
    const plan = this.createStrategicGamePlan(gameState);
    const filteredMoves = [];
    
    console.log(`🎯 STRATEGIC PLAN: ${plan.phase} (${plan.priority} priority)`);
    console.log(`🎯 IMMEDIATE GOAL: ${plan.immediateGoal}`);
    console.log(`🎯 OBJECTIVES: ${plan.objectives.join(', ')}`);
    
    // EMERGENCY OVERRIDE: Check if our queen is in immediate danger!
    const ourQueenThreat = this.analyzeOurQueenSafety();
    if (ourQueenThreat.level === 'critical' || ourQueenThreat.level === 'extreme') {
      console.log(`🚨🚨 QUEEN IN DANGER! Threat level: ${ourQueenThreat.level} (${ourQueenThreat.occupied}/6 surrounded)`);
      console.log(`🚨 Emergency override: Only allowing defensive moves!`);
      
      // Filter only defensive moves
      for (const move of moves) {
        if (this.isDefensiveMove(move, ourQueenThreat)) {
          filteredMoves.push(move);
          console.log(`🛡️ DEFENSIVE MOVE: ${move.type} ${move.piece?.meta.key} to (${move.q},${move.r})`);
        }
      }
      
      if (filteredMoves.length > 0) {
        console.log(`🛡️ Found ${filteredMoves.length} defensive moves - using these instead!`);
        return filteredMoves;
      } else {
        console.log(`😱 NO DEFENSIVE MOVES AVAILABLE! Using all moves as last resort.`);
      }
    }
    
    for (const move of moves) {
      let strategicScore = 0;
      let includeMove = true;
      
      // CRITICAL: Deployment phase - prioritize placement over movement
      if (plan.immediateGoal === 'DEPLOY_MORE_PIECES') {
        if (move.type === 'place') {
          strategicScore += 50; // Further reduced placement bonus to encourage movement
        } else {
          // Only allow movements that contribute to pinning
          const queenAnalysis = this.analyzeQueenPinning();
          if (queenAnalysis.queens.length > 0) {
            const targetQueen = queenAnalysis.queens[0];
            const afterDistance = Math.abs(move.q - targetQueen.position.q) + Math.abs(move.r - targetQueen.position.r);
            if (afterDistance <= 1) {
              strategicScore += 100; // Allow moves that pin queen (higher than placement)
            } else {
              console.log(`🚫 REJECTING NON-ESSENTIAL MOVE: ${move.type} ${move.piece?.meta.key} - deployment priority!`);
              includeMove = false; // Reject other movements during deployment phase
            }
          } else {
            includeMove = false; // No queen visible, focus on deployment
          }
        }
      }
      
      // EMERGENCY: Protect our isolated queen!
      else if (plan.immediateGoal === 'PROTECT_OUR_QUEEN') {
        if (move.type === 'place') {
          // Check if placement is adjacent to our queen
          const isolation = this.checkOurQueenIsolation();
          if (isolation.queenPosition) {
            const queenNeighbors = this.getNeighbors(isolation.queenPosition.q, isolation.queenPosition.r);
            const isAdjacentToQueen = queenNeighbors.some(([q, r]) => q === move.q && r === move.r);
            
            if (isAdjacentToQueen) {
              strategicScore += 1000; // MASSIVE bonus for supporting our queen
              console.log(`🛡️ EMERGENCY SUPPORT: Placing ${move.piece.meta.key} next to our Queen!`);
            } else {
              strategicScore += 10; // Minimal bonus for other placements
              console.log(`🚫 NON-SUPPORTIVE PLACEMENT: ${move.piece.meta.key} not adjacent to Queen`);
            }
          }
        } else {
          // No movements during emergency - focus on protection
          console.log(`🚫 REJECTING MOVEMENT: ${move.type} ${move.piece?.meta.key} - Queen protection priority!`);
          includeMove = false;
        }
      }
      
      // NEW: Tactical movement phase - prioritize movement over placement
      else if (plan.immediateGoal === 'MOVE_AND_THREATEN') {
        if (move.type === 'move') {
          // Base movement bonus
          strategicScore += 20; // Reduced base movement bonus
          
          // MAJOR bonus for actually useful movements
          const aggressiveScore = this.scoreAggressiveMove(move);
          if (aggressiveScore > 50) {
            strategicScore += aggressiveScore; // Full aggressive bonus for good moves
          } else {
            // Penalize pointless movements
            strategicScore -= 30;
            console.log(`🚫 POINTLESS MOVEMENT: ${move.type} ${move.piece?.meta.key} - no strategic value!`);
          }
        } else if (move.type === 'place') {
          // Only allow essential placements (Queen or when under 4 pieces)
          const myPieces = this.getMyPlacedPieces().length;
          if (move.piece.meta.key === 'Q' || myPieces < 4) {
            strategicScore += 20; // Minimal placement bonus during tactical phase
          } else {
            console.log(`🚫 REJECTING NON-ESSENTIAL PLACEMENT: ${move.piece.meta.key} - movement priority!`);
            includeMove = false;
          }
        }
      }
      
      // PIN ESTABLISHMENT: Only allow moves that establish or strengthen pins
      else if (plan.immediateGoal === 'ESTABLISH_FIRST_PIN' || plan.immediateGoal === 'ADD_MORE_PINNING_PIECES') {
        const aggressiveScore = this.scoreAggressiveMove(move);
        if (aggressiveScore >= 100) {
          strategicScore += aggressiveScore;
        } else {
          console.log(`🚫 REJECTING NON-PINNING MOVE: ${move.type} ${move.piece?.meta.key} - pinning priority!`);
          includeMove = false; // Reject moves that don't contribute to pinning
        }
      }
      
      // VICTORY PHASE: Only allow winning moves
      else if (plan.immediateGoal === 'COMPLETE_SURROUND' || plan.immediateGoal === 'WIN_GAME') {
        const aggressiveScore = this.scoreAggressiveMove(move);
        // CRITICAL FIX: Don't reject Queen attack moves with massive strategicScore bonuses!
        const hasQueenAttackBonus = strategicScore >= 10000; // Queen attack moves have 10,000+ bonuses
        if (aggressiveScore >= 80 || hasQueenAttackBonus) {
          strategicScore += aggressiveScore * 2;
        } else {
          console.log(`🚫 REJECTING NON-WINNING MOVE: ${move.type} ${move.piece?.meta.key} - victory priority!`);
          includeMove = false;
        }
      }
      
      if (includeMove) {
        filteredMoves.push({ move, strategicScore, plan: plan.phase });
      }
    }
    
    // Sort by strategic score
    filteredMoves.sort((a, b) => b.strategicScore - a.strategicScore);
    
    console.log(`🎯 STRATEGIC FILTERING: ${moves.length} → ${filteredMoves.length} moves`);
    if (filteredMoves.length > 0) {
      console.log(`🎯 TOP STRATEGIC MOVE: ${filteredMoves[0].move.type} ${filteredMoves[0].move.piece?.meta.key} (score: ${filteredMoves[0].strategicScore})`);
    }
    
    return filteredMoves.map(fm => fm.move);
  },
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
      if (piece.meta.color === opponentColor && piece.meta.key === 'Q' && piece.meta.placed) {
        const queenPos = { q: piece.meta.q, r: piece.meta.r };
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
    if (move.type === 'move' && move.piece.meta.q === move.q && move.piece.meta.r === move.r) {
      console.log('🚫 WUSSY ALERT: Piece moving to same position!');
      return true;
    }
    
    // CRITICAL: Prevent early isolated queen placement!
    if (move.type === 'place' && move.piece.meta.key === 'Q') {
      const myPieces = this.getMyPlacedPieces().length;
      
      // Check timing rules first
      let correctTiming = false;
      if (this.difficulty === 'hard' && myPieces === 3) {
        correctTiming = true; // Beedric places Queen on 4th move
      } else if (this.difficulty === 'medium' && myPieces === 2) {
        correctTiming = true; // Buzzwell places Queen on 3rd move  
      } else if (this.difficulty === 'easy' && myPieces === 1) {
        correctTiming = true; // Sunny places Queen on 2nd move
      } else if (myPieces >= 3) {
        correctTiming = true; // Safety fallback
      }
      
      if (!correctTiming) {
        console.log(`🚫 WRONG TIMING: Queen placement blocked - not the right move for ${this.difficulty} difficulty`);
        return true;
      }
      
      // Now check if queen would be isolated (for difficulties that place Queen early)
      if (this.difficulty === 'easy' || this.difficulty === 'medium') {
        // Count how many of our pieces would be adjacent after placement
        const neighbors = this.getNeighbors(move.q, move.r);
        let adjacentSupport = 0;
        
        for (const [nq, nr] of neighbors) {
          const cell = window.cells.get(`${nq},${nr}`);
          if (cell && cell.stack.length > 0) {
            const topPiece = cell.stack[cell.stack.length - 1];
            if (topPiece.meta.color === this.color) {
              adjacentSupport++;
            }
          }
        }
        
        if (adjacentSupport === 0) {
          console.log(`🚫 ISOLATED QUEEN: ${this.difficulty} Queen placement needs adjacent support!`);
          return true;
        }
      }
    }
    
    // SUICIDE PREVENTION: Don't move our queen into danger
    if (move.type === 'move' && move.piece.meta.key === 'Q') {
      const dangerCount = this.countThreatsAtPosition(move.q, move.r);
      if (dangerCount >= 3) {
        console.log('🚫 SUICIDE ALERT: Queen moving into high-threat area!');
        return true;
      }
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
   * Count threats (enemy pieces) adjacent to a position
   */
  countThreatsAtPosition: function(q, r) {
    const neighbors = this.getNeighbors(q, r);
    let threatCount = 0;
    const enemyColor = this.color === 'white' ? 'black' : 'white';
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta.color === enemyColor) {
          threatCount++;
        }
      }
    }
    
    return threatCount;
  },

  /**
   * AGGRESSIVE MOVE SCORING
   * Heavily reward moves that contribute to queen pinning
   */
  scoreAggressiveMove: function(move) {
    // VIDSTIGE SIMPLE QUEEN FREEDOM EVALUATION
    // Formula: my_queen_freedom - 2*opponent_queen_freedom
    // Enhanced with SUPER AGGRESSIVE Queen targeting
    
    // MASSIVE penalty for wussy moves
    if (this.isWussyMove(move)) {
      return -1000;
    }

    // SUICIDE PREVENTION: Extra penalty for dangerous queen moves
    if (move.type === 'move' && move.piece.meta.key === 'Q') {
      const dangerCount = this.countThreatsAtPosition(move.q, move.r);
      if (dangerCount >= 2) {
        console.log(`🚫 DANGEROUS QUEEN MOVE: ${dangerCount} threats at (${move.q},${move.r})`);
        return -500; // Major penalty for risky queen moves
      }
    }

    // PRIMARY: Queen Freedom evaluation (main strategy)
    const evaluationScore = this.evaluateQueenFreedom(move);
    
    // SECONDARY: Extra aggressive Queen hunting bonuses
    let huntingBonus = 0;
    const opponentColor = this.color === 'white' ? 'black' : 'white';
    const opponentQueen = this.findQueen(opponentColor);
    
    if (opponentQueen) {
      const distanceToQueen = Math.abs(move.q - opponentQueen.q) + Math.abs(move.r - opponentQueen.r);
      
      // SUPER AGGRESSIVE: Extra bonuses for Queen hunting
      if (distanceToQueen === 1) {
        huntingBonus = 500; // MASSIVE bonus for adjacent to Queen
        console.log(`🎯 QUEEN HUNTER: Adjacent to opponent Queen!`);
      } else if (distanceToQueen === 2) {
        huntingBonus = 200; // Good bonus for near Queen
        console.log(`🎯 QUEEN HUNTER: Near opponent Queen!`);
      } else if (distanceToQueen <= 3) {
        huntingBonus = 50; // Small bonus for approaching Queen
      }
      
      // TACTICAL: Bonus for blocking Queen escape routes
      const queenNeighbors = this.getNeighbors(opponentQueen.q, opponentQueen.r);
      for (const [nq, nr] of queenNeighbors) {
        if (Math.abs(move.q - nq) + Math.abs(move.r - nr) <= 1) {
          huntingBonus += 100; // Bonus for blocking escape routes
          console.log(`🔒 ESCAPE BLOCKER: Blocking Queen escape route!`);
        }
      }
    }

    // TERTIARY: Small bonus for central positions
    const centerDistance = Math.abs(move.q) + Math.abs(move.r);
    let positionBonus = 0;
    if (centerDistance <= 2) {
      positionBonus = 10; // Small bonus for central positioning
    }

    const totalScore = evaluationScore + huntingBonus + positionBonus;
    
    console.log(`🧠 TOTAL SCORE: ${move.type} ${move.piece?.meta.key || '?'} to (${move.q},${move.r}) = ${totalScore} (eval: ${evaluationScore}, hunt: ${huntingBonus}, pos: ${positionBonus})`);
    
    return totalScore;
  },

  /**
   * VIDSTIGE QUEEN FREEDOM EVALUATION
   * Calculate: my_queen_freedom - 2*opponent_queen_freedom
   * Enhanced with makatony-style Queen threat detection
   */
  evaluateQueenFreedom: function(move) {
    // SIMPLIFIED APPROACH: Evaluate current position + predict impact
    // This avoids complex simulation and focuses on direct Queen analysis
    
    const myColor = this.color;
    const opponentColor = myColor === 'white' ? 'black' : 'white';
    
    let myQueenFreedom = 0;
    let opponentQueenFreedom = 0;
    let myQueenThreats = 0;
    let opponentQueenThreats = 0;
    
    // Find current Queens
    const myQueen = this.findQueen(myColor);
    const opponentQueen = this.findQueen(opponentColor);
    
    // If no Queens placed yet, use distance-based heuristic
    if (!myQueen && !opponentQueen) {
      // Early game: prefer central positions
      const centerDistance = Math.abs(move.q) + Math.abs(move.r);
      return (4 - centerDistance) * 25; // Small bonus for center control
    }
    
    // Evaluate current Queen positions
    if (myQueen) {
      myQueenFreedom = this.countQueenFreedom(myQueen.q, myQueen.r);
      myQueenThreats = this.countQueenThreats(myQueen.q, myQueen.r, opponentColor);
    }
    
    if (opponentQueen) {
      opponentQueenFreedom = this.countQueenFreedom(opponentQueen.q, opponentQueen.r);
      opponentQueenThreats = this.countQueenThreats(opponentQueen.q, opponentQueen.r, myColor);
    }
    
    // DIRECT QUEEN ATTACK BONUS: Huge bonus for moves adjacent to opponent Queen
    let directAttackBonus = 0;
    if (opponentQueen) {
      const distanceToOpponentQueen = Math.abs(move.q - opponentQueen.q) + Math.abs(move.r - opponentQueen.r);
      if (distanceToOpponentQueen === 1) {
        directAttackBonus = 1000; // MASSIVE bonus for adjacent to opponent Queen
        console.log(`🎯 DIRECT QUEEN ATTACK! Move adjacent to opponent Queen at (${opponentQueen.q},${opponentQueen.r})`);
      } else if (distanceToOpponentQueen === 2) {
        directAttackBonus = 300; // Good bonus for being near opponent Queen
      }
    }
    
    // Enhanced vidstige formula with threat detection
    const freedomScore = myQueenFreedom - (2 * opponentQueenFreedom);
    const threatBonus = (opponentQueenThreats * 50) - (myQueenThreats * 100);
    
    // Check for winning condition
    let winBonus = 0;
    if (opponentQueen && opponentQueenFreedom === 0 && opponentQueenThreats >= 6) {
      winBonus = 10000; // Game winning move
    }
    
    const totalScore = (freedomScore * 100) + threatBonus + winBonus + directAttackBonus;
    
    console.log(`🧠 QUEEN FREEDOM EVAL: Freedom(${freedomScore}) + Threats(${threatBonus}) + Win(${winBonus}) + Attack(${directAttackBonus}) = ${totalScore}`);
    if (myQueen) console.log(`   My Queen: pos(${myQueen.q},${myQueen.r}) freedom=${myQueenFreedom}, threats=${myQueenThreats}`);
    if (opponentQueen) console.log(`   Opp Queen: pos(${opponentQueen.q},${opponentQueen.r}) freedom=${opponentQueenFreedom}, threats=${opponentQueenThreats}`);
    
    return totalScore;
  },  /**
   * Count how many enemy pieces this move would threaten
   */
  countThreatenedPieces: function(move) {
    const neighbors = this.getNeighbors(move.q, move.r);
    let threatenedCount = 0;
    const enemyColor = this.color === 'white' ? 'black' : 'white';
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta.color === enemyColor) {
          threatenedCount++;
        }
      }
    }
    
    return threatenedCount;
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
      score += 5; // Small placement bonus in simulation
      if (initialMove.piece.meta.key === 'Q') score += 15; // Queen placement
    } else {
      score += 20; // Higher movement bonus to encourage tactics
      if (this.threatensPieces(initialMove)) score += 35; // Reward threatening moves
    }
    
    // TERTIARY: Add some randomness (much reduced)
    score += Math.random() * 5 - 2.5;
    
    return score;
  },

  // PLACEHOLDER METHODS - Will use simplified implementations
  captureGameState: function() {
    return {
      pieces: tray.filter(p => p.meta.placed),
      turn: state.current,
      moveCount: tray.filter(p => p.meta.placed).length
    };
  },
  
  /**
   * Get current game state for analysis
   */
  getCurrentGameState: function() {
    // Extract only the essential data from tray (avoid circular PIXI references)
    const pieces = window.tray || tray;
    const cleanTray = typeof pieces !== 'undefined' ? pieces.map(piece => ({
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

    const gameState = {
      currentPlayer: window.state ? window.state.current : 'white',
      moveNumber: window.state ? (window.state.moveNumber || 0) : 0,
      tray: cleanTray,
      gameOver: window.state ? (window.state.gameOver || false) : false,
      isSimulation: false,
      pieces: cleanTray.filter(p => p.meta.placed),
      turn: window.state ? window.state.current : 'white',
      moveCount: cleanTray.filter(p => p.meta.placed).length
    };
    
    return gameState;
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
    // Get all possible moves
    const allMoves = this.getAllPossibleMoves();
    
    console.log(`🧠 Analyzing ${allMoves.length} moves with STRATEGIC INTELLIGENCE...`);
    
    // PRIORITY 1: Check for immediate winning moves first!
    const winningMoves = this.findImmediateWinningMoves(allMoves);
    if (winningMoves.length > 0) {
      console.log(`🏆 IMMEDIATE WIN DETECTED! Found ${winningMoves.length} winning moves`);
      return winningMoves;
    }
    
    // PRIORITY 1.5: Check for "almost winning" moves (5/6 Queen surrounded)
    const almostWinningMoves = this.findAlmostWinningMoves(allMoves);
    if (almostWinningMoves.length > 0) {
      console.log(`🎯 ALMOST WINNING! Found ${almostWinningMoves.length} moves that put opponent Queen at 5/6 - PRIORITY!`);
      return almostWinningMoves;
    }
    
    // PRIORITY 1.7: FORCE QUEEN ATTACKS - Find moves adjacent to opponent Queen
    const queenAttackMoves = this.findDirectQueenAttacks(allMoves);
    if (queenAttackMoves.length > 0) {
      console.log(`👑 QUEEN ATTACK! Found ${queenAttackMoves.length} moves adjacent to opponent Queen - ATTACKING NOW!`);
      return queenAttackMoves;
    }
    
    // PRIORITY 2: Check for moves that prevent opponent wins
    const defensiveMoves = this.findDefensiveMoves(allMoves);
    if (defensiveMoves.length > 0) {
      console.log(`🛡️ DEFENSIVE MOVES: Found ${defensiveMoves.length} moves to prevent loss`);
      // Use defensive moves as the base set, but continue with strategic analysis
    }
    
    // FIRST: Apply strategic filtering based on game plan
    const strategicMoves = this.filterMovesByStrategy(allMoves, gameState);
    
    if (strategicMoves.length === 0) {
      console.log(`⚠️ No strategic moves found, falling back to basic evaluation`);
      return allMoves; // Fallback to all moves if strategic filtering too restrictive
    }
    
    // SECOND: Score the strategically viable moves
    const scoredMoves = strategicMoves.map(move => {
      let score = 0;
      
      // PRIMARY: Aggressive queen pinning (highest priority)
      const aggressiveScore = this.scoreAggressiveMove(move);
      score += aggressiveScore * 3; // Triple weight for strategic moves
      
      // SECONDARY: Deployment bonus (encourage placing pieces)
      if (move.type === 'place') {
        // Enhanced placement scoring
        let placementScore = 15; // Base placement bonus
        
        // SPECIAL QUEEN PLACEMENT LOGIC
        if (move.piece.meta.key === 'Q') {
          console.log(`👑 QUEEN PLACEMENT: Evaluating position (${move.q},${move.r})`);
          placementScore = 200; // High base value for Queen
          
          // Queen should be placed near our own pieces for protection
          const myPieces = (window.tray || tray || []).filter(p => p.meta.color === this.color && p.meta.placed);
          let protectionCount = 0;
          for (const piece of myPieces) {
            const dist = Math.abs(move.q - piece.meta.q) + Math.abs(move.r - piece.meta.r);
            if (dist === 1) protectionCount++;
          }
          
          // BUT NOT TOO MUCH PROTECTION - Queen needs escape routes!
          // OPTIMAL: Queen should have EXACTLY 1 neighbor for maximum safety + mobility
          if (protectionCount === 1) {
            placementScore += 300; // HUGE bonus for optimal protection (1 neighbor)
          } else if (protectionCount === 0) {
            placementScore -= 200; // Penalty for isolation (but not as bad as over-protection)
          } else if (protectionCount === 2) {
            placementScore -= 400; // MAJOR penalty for 2 neighbors (getting dangerous)
          } else if (protectionCount >= 3) {
            placementScore -= 1500; // CATASTROPHIC penalty for 3+ neighbors
          }
          
          // Queen should be somewhat central but not exposed
          const centerOfMass = this.calculateBoardCenter();
          const distFromCenter = Math.abs(move.q - centerOfMass.q) + Math.abs(move.r - centerOfMass.r);
          if (distFromCenter <= 1) {
            placementScore += 50; // Bonus for central position
          } else if (distFromCenter > 3) {
            placementScore -= 100; // Penalty for being too far out
          }
          
        } else {
          // FOR ALL OTHER PIECES: EXTREME ANTI-QUEEN-PINNING LOGIC
          const myQueen = (window.tray || tray || []).find(p => p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed);
          if (myQueen) {
            const distToQueen = Math.abs(move.q - myQueen.meta.q) + Math.abs(move.r - myQueen.meta.r);
            if (distToQueen === 1) {
              // Count current Queen neighbors
              const myPieces = (window.tray || tray || []).filter(p => p.meta.color === this.color && p.meta.placed);
              let currentQueenNeighbors = 0;
              for (const piece of myPieces) {
                const dist = Math.abs(piece.meta.q - myQueen.meta.q) + Math.abs(piece.meta.r - myQueen.meta.r);
                if (dist === 1) currentQueenNeighbors++;
              }
              
              const newQueenNeighbors = currentQueenNeighbors + 1; // After this placement
              
              // ESCALATING EXTREME PENALTIES - Queen should have ONLY 1 neighbor max!
              if (newQueenNeighbors >= 4) {
                placementScore -= 2000; // GAME-LOSING penalty
                console.log(`🚫 CATASTROPHIC: Would give Queen ${newQueenNeighbors} neighbors - GAME SUICIDE (-2000)`);
              } else if (newQueenNeighbors === 3) {
                placementScore -= 1000; // MASSIVE penalty - very dangerous
                console.log(`🚫 EXTREME DANGER: Would give Queen ${newQueenNeighbors} neighbors - NEAR SUICIDE (-1000)`);
              } else if (newQueenNeighbors === 2) {
                placementScore -= 500; // HUGE penalty - already risky
                console.log(`🚫 HIGH RISK: Would give Queen ${newQueenNeighbors} neighbors - DANGEROUS (-500)`);
              }
              
              // ADDITIONAL ESCALATING PENALTY: Each neighbor beyond 1 multiplies the danger
              if (currentQueenNeighbors >= 1) {
                const escalatingPenalty = currentQueenNeighbors * currentQueenNeighbors * 300; // Exponential scaling
                placementScore -= escalatingPenalty;
                console.log(`🚫 ESCALATING DANGER: Queen already has ${currentQueenNeighbors} neighbors, adding ${escalatingPenalty} penalty`);
              }
            }
          }
          
          score += placementScore;
          return { move, score, aggressiveScore, placementScore }; // Early return for Queen
        }
        
        // CRITICAL: SUICIDE PREVENTION FOR ALL PIECE PLACEMENTS
        // Check if this placement would enable immediate Queen surround
        const myQueen = (window.tray || tray || []).find(p => p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed);
        if (myQueen) {
          // Simulate board state after this placement
          const allPieces = window.tray || tray || [];
          const simulatedOccupied = new Set();
          for (const piece of allPieces) {
            if (piece.meta.placed) {
              simulatedOccupied.add(`${piece.meta.q},${piece.meta.r}`);
            }
          }
          // Add this new placement
          simulatedOccupied.add(`${move.q},${move.r}`);
          
          // Check if Queen would be surrounded after this placement
          const queenNeighbors = [
            [myQueen.meta.q + 1, myQueen.meta.r], [myQueen.meta.q - 1, myQueen.meta.r],
            [myQueen.meta.q, myQueen.meta.r + 1], [myQueen.meta.q, myQueen.meta.r - 1],
            [myQueen.meta.q + 1, myQueen.meta.r - 1], [myQueen.meta.q - 1, myQueen.meta.r + 1]
          ];
          
          let queenOccupiedNeighbors = 0;
          for (const [nq, nr] of queenNeighbors) {
            if (simulatedOccupied.has(`${nq},${nr}`)) {
              queenOccupiedNeighbors++;
            }
          }
          
          // ABSOLUTE SUICIDE PREVENTION
          if (queenOccupiedNeighbors >= 6) {
            placementScore -= 10000; // GAME-ENDING penalty - this move loses the game!
            console.log(`🚫 SUICIDE PREVENTION: Placement would SURROUND our Queen (${queenOccupiedNeighbors}/6) - FORBIDDEN (-10000)`);
          } else if (queenOccupiedNeighbors >= 5) {
            placementScore -= 5000; // EXTREME danger - one move from loss
            console.log(`🚫 EXTREME SUICIDE RISK: Placement would give Queen ${queenOccupiedNeighbors}/6 neighbors (-5000)`);
          }
        }
        
        // STRATEGIC PIECE VARIETY AND ANTI-SPAM LOGIC
        const myPlacedPieces = (window.tray || tray || []).filter(p => p.meta.color === this.color && p.meta.placed);
        const pieceTypeCounts = {};
        for (const piece of myPlacedPieces) {
          pieceTypeCounts[piece.meta.key] = (pieceTypeCounts[piece.meta.key] || 0) + 1;
        }
        
        // ANTI-ANT SPAM: Heavily penalize placing 3rd Ant early
        if (move.piece.meta.key === 'A') {
          const antCount = pieceTypeCounts['A'] || 0;
          if (antCount >= 2) {
            placementScore -= 300; // HUGE penalty for 3rd Ant
            console.log(`🚫 ANT SPAM: Already have ${antCount} Ants, penalizing 3rd (-300)`);
          } else if (antCount === 1 && myPlacedPieces.length < 6) {
            placementScore -= 100; // Penalty for 2nd Ant too early
            console.log(`⚠️ EARLY ANT: 2nd Ant before turn 6 (-100)`);
          }
        }
        
        // STRATEGIC PIECE PRIORITIES (encourage variety)
        if (myPlacedPieces.length <= 8) { // Early game
          if (move.piece.meta.key === 'G' && (pieceTypeCounts['G'] || 0) === 0) {
            placementScore += 100; // Bonus for first Grasshopper
          } else if (move.piece.meta.key === 'S' && (pieceTypeCounts['S'] || 0) === 0) {
            placementScore += 80; // Bonus for first Spider
          } else if (move.piece.meta.key === 'B' && (pieceTypeCounts['B'] || 0) === 0) {
            placementScore += 60; // Bonus for first Beetle
          }
        }
        
        // STRATEGIC PLACEMENT BONUSES:
        
        // 1. Bonus for placing near opponent queen (if found)
        const oppColor = this.color === 'white' ? 'black' : 'white';
        const pieces = window.tray || tray || [];
        const oppQueen = pieces.find(p => p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed);
        
        if (oppQueen) {
          const distToOppQueen = Math.abs(move.q - oppQueen.q) + Math.abs(move.r - oppQueen.r);
          
          // CRITICAL: Check if this placement would complete Queen surround!
          if (distToOppQueen === 1) {
            // Count occupied neighbors around opponent Queen
            const queenNeighbors = [
              [oppQueen.q + 1, oppQueen.r], [oppQueen.q - 1, oppQueen.r],
              [oppQueen.q, oppQueen.r + 1], [oppQueen.q, oppQueen.r - 1],
              [oppQueen.q + 1, oppQueen.r - 1], [oppQueen.q - 1, oppQueen.r + 1]
            ];
            
            let currentOccupied = 0;
            for (const [nq, nr] of queenNeighbors) {
              const cell = window.cells?.get(`${nq},${nr}`);
              if (cell && cell.stack.length > 0) currentOccupied++;
            }
            
            const potentialOccupied = currentOccupied + 1; // After this placement
            
            if (potentialOccupied >= 6) {
              placementScore += 50000; // MASSIVE WINNING BONUS - ABSOLUTE PRIORITY!
              console.log(`🏆 WINNING PLACEMENT FOUND: ${move.piece.meta.key} at (${move.q},${move.r}) - GAME OVER! (+50000)`);
            } else if (potentialOccupied >= 5) {
              placementScore += 10000; // HUGE almost-winning bonus!
              console.log(`🎯 CRITICAL PLACEMENT: ${move.piece.meta.key} at (${move.q},${move.r}) - 5/6 surround! (+10000)`);
            } else if (potentialOccupied >= 4) {
              placementScore += 1500; // Excellent pressure
            }
          }
          
          if (distToOppQueen <= 2) {
            // BONUS: Single Ant near opponent Queen is VERY strategic
            if (move.piece.meta.key === 'A' && (pieceTypeCounts['A'] || 0) === 0) {
              placementScore += 250; // HUGE bonus for strategic first Ant
            } else {
              placementScore += 150; // HUGE bonus for placing near opponent queen
            }
          } else if (distToOppQueen <= 3) {
            placementScore += 80; // Good bonus for being close
          }
        }
        
        // 2. Bonus for placing near our own pieces (coordination)
        const myPieces = (window.tray || tray || []).filter(p => p.meta.color === this.color && p.meta.placed);
        let nearOwnPieces = 0;
        for (const piece of myPieces) {
          const dist = Math.abs(move.q - piece.meta.q) + Math.abs(move.r - piece.meta.r);
          if (dist === 1) nearOwnPieces++;
        }
        placementScore += nearOwnPieces * 25; // Bonus for coordination
        
        // 3. Penalty for placing too far from action
        const centerOfMass = this.calculateBoardCenter();
        const distFromCenter = Math.abs(move.q - centerOfMass.q) + Math.abs(move.r - centerOfMass.r);
        if (distFromCenter > 3) {
          placementScore -= 50; // Penalty for being too far out
        }
        
        score += placementScore;
      } else if (move.type === 'move') {
        // MOVEMENT SCORING LOGIC - Focus on Queen safety and opponent pressure
        let movementScore = 10; // Base movement bonus
        
        // CRITICAL: Queen escape logic - Queen must maintain exactly 1 neighbor max!
        if (move.piece.meta.key === 'Q') {
          
          // FIRST: Check current threat level
          const currentThreatAnalysis = this.analyzeOurQueenSafety();
          console.log(`👑 Current threat level: ${currentThreatAnalysis.level} - ${currentThreatAnalysis.reason}`);
          
          // EMERGENCY ESCAPE MULTIPLIERS
          if (currentThreatAnalysis.level === 'extreme') {
            movementScore += 2000; // MASSIVE emergency bonus for any Queen movement
          } else if (currentThreatAnalysis.level === 'critical') {
            movementScore += 1500; // Large escape bonus
          } else if (currentThreatAnalysis.level === 'warning') {
            movementScore += 800; // Significant escape bonus
          }
          
          // Count neighbors at current position
          const myPieces = (window.tray || tray || []).filter(p => p.meta.color === this.color && p.meta.placed && p.meta.key !== 'Q');
          let currentNeighbors = 0;
          for (const piece of myPieces) {
            const dist = Math.abs(piece.meta.q - move.piece.meta.q) + Math.abs(piece.meta.r - move.piece.meta.r);
            if (dist === 1) currentNeighbors++;
          }
          
          // Count neighbors at destination position
          let destinationNeighbors = 0;
          for (const piece of myPieces) {
            const dist = Math.abs(piece.meta.q - move.q) + Math.abs(piece.meta.r - move.r);
            if (dist === 1) destinationNeighbors++;
          }
          
          console.log(`👑 Queen neighbors: Current=${currentNeighbors}, Destination=${destinationNeighbors}`);
          
          // CRITICAL SUICIDE PREVENTION: Check if Queen would be vulnerable to immediate surround
          const allPieces = window.tray || tray || [];
          const allOccupiedPositions = new Set();
          for (const piece of allPieces) {
            if (piece.meta.placed && !(piece.meta.color === this.color && piece.meta.key === 'Q')) {
              allOccupiedPositions.add(`${piece.meta.q},${piece.meta.r}`);
            }
          }
          
          // Check all 6 hex neighbors of the destination
          const hexNeighbors = [
            [move.q + 1, move.r], [move.q - 1, move.r],
            [move.q, move.r + 1], [move.q, move.r - 1],
            [move.q + 1, move.r - 1], [move.q - 1, move.r + 1]
          ];
          
          let occupied = 0;
          let emptyAdjacentToOccupied = 0;
          
          for (const [nq, nr] of hexNeighbors) {
            const key = `${nq},${nr}`;
            if (allOccupiedPositions.has(key)) {
              occupied++;
            } else {
              // Check if this empty space is adjacent to opponent pieces (could be filled)
              const neighborNeighbors = [
                [nq + 1, nr], [nq - 1, nr],
                [nq, nr + 1], [nq, nr - 1],
                [nq + 1, nr - 1], [nq - 1, nr + 1]
              ];
              
              for (const [nnq, nnr] of neighborNeighbors) {
                const nnkey = `${nnq},${nnr}`;
                if (allOccupiedPositions.has(nnkey)) {
                  emptyAdjacentToOccupied++;
                  break; // Only count once per empty space
                }
              }
            }
          }
          
          // SUICIDE PREVENTION: If Queen would have 5+ neighbors occupied/vulnerable, FORBIDDEN!
          if (occupied >= 5) {
            movementScore -= 5000; // CATASTROPHIC penalty - this is suicide!
            console.log(`🚫 SUICIDE PREVENTION: Queen move to (${move.q},${move.r}) has ${occupied}/6 neighbors occupied - FORBIDDEN (-5000)`);
          } else if (occupied >= 4 && emptyAdjacentToOccupied >= 1) {
            movementScore -= 3000; // EXTREME danger - very likely suicide
            console.log(`🚫 EXTREME SUICIDE RISK: Queen move has ${occupied} occupied + ${emptyAdjacentToOccupied} vulnerable neighbors (-3000)`);
          } else if (occupied >= 3 && emptyAdjacentToOccupied >= 2) {
            movementScore -= 1500; // HIGH danger - potential suicide setup
            console.log(`🚫 HIGH SUICIDE RISK: Queen move has ${occupied} occupied + ${emptyAdjacentToOccupied} vulnerable neighbors (-1500)`);
          }
          
          // MASSIVE bonuses for reducing Queen neighbors (escaping danger)
          if (currentNeighbors >= 3 && destinationNeighbors <= 1) {
            movementScore += 1000; // HUGE bonus for escaping death trap
            
          } else if (currentNeighbors >= 2 && destinationNeighbors <= 1) {
            movementScore += 500; // Major bonus for reducing risk
            console.log(`👑 SAFETY: Queen reducing from ${currentNeighbors} to ${destinationNeighbors} neighbors (+500)`);
          } else if (destinationNeighbors === 1) {
            movementScore += 200; // Bonus for optimal positioning
            console.log(`👑 OPTIMAL: Queen moving to ideal 1-neighbor position (+200)`);
          } else if (destinationNeighbors === 0) {
            movementScore += 100; // Acceptable isolation
            console.log(`👑 ISOLATION: Queen moving to isolated position (+100)`);
          } else if (destinationNeighbors >= 2) {
            movementScore -= 800; // HUGE penalty for moving to dangerous position
          }
          
          // Additional bonus if Queen is currently in immediate danger
          if (currentNeighbors >= 3) {
            movementScore += 300; // Extra urgency bonus
          }
        }
        
        // Movement scoring for other pieces - focus on attacking opponent Queen
        else {
          const oppColor = this.color === 'white' ? 'black' : 'white';
          const pieces = window.tray || tray || [];
          const oppQueen = pieces.find(p => p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed);
          
          if (oppQueen) {
            const distToOppQueen = Math.abs(move.q - oppQueen.q) + Math.abs(move.r - oppQueen.r);
            if (distToOppQueen <= 1) {
              movementScore += 1200; // MASSIVE bonus for moving adjacent to opponent Queen (higher than placement!)
            } else if (distToOppQueen <= 2) {
              movementScore += 800; // HUGE bonus for pressure (higher than most placements!)
            } else if (distToOppQueen <= 3) {
              movementScore += 300; // Good bonus for getting into attack range
            }
            
            // SPECIAL BONUS: If this move would complete or nearly complete a surround
            const queenNeighbors = [
              [oppQueen.q + 1, oppQueen.r], [oppQueen.q - 1, oppQueen.r],
              [oppQueen.q, oppQueen.r + 1], [oppQueen.q, oppQueen.r - 1],
              [oppQueen.q + 1, oppQueen.r - 1], [oppQueen.q - 1, oppQueen.r + 1]
            ];
            
            let currentOccupied = 0;
            for (const [nq, nr] of queenNeighbors) {
              const cell = window.cells?.get(`${nq},${nr}`);
              if (cell && cell.stack.length > 0) currentOccupied++;
            }
            
            // If this move would be adjacent to opponent Queen, check surround potential
            if (distToOppQueen <= 1) {
              const potentialOccupied = currentOccupied + 1; // After this move
              if (potentialOccupied >= 6) {
                movementScore += 50000; // MASSIVE WINNING BONUS - ABSOLUTE PRIORITY!
                console.log(`🏆 WINNING MOVE FOUND: GAME OVER! (+50000)`);
              } else if (potentialOccupied >= 5) {
                movementScore += 10000; // HUGE almost-winning bonus!
                console.log(`🎯 CRITICAL MOVE: 5/6 surround! (+10000)`);
              } else if (potentialOccupied >= 4) {
                movementScore += 2000; // Excellent pressure
              }
            }
          }
          
          // CRITICAL: COORDINATED ATTACK STRATEGY - Block Queen escape routes!
          if (oppQueen) {
            const distToOppQueen = Math.abs(move.q - oppQueen.q) + Math.abs(move.r - oppQueen.r);
            // Analyze Queen's escape routes (needed for multiple conditions)
            const queenEscapeRoutes = this.analyzeQueenEscapeRoutes(oppQueen);
            
            if (distToOppQueen <= 3) {
              
              
              // MASSIVE bonus for blocking escape routes
              for (const escapePos of queenEscapeRoutes.escapeSpaces) {
                if (move.q === escapePos.q && move.r === escapePos.r) {
                  movementScore += 1500; // HUGE bonus for blocking escape
                }
              }
            }
            
            // COORDINATION bonus: Prefer moves that work with existing pieces
            if (distToOppQueen <= 2) {
              let coordinationBonus = 0;
              
              // Count how many of our pieces are already pressuring the Queen
              let pressurePieces = 0;
              const myAttackPieces = (window.tray || tray || []).filter(p => 
                p.meta.color === this.color && p.meta.placed && p.meta.key !== 'Q'
              );
              
              for (const piece of myAttackPieces) {
                const distToQueen = Math.abs(piece.q - oppQueen.q) + Math.abs(piece.r - oppQueen.r);
                if (distToQueen <= 2) pressurePieces++;
              }
              
              if (pressurePieces >= 2) {
                coordinationBonus = 600; // Bonus for joining coordinated attack
                console.log(`⚔️ COORDINATED ATTACK: Joining ${pressurePieces} pieces already pressuring Queen (+600)`);
              } else if (pressurePieces >= 1) {
                coordinationBonus = 300; // Bonus for supporting existing pressure
                console.log(`⚔️ SUPPORT ATTACK: Supporting ${pressurePieces} piece already pressuring Queen (+300)`);
              }
              
              movementScore += coordinationBonus;
            }
            
            // STRATEGIC POSITIONING: Prefer moves that cut off multiple escape routes
            if (distToOppQueen === 2) {
              let escapeRoutesCut = 0;
              
              // Check how many escape routes this position controls
              for (const escapePos of queenEscapeRoutes.escapeSpaces) {
                const distToEscape = Math.abs(move.q - escapePos.q) + Math.abs(move.r - escapePos.r);
                if (distToEscape <= 1) escapeRoutesCut++;
              }
              
              if (escapeRoutesCut >= 2) {
                movementScore += 800; // Excellent strategic position
              } else if (escapeRoutesCut >= 1) {
                movementScore += 400; // Good strategic position
                
              }
            }
          }
          
          // Bonus for any aggressive movement (vs sitting still)
          movementScore += 100; // Base aggression bonus - encourage using pieces!
          console.log(`⚔️ AGGRESSION: Bonus for moving piece instead of placing (+100)`);
        }
        
        score += movementScore;
      }
      
      // TERTIARY: Basic positional scoring (much lower priority)
      const distance = Math.abs(move.q) + Math.abs(move.r);
      score += (10 - distance) * 0.2; // Minimal weight
      
      return { move, score, aggressiveScore };
    });
    
    // Sort by score with strategic moves at top
    scoredMoves.sort((a, b) => b.score - a.score);
    
    // Log top strategic moves for debugging
    console.log('🧠 Top 5 STRATEGIC moves:');
    for (let i = 0; i < Math.min(5, scoredMoves.length); i++) {
      const item = scoredMoves[i];
      console.log(`  ${i+1}. ${item.move.type} ${item.move.piece?.meta.key || '?'} to (${item.move.q},${item.move.r}) - Score: ${item.score.toFixed(1)} (Aggressive: ${item.aggressiveScore})`);
    }
    
    return scoredMoves.map(item => item.move);
  },
  
  /**
   * Main AI Move Generation Function
   * Integrated with UI flow through window.AIEngine.checkAndMakeMove hook
   */
  makeMove: function() {
    console.log('🤖 AI Engine V2 makeMove called');
    
    // Check if it's our turn and we're enabled
    if (!this.enabled || !window.state || window.state.current !== this.color || this.thinking || window.animating) {
      console.log('🤖 V2 not ready:', { enabled: this.enabled, turn: window.state?.current, thinking: this.thinking, animating: window.animating });
      return;
    }
    
    // CRITICAL: Check if game is already over (our Queen is surrounded)
    const gameOverCheck = this.analyzeOurQueenSafety();
    if (gameOverCheck.level === 'extreme' && gameOverCheck.occupied >= 6) {
      console.log('💀 GAME OVER: Our Queen is completely surrounded - AI should not move!');
      console.log(`💀 Queen surrounded: ${gameOverCheck.occupied}/6 positions occupied`);
      this.thinking = false;
      return; // Do not make any move - game is over!
    }
    
    // Set thinking state
    this.thinking = true;
    this.updateThinkingUI('analyzing', 10);
    
    // Brief delay to show thinking UI
    setTimeout(() => {
      this.executeV2Move();
    }, 100);
  },
  
  /**
   * Execute the actual V2 move logic
   */
  executeV2Move: function() {
    try {
      console.log('🧠 V2 Engine analyzing position...');
      
      // Get current game state
      const gameState = this.getCurrentGameState();
      this.updateThinkingUI('strategic', 30);
      
      // Get strategic moves using V2 intelligence
      const strategicMoves = this.analyzeStrategicPatterns(gameState);
      this.updateThinkingUI('evaluating', 60);
      
      if (strategicMoves.length === 0) {
        console.log('🤖 No moves available');
        this.thinking = false;
        return;
      }
      
      // Select best move (first in strategic list)
      const bestMove = strategicMoves[0];
      this.updateThinkingUI('finalizing', 90);
      
      console.log(`🎯 V2 Engine selected: ${bestMove.type} ${bestMove.piece?.meta.key || '?'} to (${bestMove.q},${bestMove.r})`);
      
      // Apply the move
      this.applyMove(bestMove);
      this.updateThinkingUI('complete', 100);
      
      // Clear thinking state
      setTimeout(() => {
        this.thinking = false;
      }, 500);
      
    } catch (error) {
      console.error('🚨 V2 Engine error:', error);
      this.thinking = false;
    }
  },
  
  /**
   * Apply the selected move to the game
   */
  applyMove: function(move) {
    try {
      console.log(`🎯 V2 Applying move: ${move.type} ${move.piece?.meta?.key || '?'} to (${move.q},${move.r})`);
      
      if (move.type === 'place') {
        // Place a piece
        if (move.piece && typeof selectPlacement === 'function' && typeof commitPlacement === 'function') {
          console.log(`🎯 V2 Placing ${move.piece.meta.key} at (${move.q},${move.r})`);
          selectPlacement(move.piece);
          commitPlacement(move.q, move.r);
        } else {
          console.error('🚨 V2 Invalid placement move or missing functions:', { move, selectPlacement: typeof selectPlacement, commitPlacement: typeof commitPlacement });
        }
      } else if (move.type === 'move') {
        // Move an existing piece
        if (move.piece && typeof selectMove === 'function' && typeof commitMove === 'function') {
          // Verify piece has valid position (coordinates stored in meta)
          if (move.piece.meta.q !== undefined && move.piece.meta.r !== undefined) {
            console.log(`🎯 V2 Moving ${move.piece.meta.key} from (${move.piece.meta.q},${move.piece.meta.r}) to (${move.q},${move.r})`);
            
            // First select the piece to move
            selectMove(move.piece);
            
            // Small delay to ensure selection is processed
            setTimeout(() => {
              commitMove(move.q, move.r);
            }, 50);
          } else {
            console.error('🚨 V2 Piece has invalid position data:', { piece: move.piece.meta.key, q: move.piece.meta.q, r: move.piece.meta.r });
          }
        } else {
          console.error('🚨 V2 Invalid movement move or missing functions:', { move, selectMove: typeof selectMove, commitMove: typeof commitMove });
        }
      } else {
        console.error('🚨 V2 Unknown move type:', move.type);
      }
    } catch (error) {
      console.error('🚨 V2 Error applying move:', error);
      console.error('🚨 Move details:', move);
    }
  },
  
  /**
   * Calculate the center of mass of the board
   */
  calculateBoardCenter: function() {
    const pieces = window.tray || tray || [];
    const placedPieces = pieces.filter(p => p.meta.placed);
    
    if (placedPieces.length === 0) return { q: 0, r: 0 };
    
    let totalQ = 0, totalR = 0;
    for (const piece of placedPieces) {
      totalQ += piece.meta.q;
      totalR += piece.meta.r;
    }
    
    return {
      q: Math.round(totalQ / placedPieces.length),
      r: Math.round(totalR / placedPieces.length)
    };
  },

  /**
   * Get my placed pieces
   */
  getMyPlacedPieces: function() {
    const pieces = window.tray || tray || [];
    return pieces.filter(p => p.meta.color === this.color && p.meta.placed);
  },
  
  /**
   * Get opponent's placed pieces
   */
  getOpponentPlacedPieces: function() {
    const oppColor = this.color === 'white' ? 'black' : 'white';
    const pieces = window.tray || tray || [];
    return pieces.filter(p => p.meta.color === oppColor && p.meta.placed);
  },

  /**
   * Get all possible moves (uses existing game.js functions)
   */
  getAllPossibleMoves: function() {
    const moves = [];
    
    // Get placement moves
    if (typeof legalPlacementZones === 'function') {
      const placementZones = legalPlacementZones(this.color);
      
      if (placementZones && (window.tray || tray)) {
        const pieces = window.tray || tray;
        const unplacedPieces = pieces.filter(p => p.meta.color === this.color && !p.meta.placed);
        const myPlacedCount = pieces.filter(p => p.meta.color === this.color && p.meta.placed).length;
        
        for (const piece of unplacedPieces) {
          for (const key of placementZones) {
            const [q, r] = key.split(',').map(Number);
            
            // BEEDRIC QUEEN TIMING: Only place Queen on exactly 4th move (hard difficulty)
            if (piece.meta.key === 'Q') {
              if (this.difficulty === 'hard' && myPlacedCount === 3) {
                // Beedric MUST place Queen on 4th move
                moves.push({ type: 'place', piece, q, r });
                console.log(`👑 BEEDRIC: Forced Queen placement on 4th move`);
              } else if (this.difficulty === 'medium' && myPlacedCount === 2) {
                // Buzzwell places Queen on 3rd move
                moves.push({ type: 'place', piece, q, r });
                console.log(`👑 BUZZWELL: Forced Queen placement on 3rd move`);
              } else if (this.difficulty === 'easy' && myPlacedCount === 1) {
                // Sunny places Queen on 2nd move
                moves.push({ type: 'place', piece, q, r });
                console.log(`👑 SUNNY: Forced Queen placement on 2nd move`);
              } else if (myPlacedCount >= 3) {
                // Safety fallback - must place Queen by 4th move regardless
                moves.push({ type: 'place', piece, q, r });
                console.log(`👑 SAFETY: Queen placement required (${myPlacedCount+1} moves)`);
              }
              // Otherwise, don't allow Queen placement yet
            } else {
              // Other pieces - normal placement rules
              const queenPlaced = pieces.some(p => p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed);
              
              // Block non-Queen pieces if it's time to place Queen
              let blockPlacement = false;
              
              if (this.difficulty === 'hard' && myPlacedCount === 3 && !queenPlaced) {
                blockPlacement = true; // Beedric must place Queen on 4th move
                console.log(`🚫 BEEDRIC: Blocking ${piece.meta.key} - must place Queen on 4th move`);
              } else if (this.difficulty === 'medium' && myPlacedCount === 2 && !queenPlaced) {
                blockPlacement = true; // Buzzwell must place Queen on 3rd move
                console.log(`🚫 BUZZWELL: Blocking ${piece.meta.key} - must place Queen on 3rd move`);
              } else if (this.difficulty === 'easy' && myPlacedCount === 1 && !queenPlaced) {
                blockPlacement = true; // Sunny must place Queen on 2nd move
                console.log(`🚫 SUNNY: Blocking ${piece.meta.key} - must place Queen on 2nd move`);
              }
              
              if (!blockPlacement && (queenPlaced || myPlacedCount < 3)) {
                moves.push({ type: 'place', piece, q, r });
              }
            }
          }
        }
      }
    }
    
    // Get movement moves - but only after we have multiple pieces AND our queen is placed
    if (typeof legalMoveZones === 'function' && (window.tray || tray)) {
      const pieces = window.tray || tray;
      const placedPieces = pieces.filter(p => p.meta.color === this.color && p.meta.placed);
      const myPlacedCount = placedPieces.length;
      const queenPlaced = pieces.some(p => p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed);
      
      // Don't allow movement until we have at least 2 pieces placed AND our queen is placed (Hive rules)
      if (myPlacedCount >= 2 && queenPlaced) {
        console.log(`🔄 V2 Checking movements for ${placedPieces.length} placed pieces (Queen placed: ${queenPlaced})...`);
        
        for (const piece of placedPieces) {
          // Verify piece has valid position data (coordinates stored in meta)
          if (piece.meta.q !== undefined && piece.meta.r !== undefined) {
            const moveZones = legalMoveZones(piece);
            if (moveZones && moveZones.length > 0) {
              for (const key of moveZones) {
                const [q, r] = key.split(',').map(Number);
                moves.push({ type: 'move', piece, q, r });
                console.log(`✅ ${this.difficulty.toUpperCase()}: Added ${piece.meta.key} movement from (${piece.meta.q},${piece.meta.r}) to (${q},${r})`);
              }
            } else {
              console.log(`🚫 ${this.difficulty.toUpperCase()}: No legal moves for ${piece.meta.key} at (${piece.meta.q},${piece.meta.r})`);
            }
          } else {
            console.error(`🚨 ${this.difficulty.toUpperCase()}: Piece ${piece.meta.key} has invalid position: (${piece.meta.q},${piece.meta.r})`);
          }
        }
      } else {
        console.log(`🚫 ${this.difficulty.toUpperCase()}: Blocking movements - only ${myPlacedCount} pieces placed and Queen placed: ${queenPlaced} (need 2+ pieces AND Queen placed)`);
      }
    }
    
    console.log(`🧠 V2 Total moves generated: ${moves.length} (${moves.filter(m => m.type === 'place').length} placements, ${moves.filter(m => m.type === 'move').length} movements)`);
    return moves;
  },
  
  /**
   * Find moves that immediately win the game (surround opponent queen)
   */
  findImmediateWinningMoves: function(moves) {
    const winningMoves = [];
    
    for (const move of moves) {
      // Simulate applying this move and check if it wins
      if (this.simulateWinningMove(move)) {
        winningMoves.push(move);
        console.log(`🏆 WINNING MOVE: ${move.type} ${move.piece?.meta.key} to (${move.q},${move.r})`);
      }
    }
    
    return winningMoves;
  },
  
  /**
   * Find moves that put opponent Queen at 5/6 neighbors (almost surrounded)
   */
  findAlmostWinningMoves: function(moves) {
    const almostWinningMoves = [];
    
    for (const move of moves) {
      if (this.wouldMoveAlmostSurroundQueen(move)) {
        almostWinningMoves.push(move);
        console.log(`🎯 ALMOST WINNING: ${move.type} ${move.piece?.meta.key} to (${move.q},${move.r}) puts Queen at 5/6`);
      }
    }
    
    return almostWinningMoves;
  },
  
  /**
   * SIMPLE DIRECT QUEEN ATTACK FINDER - Find any move adjacent to opponent Queen
   */
  findDirectQueenAttacks: function(moves) {
    const queenAttackMoves = [];
    
    // Find opponent Queen
    const oppColor = this.color === 'white' ? 'black' : 'white';
    const pieces = window.tray || tray;
    const oppQueen = pieces?.find(p => p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed);
    
    if (!oppQueen) {
      console.log('👑 No opponent Queen found on board');
      return queenAttackMoves;
    }
    
    console.log(`👑 Opponent Queen at (${oppQueen.q},${oppQueen.r}) - looking for adjacent attacks...`);
    
    // Check each move to see if it's adjacent to opponent Queen
    for (const move of moves) {
      const distance = Math.abs(move.q - oppQueen.q) + Math.abs(move.r - oppQueen.r);
      if (distance === 1) {
        queenAttackMoves.push(move);
        console.log(`👑 QUEEN ATTACK MOVE: ${move.type} ${move.piece?.meta.key} to (${move.q},${move.r}) adjacent to Queen!`);
      }
    }
    
    return queenAttackMoves;
  },
  
  /**
   * Find moves that prevent immediate loss (defend our queen)
   */
  findDefensiveMoves: function(moves) {
    const defensiveMoves = [];
    
    // Check if our queen is in immediate danger
    const oppColor = this.color === 'white' ? 'black' : 'white';
    if (this.isQueenAlmostSurrounded(this.color)) {
      console.log(`🚨 Our queen is in danger! Looking for defensive moves...`);
      
      for (const move of moves) {
        if (this.moveDefendsQueen(move)) {
          defensiveMoves.push(move);
          console.log(`🛡️ DEFENSIVE: ${move.type} ${move.piece?.meta.key} to (${move.q},${move.r})`);
        }
      }
    }
    
    return defensiveMoves;
  },
  
  /**
   * Check if a move results in immediate victory
   */
  simulateWinningMove: function(move) {
    // Use the main engine's queen surrounded detection if available
    if (window.AIEngine && window.AIEngine.isQueenSurrounded) {
      // Simple simulation - check if move surrounds opponent queen
      const oppColor = this.color === 'white' ? 'black' : 'white';
      
      // For simplicity, check if the move is adjacent to opponent queen
      // and would complete surrounding (this is a simplified check)
      return this.wouldMoveSurroundQueen(move, oppColor);
    }
    
    return false; // Fallback if no detection available
  },
  
  /**
   * Check if move would surround opponent queen (simplified)
   */
  wouldMoveSurroundQueen: function(move, oppColor) {
    // Find opponent queen
    const pieces = window.tray || tray;
    const oppQueen = pieces?.find(p => p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed);
    if (!oppQueen) return false;
    
    // Check if move is adjacent to opponent queen
    const queenNeighbors = [
      [oppQueen.q + 1, oppQueen.r],
      [oppQueen.q - 1, oppQueen.r], 
      [oppQueen.q, oppQueen.r + 1],
      [oppQueen.q, oppQueen.r - 1],
      [oppQueen.q + 1, oppQueen.r - 1],
      [oppQueen.q - 1, oppQueen.r + 1]
    ];
    
    const isAdjacent = queenNeighbors.some(([q, r]) => q === move.q && r === move.r);
    if (!isAdjacent) return false;
    
    // Count how many neighbors would be occupied after this move
    let occupiedCount = 0;
    for (const [q, r] of queenNeighbors) {
      const key = `${q},${r}`;
      const cell = window.cells?.get(key);
      
      if ((q === move.q && r === move.r) || (cell && cell.stack.length > 0)) {
        occupiedCount++;
      }
    }

    // Queen is surrounded if all 6 neighbors are occupied
    const result = occupiedCount >= 6;
    if (result) {
      console.log(`🏆 WINNING MOVE DETECTED: ${move.type} ${move.piece?.meta.key} to (${move.q},${move.r}) creates 6/6 surround!`);
    }
    return result;
  },
  
  /**
   * Check if move would almost surround opponent queen (5/6 neighbors)
   */
  wouldMoveAlmostSurroundQueen: function(move) {
    const oppColor = this.color === 'white' ? 'black' : 'white';
    const pieces = window.tray || tray;
    const oppQueen = pieces?.find(p => p.meta.color === oppColor && p.meta.key === 'Q' && p.meta.placed);
    if (!oppQueen) return false;
    
    // Check if move is adjacent to opponent queen
    const queenNeighbors = [
      [oppQueen.q + 1, oppQueen.r],
      [oppQueen.q - 1, oppQueen.r], 
      [oppQueen.q, oppQueen.r + 1],
      [oppQueen.q, oppQueen.r - 1],
      [oppQueen.q + 1, oppQueen.r - 1],
      [oppQueen.q - 1, oppQueen.r + 1]
    ];
    
    const isAdjacent = queenNeighbors.some(([q, r]) => q === move.q && r === move.r);
    if (!isAdjacent) return false;
    
    // Count how many neighbors would be occupied after this move
    let occupiedCount = 0;
    for (const [q, r] of queenNeighbors) {
      const key = `${q},${r}`;
      const cell = window.cells?.get(key);
      
      if ((q === move.q && r === move.r) || (cell && cell.stack.length > 0)) {
        occupiedCount++;
      }
    }
    
    // Almost surrounded if 5 out of 6 neighbors are occupied
    const result = occupiedCount === 5;
    if (result) {
      console.log(`🎯 ALMOST WIN DETECTED: ${move.type} ${move.piece?.meta.key} to (${move.q},${move.r}) creates 5/6 surround!`);
    }
    return result;
  },
  
  /**
   * Check if queen is almost surrounded (5 out of 6 neighbors)
   */
  isQueenAlmostSurrounded: function(color) {
    const pieces = window.tray || tray;
    const queen = pieces?.find(p => p.meta.color === color && p.meta.key === 'Q' && p.meta.placed);
    if (!queen) return false;
    
    const neighbors = [
      [queen.q + 1, queen.r],
      [queen.q - 1, queen.r],
      [queen.q, queen.r + 1], 
      [queen.q, queen.r - 1],
      [queen.q + 1, queen.r - 1],
      [queen.q - 1, queen.r + 1]
    ];
    
    let occupiedCount = 0;
    for (const [q, r] of neighbors) {
      const key = `${q},${r}`;
      const cell = window.cells?.get(key);
      if (cell && cell.stack.length > 0) {
        occupiedCount++;
      }
    }
    
    return occupiedCount >= 5; // Almost surrounded
  },
  
  /**
   * Check if move helps defend our queen
   */
  moveDefendsQueen: function(move) {
    // Simple check - does this move block an attack route to our queen?
    const pieces = window.tray || tray;
    const ourQueen = pieces?.find(p => p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed);
    if (!ourQueen) return false;
    
    // Check if move is adjacent to our queen (defensive positioning)
    const queenNeighbors = [
      [ourQueen.q + 1, ourQueen.r],
      [ourQueen.q - 1, ourQueen.r],
      [ourQueen.q, ourQueen.r + 1],
      [ourQueen.q, ourQueen.r - 1], 
      [ourQueen.q + 1, ourQueen.r - 1],
      [ourQueen.q - 1, ourQueen.r + 1]
    ];
    
    return queenNeighbors.some(([q, r]) => q === move.q && r === move.r);
  },
  
  /**
   * CRITICAL: Analyze our own queen's safety
   */
  analyzeOurQueenSafety: function() {
    const pieces = window.tray || tray;
    const ourQueen = pieces?.find(p => p.meta.color === this.color && p.meta.key === 'Q' && p.meta.placed);
    
    if (!ourQueen) {
      return { level: 'safe', occupied: 0, reason: 'Queen not placed yet' };
    }
    
    const queenPos = { q: ourQueen.meta.q, r: ourQueen.meta.r };
    const neighbors = this.getNeighbors(queenPos.q, queenPos.r);
    let occupiedCount = 0;
    let enemyPieces = 0;
    let emptySpaces = [];
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        occupiedCount++;
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta.color !== this.color) {
          enemyPieces++;
        }
      } else {
        emptySpaces.push({ q: nq, r: nr });
      }
    }
    
    let level = 'safe';
    let reason = `${occupiedCount}/6 spaces occupied`;
    
    // MUCH MORE AGGRESSIVE THREAT DETECTION
    if (occupiedCount >= 4) {
      level = 'extreme';
      reason = `EMERGENCY! ${occupiedCount}/6 surrounded - MOVE NOW!`;
    } else if (occupiedCount >= 3) {
      level = 'critical';
      reason = `DANGER! ${occupiedCount}/6 surrounded - escape required!`;
    } else if (occupiedCount >= 2 && enemyPieces >= 2) {
      level = 'warning';
      reason = `Under attack: ${occupiedCount}/6 with ${enemyPieces} enemy pieces`;
    } else if (occupiedCount >= 2) {
      level = 'warning';
      reason = `Pressure building: ${occupiedCount}/6 surrounded`;
    }
    
    return {
      level,
      occupied: occupiedCount,
      enemyPieces,
      emptySpaces,
      reason,
      position: queenPos
    };
  },
  
  /**
   * Check if a move is defensive (helps protect our queen)
   */
  isDefensiveMove: function(move, queenThreat) {
    // Option 1: Move our queen to safety
    if (move.type === 'move' && move.piece.meta.key === 'Q') {
      const newThreatCount = this.countThreatsAtPosition(move.q, move.r);
      if (newThreatCount < queenThreat.occupied) {
        
        return true;
      }
    }
    
    // Option 2: Move one of our pieces away to create escape space
    if (move.type === 'move' && move.piece.meta.color === this.color) {
      const currentPos = `${move.piece.meta.q},${move.piece.meta.r}`;
      const queenNeighbors = this.getNeighbors(queenThreat.position.q, queenThreat.position.r);
      
      // Is this piece currently blocking queen's escape?
      const isBlockingEscape = queenNeighbors.some(([q, r]) => 
        move.piece.meta.q === q && move.piece.meta.r === r
      );
      
      if (isBlockingEscape) {
        
        return true;
      }
    }
    
    // Option 3: Place a piece that blocks enemy attack
    if (move.type === 'place') {
      // Check if placement would block an enemy piece from reaching our queen
      const wouldBlockAttack = queenThreat.emptySpaces.some(empty => 
        move.q === empty.q && move.r === empty.r
      );
      
      if (wouldBlockAttack) {
        console.log(`🛡️ Blocking attack route with ${move.piece.meta.key}`);
        return true;
      }
    }
    
    return false;
  },

  /**
   * Analyze Queen escape routes to enable coordinated attacks
   */
  analyzeQueenEscapeRoutes: function(queen) {
    if (!queen || !queen.meta.placed) {
      return { escapeSpaces: [], blockedRoutes: 0, openRoutes: 0 };
    }
    
    const queenPos = { q: queen.meta.q, r: queen.meta.r };
    const neighbors = this.getNeighbors(queenPos.q, queenPos.r);
    
    let escapeSpaces = [];
    let blockedRoutes = 0;
    let openRoutes = 0;
    
    // Check each adjacent space
    for (const [nq, nr] of neighbors) {
      const cell = window.cells?.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        blockedRoutes++;
      } else {
        // This is an empty space - potential escape route
        escapeSpaces.push({ q: nq, r: nr });
        openRoutes++;
        
        // Also consider spaces adjacent to escape routes (extended escape analysis)
        const escapeNeighbors = this.getNeighbors(nq, nr);
        for (const [enq, enr] of escapeNeighbors) {
          // Skip the Queen's current position and already occupied spaces
          if (enq === queenPos.q && enr === queenPos.r) continue;
          
          const escapeCell = window.cells?.get(`${enq},${enr}`);
          if (!escapeCell || escapeCell.stack.length === 0) {
            // This is a secondary escape route (Queen could move to primary, then to secondary)
            const alreadyIncluded = escapeSpaces.some(space => space.q === enq && space.r === enr);
            if (!alreadyIncluded && Math.abs(enq - queenPos.q) + Math.abs(enr - queenPos.r) <= 2) {
              escapeSpaces.push({ q: enq, r: enr, secondary: true });
            }
          }
        }
      }
    }
    
    
    
    return {
      escapeSpaces,
      blockedRoutes,
      openRoutes,
      threatLevel: blockedRoutes >= 4 ? 'extreme' : blockedRoutes >= 3 ? 'high' : 'moderate'
    };
  },

  /**
   * VIDSTIGE HELPER FUNCTIONS
   * Simple but effective Queen freedom evaluation
   */

  /**
   * Find a Queen piece of the specified color
   */
  findQueen: function(color) {
    if (!window.tray) return null;
    
    const queen = window.tray.find(p => 
      p.meta && 
      p.meta.color === color && 
      p.meta.key === 'Q' && 
      p.meta.placed
    );
    
    return queen ? { q: queen.meta.q, r: queen.meta.r } : null;
  },

  /**
   * Count the number of free movement squares around a Queen
   */
  countQueenFreedom: function(q, r) {
    const neighbors = this.getNeighbors(q, r);
    let freeSquares = 0;
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (!cell || cell.stack.length === 0) {
        freeSquares++;
      }
    }
    
    return freeSquares;
  },

  /**
   * Count enemy pieces adjacent to a Queen (makatony approach)
   */
  countQueenThreats: function(q, r, enemyColor) {
    const neighbors = this.getNeighbors(q, r);
    let threatCount = 0;
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta && topPiece.meta.color === enemyColor) {
          threatCount++;
        }
      }
    }
    
    return threatCount;
  },

  /**
   * Simulate a move and return the resulting state
   */
  simulateMove: function(move) {
    // For now, use a simplified simulation
    // In a full implementation, we'd create a deep copy of the game state
    // and apply the move, then restore it
    
    // Simplified: just check if the move is valid
    if (move.type === 'place') {
      const cell = window.cells.get(`${move.q},${move.r}`);
      if (cell && cell.stack.length > 0) {
        return { success: false, originalState: null };
      }
    }
    
    return { 
      success: true, 
      originalState: null // We'll implement state saving/restoration later
    };
  },

  /**
   * Restore the game position (placeholder for full implementation)
   */
  restorePosition: function(originalState) {
    // Placeholder - in a full implementation, this would restore
    // the game state from the saved state
    return true;
  }
};

/**
 * V2 Engine Activation Function - Missing piece that connects V2 to UI!
 */
window.activateAIV2 = function() {
  console.log('🚀 Activating AI Engine V2!');
  
  // Disable original engine
  if (window.AIEngine) {
    window.AIEngine.enabled = false;
    console.log('📴 Original AI Engine disabled');
  }
  
  // Enable V2 engine
  window.AIEngineV2.enabled = true;
  window.AIEngineV2.color = 'black';
  window.AIEngineV2.difficulty = 'hard';
  
  console.log('✅ AI Engine V2 is now active and ready!');
  
  // Hook into the main AI flow by replacing checkAndMakeMove
  if (window.AIEngine && window.AIEngine.checkAndMakeMove) {
    window.AIEngine.checkAndMakeMove = window.AIEngineV2.makeMove.bind(window.AIEngineV2);
    console.log('🔗 V2 engine hooked into main AI flow');
  }
};

console.log('🧠 AI Engine V2 loaded with Smart Iteration Scaling!');
