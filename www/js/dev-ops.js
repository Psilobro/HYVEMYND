/**
 * Development Operations System
 * Provides AI vs AI battles, Human Learning mode, and comprehensive statistics
 */

class DevOpsSystem {
    constructor() {
        this.isInitialized = false;
        this.currentBattle = null;
        this.learningSession = null;
        this.statistics = {
            totalBattles: 0,
            learningGames: 0,
            aiWinRates: {
                sunny: { wins: 0, games: 0 },
                buzzwell: { wins: 0, games: 0 },
                beedric: { wins: 0, games: 0 }
            },
            humanLearningData: [],
            battleHistory: []
        };
        
        this.loadStatistics();
        this.init();
    }
    
    init() {
        if (this.isInitialized) return;
        
        // Setup event listeners
        this.setupEventListeners();
        this.updateStatisticsDisplay();
        
        this.isInitialized = true;
        console.log('Dev Ops System initialized');
    }
    
    setupEventListeners() {
        // Dev Ops button
        const devOpsBtn = document.getElementById('dev-ops-button');
        if (devOpsBtn) {
            devOpsBtn.addEventListener('click', () => this.showModal());
        }
        
        // Modal close
        const closeBtn = document.getElementById('dev-ops-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideModal());
        }
        
        // Tab switching
        document.querySelectorAll('.dev-ops-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // AI vs AI controls
        const startBattleBtn = document.getElementById('start-ai-battle');
        if (startBattleBtn) {
            startBattleBtn.addEventListener('click', () => this.startAIBattle());
        }
        
        const stopBattleBtn = document.getElementById('stop-ai-battle');
        if (stopBattleBtn) {
            stopBattleBtn.addEventListener('click', () => this.stopAIBattle());
        }
        
        // Battle speed control
        const speedSlider = document.getElementById('battle-speed');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => this.updateBattleSpeed(e.target.value));
        }
        
        // Human Learning controls
        const startLearningBtn = document.getElementById('start-learning-game');
        if (startLearningBtn) {
            startLearningBtn.addEventListener('click', () => this.startLearningGame());
        }
        
        // Close modal when clicking outside
        const modal = document.getElementById('dev-ops-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModal();
            });
        }
    }
    
    showModal() {
        const modal = document.getElementById('dev-ops-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.updateStatisticsDisplay();
        }
    }
    
    hideModal() {
        const modal = document.getElementById('dev-ops-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    switchTab(tabName) {
        // Hide all panels
        document.querySelectorAll('.dev-ops-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Remove active from all tabs
        document.querySelectorAll('.dev-ops-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Show selected panel and activate tab
        const panel = document.getElementById(`${tabName}-panel`);
        const tab = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (panel) panel.classList.add('active');
        if (tab) tab.classList.add('active');
    }
    
    async startAIBattle() {
        const whiteAI = document.getElementById('white-ai-select').value;
        const blackAI = document.getElementById('black-ai-select').value;
        
        if (whiteAI === blackAI) {
            this.updateBattleStatus('⚠️ Please select different AIs for each player');
            return;
        }
        
        // Disable start button, enable stop button
        document.getElementById('start-ai-battle').style.display = 'none';
        document.getElementById('stop-ai-battle').style.display = 'inline-block';
        
        this.updateBattleStatus(`🚀 Starting battle: ${whiteAI} vs ${blackAI}`);
        
        // Initialize battle
        this.currentBattle = {
            whiteAI,
            blackAI,
            moveCount: 0,
            startTime: Date.now(),
            active: true
        };
        
        // Reset game state for AI battle
        this.resetGameForBattle();
        
        // Start the AI battle loop
        this.runAIBattleLoop();
        
        // Hide the modal so user can watch the battle
        this.hideModal();
        
        // Show battle status in the main HUD
        this.showBattleStatus(`🚀 AI Battle: ${whiteAI} vs ${blackAI} - Move 1`);
        
        // Show floating battle controls
        this.showBattleControls();
    }
    
    stopAIBattle() {
        if (this.currentBattle) {
            this.currentBattle.active = false;
            this.currentBattle = null;
        }
        
        // Reset button states
        document.getElementById('start-ai-battle').style.display = 'inline-block';
        document.getElementById('stop-ai-battle').style.display = 'none';
        
        this.updateBattleStatus('⏹️ Battle stopped');
        this.hideBattleStatus();
        this.hideBattleControls();
    }
    
    async runAIBattleLoop() {
        if (!this.currentBattle || !this.currentBattle.active) return;
        
        // Check if game is over
        if (window.state && window.state.gameOver) {
            this.finishAIBattle();
            return;
        }
        
        // Get current player's AI
        const currentAI = window.state.current === 'white' 
            ? this.currentBattle.whiteAI 
            : this.currentBattle.blackAI;
        
        const aiDisplayName = currentAI.charAt(0).toUpperCase() + currentAI.slice(1);
        const battleStatus = `🤖 ${aiDisplayName} thinking... (Move ${this.currentBattle.moveCount + 1})`;
        
        this.updateBattleStatus(battleStatus);
        this.showBattleStatus(`🚀 Battle: ${this.currentBattle.whiteAI} vs ${this.currentBattle.blackAI} - ${aiDisplayName} thinking (Move ${this.currentBattle.moveCount + 1})`);
        
        // Get battle speed (convert to milliseconds)
        const speed = parseInt(document.getElementById('battle-speed').value);
        
        // Wait for the specified speed delay
        setTimeout(async () => {
            if (!this.currentBattle || !this.currentBattle.active) return;
            
            try {
                // Make AI move
                await this.makeAIMove(currentAI);
                this.currentBattle.moveCount++;
                
                // Continue battle loop
                setTimeout(() => this.runAIBattleLoop(), 100);
            } catch (error) {
                console.error('Error in AI battle:', error);
                this.updateBattleStatus('❌ Error in AI battle');
                this.stopAIBattle();
            }
        }, speed);
    }
    
    async makeAIMove(aiName) {
        // Map AI names to difficulty levels
        const difficultyMap = {
            'sunny': 'easy',
            'buzzwell': 'medium', 
            'beedric': 'hard'
        };
        
        const difficulty = difficultyMap[aiName] || 'medium';
        
        try {
            // Enable AI and set difficulty
            if (window.AIEngine) {
                const previousEnabled = window.AIEngine.enabled;
                const previousDifficulty = window.AIEngine.difficulty;
                const previousColor = window.AIEngine.color;
                
                window.AIEngine.enabled = true;
                window.AIEngine.difficulty = difficulty;
                window.AIEngine.color = window.state.current; // AI plays current player
                
                // Set personality for voice lines
                if (window.Personalities && window.Personalities.setOpponent) {
                    window.Personalities.setOpponent(difficulty);
                }
                
                // Trigger AI move
                if (window.AIEngine.checkAndMakeMove) {
                    // Add error handling for AI moves
                    const originalExecuteMove = window.AIEngine.executeMove;
                    window.AIEngine.executeMove = function(move) {
                        try {
                            return originalExecuteMove.call(this, move);
                        } catch (error) {
                            console.error('🔧 AI move execution error:', error);
                            // Try to recover by expanding board if it's a cell issue
                            if (error.message.includes('stack') && move.type === 'place') {
                                console.log('🔧 Attempting to expand board for AI move');
                                if (window.expandBoard) {
                                    window.expandBoard();
                                    // Retry the move
                                    return originalExecuteMove.call(this, move);
                                }
                            }
                            throw error;
                        }
                    };
                    
                    window.AIEngine.checkAndMakeMove();
                    
                    // Restore original function
                    window.AIEngine.executeMove = originalExecuteMove;
                } else {
                    throw new Error('AI move function not available');
                }
                
                // Wait for AI to make its move
                return new Promise((resolve, reject) => {
                    let attempts = 0;
                    const maxAttempts = 100; // 10 seconds max wait
                    
                    const checkMove = () => {
                        attempts++;
                        
                        if (!window.AIEngine.thinking && !window.animating) {
                            // Restore previous AI settings for battles
                            if (this.currentBattle) {
                                window.AIEngine.enabled = true; // Keep enabled for battle
                            } else {
                                window.AIEngine.enabled = previousEnabled;
                                window.AIEngine.difficulty = previousDifficulty;
                                window.AIEngine.color = previousColor;
                            }
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            reject(new Error(`AI move timeout for ${aiName}`));
                        } else {
                            setTimeout(checkMove, 100);
                        }
                    };
                    
                    setTimeout(checkMove, 100);
                });
            } else {
                throw new Error('AI Engine not available');
            }
        } catch (error) {
            console.error(`Error making AI move for ${aiName}:`, error);
            this.updateBattleStatus(`❌ Error: ${error.message}`);
            throw error;
        }
    }
    
    resetGameForBattle() {
        // Clear game state
        if (window.state) {
            window.state.current = 'white';
            window.state.gameOver = false;
            window.state.winner = null;
            window.state.moveIndex = 0;
            window.state.queenPlaced = { white: false, black: false };
        }
        
        // Clear board - but don't clear the cells Map, just empty the stacks
        if (window.cells) {
            window.cells.forEach(cell => {
                if (cell.stack) {
                    // Remove pieces from board graphics but keep cell structure
                    cell.stack.forEach(piece => {
                        if (piece.gfx && window.pieceLayer && window.pieceLayer.children.includes(piece.gfx)) {
                            window.pieceLayer.removeChild(piece.gfx);
                        }
                    });
                    cell.stack.length = 0;
                }
            });
        }
        
        // Ensure the board exists (should already exist, but just in case)
        this.ensureGameBoard();
        
        // Reset pieces
        if (window.tray) {
            window.tray.forEach(piece => {
                piece.placed = false;
                piece.q = undefined;
                piece.r = undefined;
                
                // Reset piece position on tray
                if (piece.gfx) {
                    piece.gfx.visible = true;
                    // Remove from board layer if present
                    if (window.pieceLayer && window.pieceLayer.children.includes(piece.gfx)) {
                        window.pieceLayer.removeChild(piece.gfx);
                    }
                }
            });
        }
        
        // Clear selected state
        if (window.selected) {
            window.selected = null;
        }
        
        // Clear legal zones
        if (window.legalZones) {
            if (window.legalZones instanceof Set) {
                window.legalZones.clear();
            } else if (Array.isArray(window.legalZones)) {
                window.legalZones.length = 0;
            }
        }
        
        // Reset animating flag
        window.animating = false;
        
        // Disable AI for reset
        if (window.AIEngine) {
            window.AIEngine.enabled = false;
            window.AIEngine.thinking = false;
        }
        
        // Update UI
        if (window.updateHUD) {
            window.updateHUD();
        }
        
        // Relayout trays if function exists
        if (window.layoutTrays) {
            window.layoutTrays();
        }
        
        console.log('🔄 Game reset for battle - cells available:', window.cells ? window.cells.size : 'none');
    }
    
    ensureGameBoard() {
        // Ensure basic board exists for AI moves
        if (!window.cells || !window.expandBoard) {
            console.warn('🔧 Game board functions not available');
            return;
        }
        
        // Check if center cell exists
        if (!window.cells.has('0,0')) {
            console.log('🔧 Expanding board to ensure center cell exists');
            try {
                // Use the game's own expand function to create proper cells
                window.expandBoard();
                console.log('🔧 Board expanded successfully');
            } catch (error) {
                console.error('🔧 Failed to expand board:', error);
            }
        }
        
        // Verify essential cells exist
        const essentialKeys = ['0,0', '1,0', '-1,0', '0,1', '0,-1'];
        let missingCells = essentialKeys.filter(key => !window.cells.has(key));
        
        if (missingCells.length > 0) {
            console.log(`🔧 Missing cells: ${missingCells.join(', ')}, expanding board again`);
            try {
                window.expandBoard();
            } catch (error) {
                console.error('🔧 Second expand attempt failed:', error);
            }
        }
    }
    
    finishAIBattle() {
        if (!this.currentBattle) return;
        
        const battle = this.currentBattle;
        const winner = window.state.winner;
        const duration = Date.now() - battle.startTime;
        
        // Record battle results
        this.recordBattleResult({
            whiteAI: battle.whiteAI,
            blackAI: battle.blackAI,
            winner,
            moves: battle.moveCount,
            duration,
            timestamp: Date.now()
        });
        
        // Update statistics
        this.statistics.totalBattles++;
        if (winner) {
            const winnerAI = winner === 'white' ? battle.whiteAI : battle.blackAI;
            this.statistics.aiWinRates[winnerAI].wins++;
        }
        this.statistics.aiWinRates[battle.whiteAI].games++;
        this.statistics.aiWinRates[battle.blackAI].games++;
        
        this.saveStatistics();
        this.updateStatisticsDisplay();
        
        // Update battle status
        const finalStatus = `🏆 Battle finished! Winner: ${winner || 'Draw'} (${battle.moveCount} moves, ${(duration/1000).toFixed(1)}s)`;
        this.updateBattleStatus(finalStatus);
        this.showBattleStatus(finalStatus);
        
        // Reset button states
        document.getElementById('start-ai-battle').style.display = 'inline-block';
        document.getElementById('stop-ai-battle').style.display = 'none';
        
        this.currentBattle = null;
        
        // Hide floating controls
        this.hideBattleControls();
    }
    
    recordBattleResult(result) {
        this.statistics.battleHistory.push(result);
        
        // Keep only last 100 battles to prevent excessive storage
        if (this.statistics.battleHistory.length > 100) {
            this.statistics.battleHistory = this.statistics.battleHistory.slice(-100);
        }
    }
    
    startLearningGame() {
        const opponent = document.getElementById('learning-opponent-select').value;
        
        this.updateLearningStatus(`🎓 Starting learning game vs ${opponent}`);
        
        // Reset game for learning session
        this.resetGameForBattle();
        
        // Initialize learning session
        this.learningSession = {
            opponent,
            startTime: Date.now(),
            humanMoves: [],
            aiMoves: [],
            active: true
        };
        
        // Enable AI for learning mode
        if (window.AIEngine) {
            window.AIEngine.enabled = true;
            window.AIEngine.difficulty = 'hard'; // Beedric difficulty
            window.AIEngine.color = 'black'; // AI plays black in learning mode
        }
        
        // Set personality for voice lines
        if (window.Personalities && window.Personalities.setOpponent) {
            window.Personalities.setOpponent('hard');
        }
        
        // Hide modal to play the game
        this.hideModal();
        
        // Setup learning monitoring
        this.setupLearningMonitoring();
        
        // Show learning status overlay
        this.showLearningStatusOverlay(`🎓 Learning vs ${opponent.charAt(0).toUpperCase() + opponent.slice(1)} - Your move (White)`);
        
        // Trigger initial turn check after setup
        setTimeout(() => {
            this.handleLearningTurn();
        }, 1000);
    }
    
    setupLearningMonitoring() {
        if (!this.learningSession) return;
        
        // Monitor game state changes for learning
        const originalUpdateHUD = window.updateHUD;
        if (originalUpdateHUD) {
            // Store the original function for restoration
            window.originalUpdateHUD = originalUpdateHUD;
            
            window.updateHUD = () => {
                originalUpdateHUD();
                this.recordLearningData();
                this.handleLearningTurn();
            };
        }
        
        // Monitor when game ends
        const checkGameEnd = () => {
            if (window.state && window.state.gameOver && this.learningSession && this.learningSession.active) {
                this.finishLearningGame();
            } else if (this.learningSession && this.learningSession.active) {
                setTimeout(checkGameEnd, 1000);
            }
        };
        setTimeout(checkGameEnd, 1000);
    }
    
    handleLearningTurn() {
        if (!this.learningSession || !this.learningSession.active) return;
        if (!window.state || window.state.gameOver) return;
        
        const currentPlayer = window.state.current;
        
        if (currentPlayer === 'white') {
            // Human's turn
            this.showLearningStatusOverlay(`🎓 Learning vs ${this.learningSession.opponent.charAt(0).toUpperCase() + this.learningSession.opponent.slice(1)} - Your move (White)`);
        } else if (currentPlayer === 'black') {
            // AI's turn
            this.showLearningStatusOverlay(`🤖 ${this.learningSession.opponent.charAt(0).toUpperCase() + this.learningSession.opponent.slice(1)} thinking...`);
            
            // Trigger AI move after a short delay
            setTimeout(() => {
                if (window.AIEngine && window.AIEngine.enabled && window.state.current === 'black') {
                    try {
                        window.AIEngine.checkAndMakeMove();
                    } catch (error) {
                        console.error('🎓 Error in AI learning move:', error);
                    }
                }
            }, 500);
        }
    }
    
    recordLearningData() {
        if (!this.learningSession || !this.learningSession.active) return;
        if (!window.state || !window.cells) return;
        
        // Record current game state for learning analysis
        const gameSnapshot = {
            turn: window.state.current,
            moveCount: window.state.moveIndex || 0,
            queenPlaced: window.state.queenPlaced ? {...window.state.queenPlaced} : {},
            boardState: this.captureBoardState(),
            timestamp: Date.now()
        };
        
        // Store in learning session
        if (window.state.current === 'white') {
            // This was a human move
            this.learningSession.humanMoves.push(gameSnapshot);
        } else {
            // This was an AI move  
            this.learningSession.aiMoves.push(gameSnapshot);
        }
    }
    
    captureBoardState() {
        const boardState = {};
        if (window.cells) {
            window.cells.forEach((cell, key) => {
                if (cell.stack && cell.stack.length > 0) {
                    boardState[key] = {
                        pieces: cell.stack.map(piece => ({
                            key: piece.meta.key,
                            color: piece.meta.color
                        }))
                    };
                }
            });
        }
        return boardState;
    }
    
    finishLearningGame() {
        if (!this.learningSession) return;
        
        const session = this.learningSession;
        const winner = window.state.winner;
        const duration = Date.now() - session.startTime;
        
        // Analyze the learning data
        const learningAnalysis = this.analyzeLearningData(session);
        
        // Record learning game
        this.statistics.learningGames++;
        this.statistics.humanLearningData.push({
            opponent: session.opponent,
            winner,
            humanMoves: session.humanMoves.length,
            aiMoves: session.aiMoves.length,
            duration,
            analysis: learningAnalysis,
            timestamp: Date.now()
        });
        
        // Update statistics
        this.saveStatistics();
        this.updateStatisticsDisplay();
        
        // Show learning results
        this.showLearningResults(learningAnalysis, winner);
        
        // Reset learning session
        this.learningSession = null;
        
        // Hide learning status overlay
        this.hideLearningStatusOverlay();
        
        // Disable AI after learning session
        if (window.AIEngine) {
            window.AIEngine.enabled = false;
            window.AIEngine.thinking = false;
        }
        
        // Restore original updateHUD
        if (window.originalUpdateHUD) {
            window.updateHUD = window.originalUpdateHUD;
        }
    }
    
    analyzeLearningData(session) {
        const analysis = {
            humanPatterns: [],
            aiCounterStrategies: [],
            commonMistakes: [],
            improvements: [],
            strategicInsights: []
        };
        
        // Analyze human move patterns
        session.humanMoves.forEach((move, index) => {
            // Pattern analysis - opening moves
            if (index < 3) {
                analysis.humanPatterns.push({
                    type: 'opening',
                    pattern: this.classifyMove(move),
                    effectiveness: this.evaluateOpeningMove(move)
                });
            }
            
            // Mid-game tactical analysis
            if (index >= 3 && index < session.humanMoves.length - 3) {
                const tactical = this.analyzeTacticalMove(move, session.humanMoves[index - 1]);
                if (tactical) {
                    analysis.humanPatterns.push(tactical);
                }
            }
        });
        
        // Analyze AI responses
        session.aiMoves.forEach((move, index) => {
            if (index < session.humanMoves.length) {
                const humanMove = session.humanMoves[index];
                const counterStrategy = this.analyzeCounterStrategy(humanMove, move);
                if (counterStrategy) {
                    analysis.aiCounterStrategies.push(counterStrategy);
                }
            }
        });
        
        // Generate improvement suggestions
        analysis.improvements = this.generateImprovementSuggestions(session);
        
        return analysis;
    }
    
    classifyMove(moveData) {
        // Classify the type of move (aggressive, defensive, development, etc.)
        // This is a simplified classification - can be enhanced
        if (!moveData.boardState) return 'unknown';
        
        const pieceCount = Object.keys(moveData.boardState).length;
        
        if (pieceCount <= 2) return 'opening-development';
        if (pieceCount <= 6) return 'early-game';
        if (pieceCount <= 12) return 'mid-game';
        return 'end-game';
    }
    
    evaluateOpeningMove(moveData) {
        // Evaluate how good an opening move was
        // Return score from 1-10
        const pieceCount = Object.keys(moveData.boardState || {}).length;
        
        // Simple evaluation - prefer development over aggression early
        if (pieceCount <= 2) return 8; // Good development
        if (pieceCount <= 4) return 6; // Okay
        return 4; // Possibly too aggressive
    }
    
    analyzeTacticalMove(currentMove, previousMove) {
        // Analyze tactical aspects of the move
        if (!currentMove.boardState || !previousMove.boardState) return null;
        
        const currentPieces = Object.keys(currentMove.boardState).length;
        const previousPieces = Object.keys(previousMove.boardState).length;
        
        if (currentPieces > previousPieces) {
            return {
                type: 'tactical',
                pattern: 'piece-placement',
                aggressiveness: currentPieces - previousPieces
            };
        }
        
        return {
            type: 'tactical', 
            pattern: 'piece-movement',
            complexity: Math.abs(currentPieces - previousPieces)
        };
    }
    
    analyzeCounterStrategy(humanMove, aiMove) {
        // Analyze how AI responded to human move
        if (!humanMove.boardState || !aiMove.boardState) return null;
        
        return {
            humanMoveType: this.classifyMove(humanMove),
            aiResponse: this.classifyMove(aiMove),
            effectiveness: Math.random() * 10 // Placeholder - can be enhanced
        };
    }
    
    generateImprovementSuggestions(session) {
        const suggestions = [];
        
        // Analyze game length
        if (session.humanMoves.length > 20) {
            suggestions.push('Consider more aggressive opening play to shorten games');
        }
        
        // Analyze patterns
        const openingMoves = session.humanMoves.slice(0, 3);
        if (openingMoves.length > 0) {
            suggestions.push('Focus on queen placement and protection in opening');
        }
        
        // Add more suggestions based on analysis
        suggestions.push('Practice piece coordination and hive connectivity');
        
        return suggestions;
    }
    
    showLearningResults(analysis, winner) {
        // Show learning results in a notification or modal
        const message = `Learning Session Complete!\n\nWinner: ${winner || 'Draw'}\nPatterns Analyzed: ${analysis.humanPatterns.length}\nImprovements Identified: ${analysis.improvements.length}`;
        
        // For now, use console log - can be enhanced with UI modal later
        console.log('🎓 Learning Results:', message);
        console.log('📊 Analysis:', analysis);
        
        // Update learning status
        this.updateLearningStatus(`✅ Learning complete! Winner: ${winner || 'Draw'} - ${analysis.improvements.length} improvements identified`);
    }
    
    showBattleStatus(message) {
        // Create or update battle status overlay on main game
        let statusOverlay = document.getElementById('battle-status-overlay');
        
        if (!statusOverlay) {
            statusOverlay = document.createElement('div');
            statusOverlay.id = 'battle-status-overlay';
            statusOverlay.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(138, 43, 226, 0.95);
                color: white;
                padding: 12px 24px;
                border-radius: 25px;
                font-family: 'Milonga', serif;
                font-size: 14px;
                font-weight: bold;
                z-index: 1500;
                border: 2px solid #8A2BE2;
                box-shadow: 0 4px 20px rgba(138, 43, 226, 0.4);
                backdrop-filter: blur(10px);
                display: none;
                transition: all 0.3s ease;
                cursor: pointer;
            `;
            
            // Make it clickable to return to Dev Ops
            statusOverlay.addEventListener('click', () => {
                this.showModal();
                this.switchTab('ai-vs-ai');
            });
            
            statusOverlay.title = 'Click to return to Dev Ops controls';
            document.body.appendChild(statusOverlay);
        }
        
        statusOverlay.textContent = message;
        statusOverlay.style.display = 'block';
        
        // Auto-fade after some time if it's a completion message
        if (message.includes('finished') || message.includes('complete')) {
            setTimeout(() => {
                if (statusOverlay) {
                    statusOverlay.style.opacity = '0.7';
                    setTimeout(() => {
                        statusOverlay.style.display = 'none';
                        statusOverlay.style.opacity = '1';
                    }, 5000);
                }
            }, 3000);
        }
    }
    
    hideBattleStatus() {
        const statusOverlay = document.getElementById('battle-status-overlay');
        if (statusOverlay) {
            statusOverlay.style.display = 'none';
        }
    }
    
    showBattleControls() {
        // Create floating battle controls
        let battleControls = document.getElementById('floating-battle-controls');
        
        if (!battleControls) {
            battleControls = document.createElement('div');
            battleControls.id = 'floating-battle-controls';
            battleControls.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: rgba(15, 15, 15, 0.95);
                border: 2px solid #8A2BE2;
                border-radius: 12px;
                padding: 15px;
                z-index: 1500;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(138, 43, 226, 0.3);
                display: none;
                font-family: 'Milonga', serif;
                color: white;
                min-width: 200px;
            `;
            
            battleControls.innerHTML = `
                <div style="margin-bottom: 10px; font-size: 12px; color: #8A2BE2; font-weight: bold;">Battle Controls</div>
                <button id="floating-stop-battle" style="
                    background: #ff4757;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-family: 'Milonga', serif;
                    font-size: 12px;
                    cursor: pointer;
                    margin-bottom: 10px;
                    width: 100%;
                ">⏹️ Stop Battle</button>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
                    <span>Speed:</span>
                    <input type="range" id="floating-speed-slider" min="100" max="3000" value="1000" step="100" 
                           style="flex: 1; accent-color: #8A2BE2;">
                    <span id="floating-speed-display">1.0s</span>
                </div>
            `;
            
            document.body.appendChild(battleControls);
            
            // Wire up controls
            const stopButton = battleControls.querySelector('#floating-stop-battle');
            const speedSlider = battleControls.querySelector('#floating-speed-slider');
            const speedDisplay = battleControls.querySelector('#floating-speed-display');
            
            stopButton.addEventListener('click', () => {
                this.stopAIBattle();
                this.hideBattleControls();
            });
            
            speedSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                speedDisplay.textContent = `${(value/1000).toFixed(1)}s`;
                
                // Update main speed slider too
                const mainSpeedSlider = document.getElementById('battle-speed');
                if (mainSpeedSlider) {
                    mainSpeedSlider.value = value;
                    this.updateBattleSpeed(value);
                }
            });
        }
        
        battleControls.style.display = 'block';
    }
    
    hideBattleControls() {
        const battleControls = document.getElementById('floating-battle-controls');
        if (battleControls) {
            battleControls.style.display = 'none';
        }
    }
    
    showLearningStatusOverlay(message) {
        // Create or update learning status overlay
        let statusOverlay = document.getElementById('learning-status-overlay');
        
        if (!statusOverlay) {
            statusOverlay = document.createElement('div');
            statusOverlay.id = 'learning-status-overlay';
            statusOverlay.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(61, 220, 132, 0.95);
                color: white;
                padding: 12px 24px;
                border-radius: 25px;
                font-family: 'Milonga', serif;
                font-size: 14px;
                font-weight: bold;
                z-index: 1500;
                border: 2px solid #3ddc84;
                box-shadow: 0 4px 20px rgba(61, 220, 132, 0.4);
                backdrop-filter: blur(10px);
                display: none;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(statusOverlay);
        }
        
        statusOverlay.textContent = message;
        statusOverlay.style.display = 'block';
    }
    
    hideLearningStatusOverlay() {
        const statusOverlay = document.getElementById('learning-status-overlay');
        if (statusOverlay) {
            statusOverlay.style.display = 'none';
        }
    }
    
    updateBattleSpeed(value) {
        const speedDisplay = document.getElementById('speed-display');
        if (speedDisplay) {
            speedDisplay.textContent = `${(value/1000).toFixed(1)}s`;
        }
    }
    
    updateBattleStatus(message) {
        const status = document.getElementById('battle-status');
        if (status) {
            status.textContent = message;
        }
    }
    
    updateLearningStatus(message) {
        const status = document.getElementById('learning-status');
        if (status) {
            status.textContent = message;
        }
    }
    
    updateStatisticsDisplay() {
        // Total battles
        const totalBattles = document.getElementById('total-battles');
        if (totalBattles) {
            totalBattles.textContent = this.statistics.totalBattles.toString();
        }
        
        // Learning games
        const learningGames = document.getElementById('learning-games');
        if (learningGames) {
            learningGames.textContent = this.statistics.learningGames.toString();
        }
        
        // AI improvement (calculate from recent win rate changes)
        const aiImprovement = document.getElementById('ai-improvement');
        if (aiImprovement) {
            const improvement = this.calculateAIImprovement();
            aiImprovement.textContent = `${improvement >= 0 ? '+' : ''}${improvement}%`;
        }
        
        // Best performer
        const bestAI = document.getElementById('best-ai');
        if (bestAI) {
            const best = this.getBestPerformingAI();
            bestAI.textContent = best.charAt(0).toUpperCase() + best.slice(1);
        }
        
        // Detailed stats
        this.updateDetailedStats();
    }
    
    calculateAIImprovement() {
        // Calculate overall AI improvement based on recent performance
        const recentBattles = this.statistics.battleHistory.slice(-20);
        if (recentBattles.length < 10) return 0;
        
        // Simple improvement calculation - can be enhanced
        const recentWins = recentBattles.filter(b => b.winner).length;
        const improvement = (recentWins / recentBattles.length) * 100 - 50;
        
        return Math.round(improvement);
    }
    
    getBestPerformingAI() {
        let bestAI = 'beedric';
        let bestWinRate = 0;
        
        Object.entries(this.statistics.aiWinRates).forEach(([ai, stats]) => {
            if (stats.games > 0) {
                const winRate = stats.wins / stats.games;
                if (winRate > bestWinRate) {
                    bestWinRate = winRate;
                    bestAI = ai;
                }
            }
        });
        
        return bestAI;
    }
    
    updateDetailedStats() {
        const details = document.getElementById('stats-details');
        if (!details) return;
        
        if (this.statistics.totalBattles === 0 && this.statistics.learningGames === 0) {
            details.innerHTML = '<p>No data available yet. Run some AI battles or learning games to see statistics.</p>';
            return;
        }
        
        let html = '<div class="stats-breakdown">';
        
        // AI Performance Analysis
        if (this.statistics.totalBattles > 0) {
            html += '<h5>🤖 AI Performance Analysis:</h5>';
            Object.entries(this.statistics.aiWinRates).forEach(([ai, stats]) => {
                if (stats.games > 0) {
                    const winRate = ((stats.wins / stats.games) * 100).toFixed(1);
                    const aiName = ai.charAt(0).toUpperCase() + ai.slice(1);
                    const performance = this.getPerformanceRating(parseFloat(winRate));
                    html += `<p><strong>${aiName}:</strong> ${stats.wins}/${stats.games} wins (${winRate}%) - ${performance}</p>`;
                }
            });
            
            // Battle statistics
            const avgBattleLength = this.calculateAverageBattleLength();
            const fastestBattle = this.getFastestBattle();
            html += `<p><strong>Average Battle Length:</strong> ${avgBattleLength.moves} moves, ${avgBattleLength.duration}s</p>`;
            if (fastestBattle) {
                html += `<p><strong>Fastest Victory:</strong> ${fastestBattle.winner} in ${fastestBattle.moves} moves</p>`;
            }
        }
        
        // Learning Analytics
        if (this.statistics.learningGames > 0) {
            html += '<h5>🧠 Learning Analytics:</h5>';
            const learningStats = this.analyzeLearningProgress();
            html += `<p><strong>Human Win Rate vs AI:</strong> ${learningStats.humanWinRate}%</p>`;
            html += `<p><strong>Average Game Length:</strong> ${learningStats.avgMoves} moves</p>`;
            html += `<p><strong>Most Common Opening:</strong> ${learningStats.commonOpening}</p>`;
            html += `<p><strong>Learning Trend:</strong> ${learningStats.trend}</p>`;
        }
        
        // Recent Activity
        const recentBattles = this.statistics.battleHistory.slice(-5);
        const recentLearning = this.statistics.humanLearningData.slice(-3);
        
        if (recentBattles.length > 0 || recentLearning.length > 0) {
            html += '<h5>📈 Recent Activity:</h5>';
            
            // Recent battles
            if (recentBattles.length > 0) {
                html += '<div class="recent-battles"><strong>AI Battles:</strong>';
                recentBattles.reverse().forEach(battle => {
                    const date = new Date(battle.timestamp).toLocaleTimeString();
                    const duration = (battle.duration / 1000).toFixed(1);
                    html += `<p class="recent-item">${date}: ${battle.whiteAI} vs ${battle.blackAI} → ${battle.winner || 'Draw'} (${battle.moves} moves, ${duration}s)</p>`;
                });
                html += '</div>';
            }
            
            // Recent learning games
            if (recentLearning.length > 0) {
                html += '<div class="recent-learning"><strong>Learning Games:</strong>';
                recentLearning.reverse().forEach(game => {
                    const date = new Date(game.timestamp).toLocaleTimeString();
                    const duration = (game.duration / 1000).toFixed(1);
                    html += `<p class="recent-item">${date}: Human vs ${game.opponent} → ${game.winner || 'Draw'} (${game.humanMoves} moves, ${duration}s)</p>`;
                });
                html += '</div>';
            }
        }
        
        // Performance Insights
        html += '<h5>💡 Performance Insights:</h5>';
        const insights = this.generatePerformanceInsights();
        insights.forEach(insight => {
            html += `<p class="insight">• ${insight}</p>`;
        });
        
        html += '</div>';
        details.innerHTML = html;
    }
    
    getPerformanceRating(winRate) {
        if (winRate >= 70) return '🏆 Excellent';
        if (winRate >= 60) return '🥈 Strong';  
        if (winRate >= 50) return '🥉 Good';
        if (winRate >= 40) return '📈 Improving';
        return '🔄 Learning';
    }
    
    calculateAverageBattleLength() {
        if (this.statistics.battleHistory.length === 0) {
            return { moves: 0, duration: 0 };
        }
        
        const totalMoves = this.statistics.battleHistory.reduce((sum, battle) => sum + battle.moves, 0);
        const totalDuration = this.statistics.battleHistory.reduce((sum, battle) => sum + battle.duration, 0);
        
        return {
            moves: Math.round(totalMoves / this.statistics.battleHistory.length),
            duration: Math.round(totalDuration / this.statistics.battleHistory.length / 1000)
        };
    }
    
    getFastestBattle() {
        if (this.statistics.battleHistory.length === 0) return null;
        
        return this.statistics.battleHistory.reduce((fastest, battle) => {
            if (!fastest || battle.moves < fastest.moves) {
                return battle;
            }
            return fastest;
        }, null);
    }
    
    analyzeLearningProgress() {
        const learningData = this.statistics.humanLearningData;
        
        if (learningData.length === 0) {
            return {
                humanWinRate: 0,
                avgMoves: 0,
                commonOpening: 'N/A',
                trend: 'No data'
            };
        }
        
        // Calculate human win rate
        const humanWins = learningData.filter(game => game.winner === 'white').length;
        const humanWinRate = ((humanWins / learningData.length) * 100).toFixed(1);
        
        // Calculate average moves
        const totalMoves = learningData.reduce((sum, game) => sum + game.humanMoves, 0);
        const avgMoves = Math.round(totalMoves / learningData.length);
        
        // Analyze trend (simplified)
        const recentGames = learningData.slice(-5);
        const recentWins = recentGames.filter(game => game.winner === 'white').length;
        const recentWinRate = recentGames.length > 0 ? (recentWins / recentGames.length * 100) : 0;
        
        let trend = 'Stable';
        if (recentWinRate > parseFloat(humanWinRate) + 10) {
            trend = '📈 Improving';
        } else if (recentWinRate < parseFloat(humanWinRate) - 10) {
            trend = '📉 Declining';
        }
        
        return {
            humanWinRate,
            avgMoves,
            commonOpening: 'Queen-first', // Simplified
            trend
        };
    }
    
    generatePerformanceInsights() {
        const insights = [];
        
        // AI Battle insights
        if (this.statistics.totalBattles > 0) {
            const bestAI = this.getBestPerformingAI();
            insights.push(`${bestAI.charAt(0).toUpperCase() + bestAI.slice(1)} is currently the strongest AI`);
            
            if (this.statistics.battleHistory.length >= 10) {
                const avgLength = this.calculateAverageBattleLength();
                if (avgLength.moves > 25) {
                    insights.push('Games are running long - AIs are well-matched');
                } else {
                    insights.push('Quick decisive games - clear AI advantages emerging');
                }
            }
        }
        
        // Learning insights
        if (this.statistics.learningGames > 0) {
            const learningStats = this.analyzeLearningProgress();
            if (parseFloat(learningStats.humanWinRate) > 50) {
                insights.push('Human player is performing well against AI');
            } else if (parseFloat(learningStats.humanWinRate) < 30) {
                insights.push('AI is dominating - consider analyzing patterns for improvement');
            }
            
            if (learningStats.trend.includes('Improving')) {
                insights.push('Human performance is trending upward - learning system is working');
            }
        }
        
        // General insights
        if (this.statistics.totalBattles + this.statistics.learningGames > 20) {
            insights.push('Sufficient data collected for meaningful AI training');
        } else {
            insights.push('More games needed for comprehensive analysis');
        }
        
        return insights.length > 0 ? insights : ['Run more games to generate insights'];
    }
    
    saveStatistics() {
        try {
            localStorage.setItem('devOpsStatistics', JSON.stringify(this.statistics));
        } catch (error) {
            console.error('Failed to save statistics:', error);
        }
    }
    
    loadStatistics() {
        try {
            const saved = localStorage.getItem('devOpsStatistics');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.statistics = { ...this.statistics, ...parsed };
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }
}

// Initialize Dev Ops System when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other systems to initialize
    setTimeout(() => {
        window.devOpsSystem = new DevOpsSystem();
        
        // Hook into existing game systems
        if (window.state && window.updateHUD) {
            // Store original updateHUD for restoration
            window.originalUpdateHUD = window.updateHUD;
            
            // Add integration check to updateHUD
            const originalUpdateHUD = window.updateHUD;
            window.updateHUD = function() {
                originalUpdateHUD();
                
                // Check if Dev Ops system needs to handle anything
                if (window.devOpsSystem) {
                    window.devOpsSystem.handleGameStateChange();
                }
            };
        }
        
        console.log('🔧 Dev Ops System fully integrated');
    }, 1500);
});

// Add method to handle game state changes
DevOpsSystem.prototype.handleGameStateChange = function() {
    // Handle AI battle state changes
    if (this.currentBattle && this.currentBattle.active) {
        // Check if game ended
        if (window.state && window.state.gameOver) {
            setTimeout(() => this.finishAIBattle(), 100);
        }
    }
    
    // Handle learning session monitoring
    if (this.learningSession && this.learningSession.active) {
        this.recordLearningData();
    }
};

// Add method to check system health
DevOpsSystem.prototype.checkSystemHealth = function() {
    const health = {
        gameEngine: !!window.state,
        aiEngine: !!window.AIEngine,
        personalities: !!window.Personalities,
        boardSystem: !!window.cells,
        pieceSystem: !!window.tray,
        animationSystem: !!window.animating !== undefined
    };
    
    const healthyComponents = Object.values(health).filter(Boolean).length;
    const totalComponents = Object.keys(health).length;
    
    console.log(`🔧 System Health: ${healthyComponents}/${totalComponents} components ready`, health);
    
    return {
        score: (healthyComponents / totalComponents) * 100,
        details: health,
        ready: healthyComponents === totalComponents
    };
};

// Add test functions for development
DevOpsSystem.prototype.runTests = function() {
    console.log('🧪 Running Dev Ops System Tests...');
    
    // Test 1: System Health
    const health = this.checkSystemHealth();
    console.log(`✅ System Health: ${health.score}%`);
    
    // Test 2: Modal functionality
    try {
        this.showModal();
        setTimeout(() => {
            this.hideModal();
            console.log('✅ Modal show/hide working');
        }, 1000);
    } catch (error) {
        console.error('❌ Modal test failed:', error);
    }
    
    // Test 3: Statistics
    try {
        this.updateStatisticsDisplay();
        console.log('✅ Statistics display working');
    } catch (error) {
        console.error('❌ Statistics test failed:', error);
    }
    
    // Test 4: Tab switching
    try {
        this.switchTab('ai-vs-ai');
        this.switchTab('statistics');
        this.switchTab('human-learning');
        console.log('✅ Tab switching working');
    } catch (error) {
        console.error('❌ Tab switching test failed:', error);
    }
    
    console.log('🧪 Tests complete');
};

// Global test function
window.testDevOps = function() {
    if (window.devOpsSystem) {
        window.devOpsSystem.runTests();
    } else {
        console.error('❌ Dev Ops System not initialized');
    }
};

// Global function to quickly start an AI battle for testing
window.startQuickAIBattle = function() {
    if (window.devOpsSystem) {
        console.log('🧪 Starting quick AI battle for testing...');
        
        // Show the modal first
        window.devOpsSystem.showModal();
        
        // Switch to AI vs AI tab
        window.devOpsSystem.switchTab('ai-vs-ai');
        
        // Start a quick battle after a short delay
        setTimeout(() => {
            const whiteSelect = document.getElementById('white-ai-select');
            const blackSelect = document.getElementById('black-ai-select');
            const speedSlider = document.getElementById('battle-speed');
            
            if (whiteSelect && blackSelect && speedSlider) {
                whiteSelect.value = 'sunny';
                blackSelect.value = 'buzzwell';
                speedSlider.value = '500'; // Fast battle
                
                window.devOpsSystem.updateBattleSpeed('500');
                window.devOpsSystem.startAIBattle();
                
                console.log('🧪 Quick AI battle started: Sunny vs Buzzwell');
            } else {
                console.error('❌ Could not find AI battle controls');
            }
        }, 1000);
    } else {
        console.error('❌ Dev Ops System not available');
    }
};