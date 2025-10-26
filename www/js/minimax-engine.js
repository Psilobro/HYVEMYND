/**
 * HYVEMYND Minimax Engine
 * Alpha-Beta Pruning Search for Tactical Hive Positions
 * Complements MCTS with precise tactical calculation
 */

window.MinimaxEngine = {
  // Configuration
  maxDepth: 6,
  transpositionTable: new Map(),
  maxTableSize: 10000,
  nodeCount: 0,
  pruneCount: 0,
  
  /**
   * Clear transposition table and reset counters
   */
  reset: function() {
    this.transpositionTable.clear();
    this.nodeCount = 0;
    this.pruneCount = 0;
  },

  /**
   * MINIMAX with Alpha-Beta Pruning - Main search function
   */
  search: function(gameState, depth, alpha, beta, maximizingPlayer, aiColor) {
    try {
      this.nodeCount++;
      
      // Generate hash for transposition table
      const stateHash = this.hashGameState(gameState);
      
      // Check transposition table
      const ttEntry = this.transpositionTable.get(stateHash);
      if (ttEntry && ttEntry.depth >= depth) {
        if (ttEntry.type === 'exact') {
          return ttEntry.value;
        }
        if (ttEntry.type === 'lowerbound' && ttEntry.value >= beta) {
          return ttEntry.value;
        }
        if (ttEntry.type === 'upperbound' && ttEntry.value <= alpha) {
          return ttEntry.value;
        }
      }

      // Terminal conditions
      if (depth === 0) {
        const evaluation = this.evaluatePosition(gameState, aiColor);
        this.storeTransposition(stateHash, evaluation, depth, 'exact');
        return evaluation;
      }
      
      if (this.isGameOver(gameState)) {
        const evaluation = this.evaluateTerminalPosition(gameState, aiColor);
        this.storeTransposition(stateHash, evaluation, depth, 'exact');
        return evaluation;
      }
      
      const moves = this.generateOrderedMoves(gameState);
      
      if (moves.length === 0) {
        // Pass turn scenario
        const newState = this.passTurn(gameState);
        const evaluation = this.search(newState, depth - 1, alpha, beta, !maximizingPlayer, aiColor);
        this.storeTransposition(stateHash, evaluation, depth, 'exact');
        return evaluation;
      }
      
      let bestValue;
      let entryType = 'upperbound';
      
      if (maximizingPlayer) {
        bestValue = -Infinity;
        
        for (const move of moves) {
          const newState = this.applyMoveToState(gameState, move);
          const value = this.search(newState, depth - 1, alpha, beta, false, aiColor);
          
          bestValue = Math.max(bestValue, value);
          alpha = Math.max(alpha, value);
          
          if (beta <= alpha) {
            this.pruneCount++;
            entryType = 'lowerbound';
            break; // Alpha-beta cutoff
          }
        }
        
        if (bestValue > alpha) entryType = 'exact';
        
      } else {
        bestValue = Infinity;
        
        for (const move of moves) {
          const newState = this.applyMoveToState(gameState, move);
          const value = this.search(newState, depth - 1, alpha, beta, true, aiColor);
          
          bestValue = Math.min(bestValue, value);
          beta = Math.min(beta, value);
          
          if (beta <= alpha) {
            this.pruneCount++;
            entryType = 'lowerbound';
            break; // Alpha-beta cutoff
          }
        }
        
        if (bestValue < beta) entryType = 'exact';
      }
      
      this.storeTransposition(stateHash, bestValue, depth, entryType);
      return bestValue;
      
    } catch (error) {
      console.error('🧠 💥 Minimax search error:', error);
      return this.evaluatePosition(gameState, aiColor);
    }
  },

  /**
   * Find best tactical move using minimax
   */
  findBestTacticalMove: function(gameState, depth = 4) {
    try {
      console.log(`🧠 TACTICAL MINIMAX: Searching ${depth} moves deep...`);
      
      this.reset();
      const startTime = Date.now();
      
      const moves = this.generateOrderedMoves(gameState);
      const aiColor = gameState.currentPlayer;
      
      let bestMove = null;
      let bestValue = -Infinity;
      const moveEvaluations = [];
      
      console.log(`🧠 Evaluating ${moves.length} candidate moves...`);
      
      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const newState = this.applyMoveToState(gameState, move);
        const value = this.search(newState, depth - 1, -Infinity, Infinity, false, aiColor);
        
        moveEvaluations.push({
          move: move,
          value: value,
          description: this.describeMoveForLogging(move)
        });
        
        console.log(`🧠 [${i+1}/${moves.length}] ${this.describeMoveForLogging(move)} = ${value.toFixed(3)}`);
        
        if (value > bestValue) {
          bestValue = value;
          bestMove = move;
        }
      }
      
      const endTime = Date.now();
      const searchTime = endTime - startTime;
      
      console.log(`🧠 ⚡ MINIMAX COMPLETE:`);
      console.log(`🧠   Nodes searched: ${this.nodeCount.toLocaleString()}`);
      console.log(`🧠   Alpha-beta prunes: ${this.pruneCount.toLocaleString()}`);
      console.log(`🧠   Search time: ${searchTime}ms`);
      console.log(`🧠   Nodes/sec: ${Math.round(this.nodeCount / (searchTime / 1000)).toLocaleString()}`);
      
      if (bestMove) {
        console.log(`🧠 🎯 BEST TACTICAL MOVE: ${this.describeMoveForLogging(bestMove)} (value: ${bestValue.toFixed(3)})`);
        
        // Show top 3 moves for analysis
        moveEvaluations.sort((a, b) => b.value - a.value);
        console.log(`🧠 📊 TOP MOVES:`);
        for (let i = 0; i < Math.min(3, moveEvaluations.length); i++) {
          const evaluation = moveEvaluations[i];
          console.log(`🧠   ${i+1}. ${evaluation.description} = ${evaluation.value.toFixed(3)}`);
        }
      }
      
      return { move: bestMove, value: bestValue, searchStats: {
        nodes: this.nodeCount,
        prunes: this.pruneCount,
        time: searchTime
      }};
      
    } catch (error) {
      console.error('🧠 💥 Tactical move search error:', error);
      return { move: null, value: -Infinity };
    }
  },

  /**
   * Generate moves ordered by strategic value for better alpha-beta pruning
   */
  generateOrderedMoves: function(gameState) {
    try {
      const moves = window.AIEngine.generateLegalMoves(gameState);
      
      // Score each move for ordering
      const scoredMoves = moves.map(move => ({
        move: move,
        score: this.getMovePriorityScore(move, gameState)
      }));
      
      // Sort by score (highest first for better pruning)
      scoredMoves.sort((a, b) => b.score - a.score);
      
      return scoredMoves.map(sm => sm.move);
    } catch (error) {
      console.error('🧠 Error generating ordered moves:', error);
      return [];
    }
  },

  /**
   * Get priority score for move ordering (for alpha-beta efficiency)
   */
  getMovePriorityScore: function(move, gameState) {
    try {
      let score = 0;
      
      if (!move.piece || !move.piece.meta) return score;
      
      const aiColor = gameState.currentPlayer;
      const oppColor = aiColor === 'white' ? 'black' : 'white';
      
      // Prioritize Queen moves
      if (move.piece.meta.key === 'Q') {
        score += 1000;
      }
      
      // Prioritize moves that threaten opponent Queen
      const oppQueen = gameState.tray.find(p => 
        p && p.placed && p.meta && p.meta.color === oppColor && p.meta.key === 'Q'
      );
      
      if (oppQueen && move.type === 'move') {
        const distToOppQueen = Math.abs(move.q - oppQueen.meta.q) + Math.abs(move.r - oppQueen.meta.r);
        if (distToOppQueen <= 2) {
          score += 500 - distToOppQueen * 50;
        }
      }
      
      // Prioritize moves that defend our Queen
      const ourQueen = gameState.tray.find(p => 
        p && p.placed && p.meta && p.meta.color === aiColor && p.meta.key === 'Q'
      );
      
      if (ourQueen && move.type === 'move') {
        const distToOurQueen = Math.abs(move.q - ourQueen.meta.q) + Math.abs(move.r - ourQueen.meta.r);
        if (distToOurQueen <= 2) {
          score += 200 - distToOurQueen * 20;
        }
      }
      
      // Prioritize Beetle moves (can climb and threaten)
      if (move.piece.meta.key === 'B') {
        score += 100;
      }
      
      // Prioritize central moves
      const distFromCenter = Math.abs(move.q) + Math.abs(move.r);
      score += Math.max(0, 50 - distFromCenter * 5);
      
      return score;
    } catch (error) {
      console.error('🧠 Error calculating move priority:', error);
      return 0;
    }
  },

  /**
   * Evaluate position from AI perspective (positive = good for AI)
   */
  evaluatePosition: function(gameState, aiColor) {
    try {
      // Use the existing AI engine's evaluation but adjust for minimax perspective
      const evaluation = window.AIEngine.evaluatePosition(gameState);
      
      // The evaluation needs to be from the current player's perspective
      // If it's the AI's turn, positive is good. If opponent's turn, we flip it.
      const currentPlayer = gameState.currentPlayer;
      const multiplier = (currentPlayer === aiColor) ? 1 : -1;
      
      return evaluation * multiplier;
    } catch (error) {
      console.error('🧠 Error evaluating position:', error);
      return 0;
    }
  },

  /**
   * Evaluate terminal (game over) positions
   */
  evaluateTerminalPosition: function(gameState, aiColor) {
    try {
      const winner = this.getGameWinner(gameState);
      
      if (winner === aiColor) {
        return 10000; // AI wins
      } else if (winner && winner !== aiColor) {
        return -10000; // AI loses
      } else {
        return 0; // Draw
      }
    } catch (error) {
      console.error('🧠 Error evaluating terminal position:', error);
      return 0;
    }
  },

  /**
   * Check if game is over
   */
  isGameOver: function(gameState) {
    try {
      return this.getGameWinner(gameState) !== null;
    } catch (error) {
      console.error('🧠 Error checking game over:', error);
      return false;
    }
  },

  /**
   * Get game winner (null if game continues)
   */
  getGameWinner: function(gameState) {
    try {
      // Check if any Queen is surrounded
      for (const piece of gameState.tray) {
        if (piece && piece.placed && piece.meta && piece.meta.key === 'Q') {
          const threats = this.countAdjacentOpponents(piece, gameState);
          if (threats >= 6) {
            // This Queen is surrounded - opponent wins
            return piece.meta.color === 'white' ? 'black' : 'white';
          }
        }
      }
      
      return null; // Game continues
    } catch (error) {
      console.error('🧠 Error getting game winner:', error);
      return null;
    }
  },

  /**
   * Count adjacent opponent pieces around a piece
   */
  countAdjacentOpponents: function(piece, gameState) {
    try {
      if (!piece || !piece.meta) return 0;
      
      const adjacentPositions = [
        [piece.meta.q + 1, piece.meta.r],
        [piece.meta.q - 1, piece.meta.r],
        [piece.meta.q, piece.meta.r + 1],
        [piece.meta.q, piece.meta.r - 1],
        [piece.meta.q + 1, piece.meta.r - 1],
        [piece.meta.q - 1, piece.meta.r + 1]
      ];
      
      let opponentCount = 0;
      const pieceColor = piece.meta.color;
      
      for (const [q, r] of adjacentPositions) {
        const cellKey = `${q},${r}`;
        const cell = window.cells?.get(cellKey);
        
        if (cell && cell.stack && cell.stack.length > 0) {
          const topPiece = cell.stack[cell.stack.length - 1];
          if (topPiece && topPiece.meta && topPiece.meta.color !== pieceColor) {
            opponentCount++;
          }
        }
      }
      
      return opponentCount;
    } catch (error) {
      console.error('🧠 Error counting adjacent opponents:', error);
      return 0;
    }
  },

  /**
   * Apply move to game state (creates new state)
   */
  applyMoveToState: function(gameState, move) {
    try {
      // Create deep copy of game state
      const newState = JSON.parse(JSON.stringify(gameState));
      newState.tray = gameState.tray.map(p => ({...p})); // Shallow copy pieces
      
      if (move.type === 'place') {
        // Find the piece in the new state
        const piece = newState.tray.find(p => 
          p.meta.key === move.piece.meta.key && 
          p.meta.color === move.piece.meta.color && 
          !p.meta.placed
        );
        
        if (piece) {
          piece.meta.placed = true;
          piece.meta.q = move.q;
          piece.meta.r = move.r;
        }
      } else if (move.type === 'move') {
        // Find the piece in the new state
        const piece = newState.tray.find(p => 
          p.meta.q === move.piece.meta.q && 
          p.meta.r === move.piece.meta.r &&
          p.meta.key === move.piece.meta.key &&
          p.meta.color === move.piece.meta.color
        );
        
        if (piece) {
          piece.meta.q = move.q;
          piece.meta.r = move.r;
        }
      }
      
      // Switch current player
      newState.currentPlayer = newState.currentPlayer === 'white' ? 'black' : 'white';
      
      return newState;
    } catch (error) {
      console.error('🧠 Error applying move to state:', error);
      return gameState;
    }
  },

  /**
   * Pass turn (for positions with no legal moves)
   */
  passTurn: function(gameState) {
    try {
      const newState = JSON.parse(JSON.stringify(gameState));
      newState.currentPlayer = newState.currentPlayer === 'white' ? 'black' : 'white';
      return newState;
    } catch (error) {
      console.error('🧠 Error passing turn:', error);
      return gameState;
    }
  },

  /**
   * Generate hash for transposition table
   */
  hashGameState: function(gameState) {
    try {
      // Simple hash based on piece positions and current player
      let hash = gameState.currentPlayer === 'white' ? 'W' : 'B';
      
      const pieces = gameState.tray.filter(p => p && p.placed && p.meta);
      pieces.sort((a, b) => {
        if (a.meta.q !== b.meta.q) return a.meta.q - b.meta.q;
        if (a.meta.r !== b.meta.r) return a.meta.r - b.meta.r;
        if (a.meta.color !== b.meta.color) return a.meta.color.localeCompare(b.meta.color);
        return a.meta.key.localeCompare(b.meta.key);
      });
      
      for (const piece of pieces) {
        hash += `${piece.meta.color[0]}${piece.meta.key}${piece.meta.q},${piece.meta.r};`;
      }
      
      return hash;
    } catch (error) {
      console.error('🧠 Error hashing game state:', error);
      return 'error';
    }
  },

  /**
   * Store result in transposition table
   */
  storeTransposition: function(hash, value, depth, type) {
    try {
      // Limit table size
      if (this.transpositionTable.size >= this.maxTableSize) {
        // Remove oldest entries (simple FIFO)
        const firstKey = this.transpositionTable.keys().next().value;
        this.transpositionTable.delete(firstKey);
      }
      
      this.transpositionTable.set(hash, {
        value: value,
        depth: depth,
        type: type
      });
    } catch (error) {
      console.error('🧠 Error storing transposition:', error);
    }
  },

  /**
   * Create readable description of move for logging
   */
  describeMoveForLogging: function(move) {
    try {
      if (!move || !move.piece) return 'Unknown move';
      
      const piece = move.piece;
      const pieceDesc = `${piece.meta.color} ${piece.meta.key}`;
      
      if (move.type === 'place') {
        return `Place ${pieceDesc} at (${move.q},${move.r})`;
      } else if (move.type === 'move') {
        return `Move ${pieceDesc} from (${piece.meta.q},${piece.meta.r}) to (${move.q},${move.r})`;
      }
      
      return `${move.type} ${pieceDesc}`;
    } catch (error) {
      console.error('🧠 Error describing move:', error);
      return 'Error describing move';
    }
  }
};