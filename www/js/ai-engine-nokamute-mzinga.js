/**
 * HYVEMYND AI Engine - Nokamute/Mzinga Hybrid
 * Based on proven algorithms from two of the strongest Hive AIs
 * MIT Licensed implementations adapted for JavaScript
 */

window.NokamuteMetricWeights = {
  // Nokamute-style evaluation weights
  basic: {
    aggression: 3, // 1-5 scale, 3 = balanced
    queenLibertyFactor: 30, // aggression * 10
    movableQueenValue: 12,  // aggression * 4
    movableBugFactor: 2,
    unplayedBugFactor: 1,
    pillbugDefenseBonus: 120 // aggression * 40
  },

  // Mzinga-style piece values and weights
  pieceValues: {
    'Q': { value: 12, inPlay: 100, isPinned: -50, mobility: 20 }, // Queen: critical
    'A': { value: 7,  inPlay: 40,  isPinned: -30, mobility: 15 }, // Ant: mobile
    'B': { value: 6,  inPlay: 35,  isPinned: -20, mobility: 12 }, // Beetle: versatile
    'G': { value: 2,  inPlay: 20,  isPinned: -10, mobility: 8  }, // Grasshopper: jumper
    'S': { value: 2,  inPlay: 20,  isPinned: -10, mobility: 10 }, // Spider: limited
    'M': { value: 8,  inPlay: 45,  isPinned: -25, mobility: 18 }, // Mosquito: adaptive
    'L': { value: 6,  inPlay: 35,  isPinned: -20, mobility: 14 }, // Ladybug: mobile
    'P': { value: 5,  inPlay: 30,  isPinned: -15, mobility: 8  }  // Pillbug: tactical
  },

  // Difficulty scaling (Easy/Medium/Hard)
  difficulty: {
    easy: { aggression: 1, depth: 2, queenWeight: 0.5 },
    medium: { aggression: 3, depth: 4, queenWeight: 1.0 },
    hard: { aggression: 5, depth: 6, queenWeight: 2.0 }
  }
};

window.AIEngineNokamuteMzinga = {
  enabled: false,
  color: 'black',
  difficulty: 'medium',
  thinking: false,
  lastTurn: null, // Track last turn to prevent double moves
  
  // Current game state analysis
  gamePhase: 'opening', // opening, midgame, endgame
  
  /**
   * Main AI move selection - nokamute/Mzinga hybrid approach
   */
  findBestMove: async function() {
    if (!this.enabled || this.thinking) {
      console.log(`🤖 Nokamute/Mzinga AI not ready: enabled=${this.enabled}, thinking=${this.thinking}`);
      return null;
    }
    
    this.thinking = true;
    console.log('🤖 🔥 NOKAMUTE/MZINGA AI ENGINE ACTIVATED! 🔥');
    
    try {
      // Get difficulty settings
      const difficultySettings = window.NokamuteMetricWeights.difficulty[this.difficulty];
      
      // Analyze current game phase
      this.analyzeGamePhase();
      
      // Get all possible moves
      const allMoves = this.getAllPossibleMoves();
      if (allMoves.length === 0) {
        console.log('🤖 No moves available');
        return null;
      }
      
      console.log(`🤖 Evaluating ${allMoves.length} moves with ${this.difficulty} difficulty`);
      
      // Evaluate each move using hybrid nokamute/Mzinga approach
      let bestMove = null;
      let bestScore = -Infinity;
      
      for (const move of allMoves) {
        const score = this.evaluateMove(move, difficultySettings);
        
        // Only log occasionally to reduce spam
        if (Math.random() < 0.05) { // Only log 5% of move evaluations
          console.log(`🤖 Move ${move.type} ${move.piece?.meta.key || '?'} to (${move.q},${move.r}): ${score.toFixed(2)}`);
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
      
      console.log(`🤖 Selected move with score ${bestScore.toFixed(2)}: ${bestMove.type} ${bestMove.piece?.meta.key || '?'} to (${bestMove.q},${bestMove.r})`);
      
      return bestMove;
      
    } finally {
      this.thinking = false;
    }
  },

  /**
   * Nokamute/Mzinga Hybrid Move Evaluation
   */
  evaluateMove: function(move, difficultySettings) {
    // Simulate applying the move
    const originalState = this.captureGameState();
    this.simulateMove(move);
    
    try {
      // Calculate hybrid score
      let score = 0;
      
      // 1. NOKAMUTE-STYLE QUEEN LIBERTY ANALYSIS
      score += this.evaluateQueenLiberties(difficultySettings) * difficultySettings.queenWeight;
      
      // 2. MZINGA-STYLE PIECE MOBILITY AND POSITIONING
      score += this.evaluatePieceMobility(difficultySettings);
      
      // 3. NOKAMUTE-STYLE AGGRESSION BONUSES
      score += this.evaluateAggression(move, difficultySettings);
      
      // 4. ENDGAME WIN DETECTION
      score += this.evaluateWinConditions();
      
      return score;
      
    } finally {
      // Restore original state
      this.restoreGameState(originalState);
    }
  },

  /**
   * NOKAMUTE-STYLE: Queen Liberty Evaluation
   * Core algorithm from nokamute BasicEvaluator
   */
  evaluateQueenLiberties: function(settings) {
    const myColor = this.color;
    const opponentColor = myColor === 'white' ? 'black' : 'white';
    
    const myQueen = this.findQueen(myColor);
    const opponentQueen = this.findQueen(opponentColor);
    
    let score = 0;
    
    // Evaluate my Queen's liberties (positive for more freedom)
    if (myQueen) {
      const myLiberties = this.countQueenLiberties(myQueen.q, myQueen.r);
      score += myLiberties * settings.aggression * 10;
      
      // Penalty for being surrounded
      const myThreats = this.countAdjacentEnemies(myQueen.q, myQueen.r, opponentColor);
      score -= myThreats * settings.aggression * 15;
    }
    
    // Evaluate opponent Queen's liberties (negative for their freedom)
    if (opponentQueen) {
      const oppLiberties = this.countQueenLiberties(opponentQueen.q, opponentQueen.r);
      score -= oppLiberties * settings.aggression * 20; // 2x penalty as in nokamute
      
      // Bonus for threatening opponent Queen
      const oppThreats = this.countAdjacentEnemies(opponentQueen.q, opponentQueen.r, myColor);
      score += oppThreats * settings.aggression * 25;
    }
    
    return score;
  },

  /**
   * MZINGA-STYLE: Piece Mobility and Positioning
   * Multi-factor evaluation per piece type
   */
  evaluatePieceMobility: function(settings) {
    let score = 0;
    const myColor = this.color;
    const weights = window.NokamuteMetricWeights.pieceValues;
    
    // Evaluate all pieces on the board - use safe array access
    const allPieces = window.tray || tray || [];
    for (const piece of allPieces) {
      if (!piece.meta || !piece.meta.placed) continue;
      
      const pieceType = piece.meta.key;
      const pieceColor = piece.meta.color;
      const colorMultiplier = pieceColor === myColor ? 1 : -1;
      const pieceWeights = weights[pieceType] || weights['A']; // Default to Ant
      
      // Base piece value
      score += colorMultiplier * pieceWeights.inPlay;
      
      // Mobility evaluation
      const moveCount = this.countValidMovesForPiece(piece);
      score += colorMultiplier * moveCount * pieceWeights.mobility;
      
      // Pinning penalty (nokamute-style)
      if (this.isPiecePinned(piece)) {
        score += colorMultiplier * pieceWeights.isPinned;
      }
      
      // Neighbor evaluation
      const neighbors = this.analyzeNeighbors(piece.meta.q, piece.meta.r);
      score += colorMultiplier * neighbors.friendlyCount * 2;
      score += colorMultiplier * neighbors.enemyCount * 3; // Bonus for engaging enemy
    }
    
    return score;
  },

  /**
   * NOKAMUTE-STYLE: Aggression Bonuses
   */
  evaluateAggression: function(move, settings) {
    let score = 0;
    const opponentColor = this.color === 'white' ? 'black' : 'white';
    const opponentQueen = this.findQueen(opponentColor);
    
    if (!opponentQueen) return 0;
    
    // Direct Queen attack bonus
    const distanceToQueen = Math.abs(move.q - opponentQueen.q) + Math.abs(move.r - opponentQueen.r);
    if (distanceToQueen === 1) {
      score += 500 * settings.aggression; // MASSIVE bonus for adjacent to Queen
    } else if (distanceToQueen === 2) {
      score += 200 * settings.aggression; // Good bonus for near Queen
    }
    
    // Escape route blocking (nokamute-style)
    const queenLiberties = this.getQueenLibertyPositions(opponentQueen.q, opponentQueen.r);
    for (const liberty of queenLiberties) {
      if (Math.abs(move.q - liberty.q) + Math.abs(move.r - liberty.r) <= 1) {
        score += 100 * settings.aggression; // Bonus for blocking escape
      }
    }
    
    return score;
  },

  /**
   * Win condition detection
   */
  evaluateWinConditions: function() {
    const opponentColor = this.color === 'white' ? 'black' : 'white';
    const opponentQueen = this.findQueen(opponentColor);
    
    if (opponentQueen) {
      const liberties = this.countQueenLiberties(opponentQueen.q, opponentQueen.r);
      const threats = this.countAdjacentEnemies(opponentQueen.q, opponentQueen.r, this.color);
      
      // Winning condition: Queen completely surrounded
      if (liberties === 0 && threats >= 6) {
        return 100000; // Game winning move
      }
      
      // Near-win conditions
      if (liberties === 1 && threats >= 5) {
        return 50000; // One move from win
      }
      
      if (liberties <= 2 && threats >= 4) {
        return 10000; // Strong winning pressure
      }
    }
    
    return 0;
  },

  /**
   * Helper functions for move evaluation
   */
  
  getAllPossibleMoves: function() {
    // Use existing game.js functions
    const moves = [];
    
    // Get placement moves
    if (typeof window.legalPlacementZones === 'function') {
      const placementZones = window.legalPlacementZones(this.color);
      const allPieces = window.tray || tray || [];
      const availablePieces = allPieces.filter(p => 
        p.meta && p.meta.color === this.color && !p.meta.placed
      );
      
      console.log(`🤖 Found ${placementZones.size} placement zones and ${availablePieces.length} available pieces`);
      
      for (const zone of placementZones) {
        const [q, r] = zone.split(',').map(Number);
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
    
    // Get movement moves
    if (typeof window.legalMoveZones === 'function') {
      const allPieces = window.tray || tray || [];
      const myPieces = allPieces.filter(p => 
        p.meta && p.meta.color === this.color && p.meta.placed
      );
      
      console.log(`🤖 Checking movement for ${myPieces.length} placed pieces`);
      
      for (const piece of myPieces) {
        const moveZones = window.legalMoveZones(piece);
        const zones = Array.isArray(moveZones) ? moveZones : Array.from(moveZones);
        
        console.log(`🤖 Piece ${piece.meta.key} at (${piece.meta.q},${piece.meta.r}) has ${zones.length} legal move zones`);
        
        for (const zone of zones) {
          const [q, r] = zone.split(',').map(Number);
          
          // Validate the move before adding it
          if (isNaN(q) || isNaN(r)) {
            console.warn(`🤖 Invalid coordinates: ${zone}`);
            continue;
          }
          
          moves.push({
            type: 'move',
            piece: piece,
            q: q,
            r: r
          });
        }
      }
    }
    
    console.log(`🤖 Total possible moves: ${moves.length}`);
    return moves;
  },

  findQueen: function(color) {
    const allPieces = window.tray || tray || [];
    const queen = allPieces.find(p => 
      p.meta && p.meta.color === color && p.meta.key === 'Q' && p.meta.placed
    );
    return queen ? { q: queen.meta.q, r: queen.meta.r } : null;
  },

  countQueenLiberties: function(q, r) {
    const neighbors = this.getNeighbors(q, r);
    let liberties = 0;
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (!cell || cell.stack.length === 0) {
        liberties++;
      }
    }
    
    return liberties;
  },

  countAdjacentEnemies: function(q, r, enemyColor) {
    const neighbors = this.getNeighbors(q, r);
    let count = 0;
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta && topPiece.meta.color === enemyColor) {
          count++;
        }
      }
    }
    
    return count;
  },

  getQueenLibertyPositions: function(q, r) {
    const neighbors = this.getNeighbors(q, r);
    const liberties = [];
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (!cell || cell.stack.length === 0) {
        liberties.push({ q: nq, r: nr });
      }
    }
    
    return liberties;
  },

  getNeighbors: function(q, r) {
    return [
      [q+1, r],   // E
      [q+1, r-1], // NE  
      [q, r-1],   // NW
      [q-1, r],   // W
      [q-1, r+1], // SW
      [q, r+1]    // SE
    ];
  },

  analyzeGamePhase: function() {
    const allPieces = window.tray || tray || [];
    const totalPieces = allPieces.filter(p => p.meta && p.meta.placed).length;
    const totalAvailable = allPieces.length;
    
    if (totalPieces < 8) {
      this.gamePhase = 'opening';
    } else if (totalPieces < totalAvailable * 0.8) {
      this.gamePhase = 'midgame';
    } else {
      this.gamePhase = 'endgame';
    }
  },

  // Simplified simulation functions
  captureGameState: function() {
    // For full implementation, would capture complete board state
    return { simplified: true };
  },

  simulateMove: function(move) {
    // For full implementation, would apply move to game state
    return true;
  },

  restoreGameState: function(state) {
    // For full implementation, would restore previous state
    return true;
  },

  countValidMovesForPiece: function(piece) {
    if (!window.legalMoveZones) return 0;
    const moveZones = window.legalMoveZones(piece);
    return Array.isArray(moveZones) ? moveZones.length : moveZones.size || 0;
  },

  isPiecePinned: function(piece) {
    // Simplified: check if piece can move
    return this.countValidMovesForPiece(piece) === 0;
  },

  analyzeNeighbors: function(q, r) {
    const neighbors = this.getNeighbors(q, r);
    let friendlyCount = 0;
    let enemyCount = 0;
    
    for (const [nq, nr] of neighbors) {
      const cell = window.cells.get(`${nq},${nr}`);
      if (cell && cell.stack.length > 0) {
        const topPiece = cell.stack[cell.stack.length - 1];
        if (topPiece.meta) {
          if (topPiece.meta.color === this.color) {
            friendlyCount++;
          } else {
            enemyCount++;
          }
        }
      }
    }
    
    return { friendlyCount, enemyCount };
  }
};

/**
 * Integration function to use Nokamute/Mzinga engine
 */
window.activateNokamuteMzingaAI = function(difficulty = 'medium') {
  console.log('🚀 Activating Nokamute/Mzinga AI Engine!');
  
  // Disable other engines
  if (window.AIEngine) window.AIEngine.enabled = false;
  if (window.AIEngineV2) window.AIEngineV2.enabled = false;
  
  // Enable Nokamute/Mzinga engine
  window.AIEngineNokamuteMzinga.enabled = true;
  window.AIEngineNokamuteMzinga.color = 'black';
  window.AIEngineNokamuteMzinga.difficulty = difficulty;
  
  // CRITICAL: Hook into the main AI flow by replacing the original AIEngine
  if (!window.AIEngine) {
    // Create AIEngine object if it doesn't exist
    window.AIEngine = {};
  }
  
  // Replace the entire AIEngine with our implementation
  window.AIEngine.enabled = true;
  window.AIEngine.color = 'black';
  window.AIEngine.difficulty = difficulty;
  
  // Hook the main move function
  window.AIEngine.checkAndMakeMove = async function() {
    // Reduced logging to prevent console spam
    
    if (window.state.current === window.AIEngineNokamuteMzinga.color && window.AIEngineNokamuteMzinga.enabled && !window.animating) {
      // Check if AI already took this turn
      if (window.AIEngineNokamuteMzinga.lastTurn === window.state.current) {
        // Reduced logging to prevent spam
        return;
      }
      
      // Reduced logging to prevent spam
      // Don't set lastTurn here - wait until move is completed
      
      try {
        const move = await window.AIEngineNokamuteMzinga.findBestMove();
        if (move) {
          console.log(`🤖 Executing move: ${move.type} ${move.piece?.meta.key || '?'} to (${move.q},${move.r})`);
          
          if (move.type === 'place') {
            console.log('🤖 Executing placement:', move.piece.meta.key, 'to', `(${move.q},${move.r})`);
            
            // Find the actual piece in tray for placement
            const availableTray = window.tray || tray || [];
            if (!availableTray || availableTray.length === 0) {
              console.error('🤖 Tray not available for placement');
              return;
            }
            
            const targetPiece = availableTray.find(p => 
              p.meta && p.meta.key === move.piece.meta.key && 
              p.meta.color === move.piece.meta.color &&
              !p.meta.placed // For placement, piece should not be placed yet
            );
            
            if (!targetPiece) {
              console.error('🤖 Could not find piece in tray for placement:', move.piece.meta.key);
              console.log('🤖 Tray contains:', availableTray.length, 'pieces');
              console.log('🤖 Looking for:', move.piece.meta.key, move.piece.meta.color, 'placed:', move.piece.meta.placed);
              console.log('🤖 Available pieces:', availableTray.filter(p => p.meta && p.meta.color === move.piece.meta.color && !p.meta.placed).map(p => `${p.meta.key}(${p.meta.placed})`));
              return;
            }
            
            window.selectPlacement(targetPiece);
            setTimeout(() => {
              try {
                if (!window.selected || !window.selected.piece) {
                  console.error('🤖 No piece selected after selectPlacement');
                  return;
                }
                window.commitPlacement(move.q, move.r);
                window.AIEngineNokamuteMzinga.lastTurn = window.state.current; // Mark turn as completed
              } catch (error) {
                console.error('🤖 Placement failed:', error);
                // Don't mark turn as completed on error
              }
            }, 100);
          } else if (move.type === 'move') {
            console.log('🤖 Executing move:', move.piece.meta.key, 'from', `(${move.piece.meta.q},${move.piece.meta.r})`, 'to', `(${move.q},${move.r})`);
            
            // Validate piece exists and is at expected location
            if (!move.piece || !move.piece.meta) {
              console.error('🤖 Invalid piece object, aborting move');
              // Don't mark turn as completed on error
              return;
            }
            
            // Store piece reference for validation - find the actual piece in tray
            const availableTray = window.tray || tray || [];
            if (!availableTray || availableTray.length === 0) {
              console.error('🤖 Tray not available or empty');
              return;
            }
            
            const targetPiece = availableTray.find(p => 
              p.meta && p.meta.key === move.piece.meta.key && 
              p.meta.color === move.piece.meta.color &&
              p.meta.q === move.piece.meta.q && 
              p.meta.r === move.piece.meta.r
            );
            
            if (!targetPiece) {
              console.error('🤖 Could not find piece in tray:', move.piece.meta.key);
              return;
            }
            
            window.selectMove(targetPiece);
            setTimeout(() => {
              try {
                // Double-check selection state
                if (window.selected && window.selected.piece && window.selected.piece === targetPiece) {
                  console.log('🤖 Committing move for piece:', targetPiece.meta.key);
                  
                  // Extra debug for grasshopper moves
                  if (targetPiece.meta.key === 'G') {
                    console.log(`🤖🦗 AI moving grasshopper from (${targetPiece.meta.q},${targetPiece.meta.r}) to (${move.q},${move.r})`);
                    const legalZones = window.legalMoveZones(targetPiece);
                    console.log(`🤖🦗 Legal zones for this grasshopper:`, legalZones);
                    console.log(`🤖🦗 Target (${move.q},${move.r}) is in legal zones:`, legalZones.includes(`${move.q},${move.r}`));
                  }
                  
                  window.commitMove(move.q, move.r);
                  window.AIEngineNokamuteMzinga.lastTurn = window.state.current; // Mark turn as completed
                } else {
                  console.error('🤖 Selection mismatch - selected:', window.selected?.piece?.meta?.key, 'expected:', targetPiece.meta.key);
                  
                  // Try selecting again with better retry logic
                  console.log('🤖 Retrying selection...');
                  window.selectMove(targetPiece);
                  setTimeout(() => {
                    if (window.selected && window.selected.piece === targetPiece) {
                      console.log('🤖 Second attempt successful, committing move');
                      window.commitMove(move.q, move.r);
                      window.AIEngineNokamuteMzinga.lastTurn = window.state.current; // Mark turn as completed
                    } else {
                      console.error('🤖 Second selection attempt failed, skipping move');
                      // Don't mark turn as completed on failure
                    }
                  }, 150); // Longer delay for retry
                  return;
                }
                // Don't reset lastTurn here - it's set after successful moves above
              } catch (error) {
                console.error('🤖 Move failed:', error);
                // Don't mark turn as completed on error
              }
            }, 200); // Increased delay for more reliable selection
          }
        } else {
          // Reduced logging to prevent spam
          // Don't mark turn as completed if no move found
        }
      } catch (error) {
        console.error('🤖 AI error:', error);
        // Don't mark turn as completed on error
      }
    } else {
      // Reduced logging to prevent spam
    }
  };
  
  // Make sure the hook is in place
  if (typeof window.AIEngine.hookIntoGame === 'function') {
    window.AIEngine.hookIntoGame();
    console.log('🔗 Hooked into game updateHUD');
  } else {
    console.log('⚠️ No hookIntoGame function found - manually hooking updateHUD');
    
    // Manual hook if the function doesn't exist
    if (typeof window.updateHUD === 'function' && !window.updateHUD._aiHooked) {
      const originalUpdateHUD = window.updateHUD;
      
      window.updateHUD = function() {
        // Reset AI turn tracking when game state changes  
        const currentTurn = window.state?.current;
        if (window.AIEngineNokamuteMzinga.lastTurn && window.AIEngineNokamuteMzinga.lastTurn !== currentTurn) {
          window.AIEngineNokamuteMzinga.lastTurn = null;
        }
        
        originalUpdateHUD.apply(this, arguments);
        
        setTimeout(() => {
          window.AIEngine.checkAndMakeMove();
        }, 100);
      };
      
      window.updateHUD._aiHooked = true;
      console.log('🔗 Manually hooked into updateHUD');
    }
  }
  
  console.log('🔗 Nokamute/Mzinga engine hooked into main AI flow');
  console.log(`✅ Nokamute/Mzinga AI is now active on ${difficulty} difficulty!`);
};

console.log('🧠 Nokamute/Mzinga Hybrid AI Engine loaded!');