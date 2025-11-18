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
        
        // WASM engine event listeners for progress indicators
        if (window.wasmEngine) {
            window.wasmEngine.on('thinking', (data) => {
                if (this.currentBattle && this.currentBattle.active) {
                    const currentAI = window.state.current === 'white' 
                        ? this.currentBattle.whiteAI 
                        : this.currentBattle.blackAI;
                    this.updateBattleStatus(`🧠 ${currentAI} thinking... (${data.phase})`);
                }
                
                // Update engine progress popup if available
                if (window.engineIntegration) {
                    window.engineIntegration.updateProgressPopup(true, data);
                }
            });
            
            window.wasmEngine.on('initialized', () => {
                console.log('✅ WASM engine ready for Dev Ops battles');
                this.updateBattleStatus('✅ WASM engine ready');
            });
            
            window.wasmEngine.on('error', (error) => {
                console.error('❌ WASM engine error in Dev Ops:', error);
                this.updateBattleStatus(`❌ Engine Error: ${error.message}`);
                if (this.currentBattle && this.currentBattle.active) {
                    this.stopAIBattle();
                }
            });
        }
        
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
        
        // Setup personalities controls
        this.setupPersonalitiesControls();
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
        // Map AI names to personality settings
        const personalityMap = {
            'sunny': {
                name: 'Sunny Pollenpatch',
                mode: 'time',
                timeLimit: 2,
                depthLimit: 3
            },
            'buzzwell': {
                name: 'Buzzwell Stingmore',
                mode: 'time', 
                timeLimit: 4,
                depthLimit: 5
            },
            'beedric': {
                name: 'Beedric Bumbleton',
                mode: 'time',
                timeLimit: 10,
                depthLimit: 8
            }
        };
        
        const personality = personalityMap[aiName] || personalityMap['buzzwell'];
        
        try {
            // Ensure WASM engine is available
            if (!window.wasmEngine) {
                throw new Error('WASM Engine not available');
            }
            
            this.updateBattleStatus(`🧠 ${personality.name} is thinking...`);
            
            // Initialize WASM engine if needed
            if (!window.wasmEngine.initialized) {
                await window.wasmEngine.initialize();
            }
            
            // Set personality for voice lines
            if (window.Personalities && window.Personalities.setOpponent) {
                const difficultyMap = { 'sunny': 'easy', 'buzzwell': 'medium', 'beedric': 'hard' };
                window.Personalities.setOpponent(difficultyMap[aiName] || 'medium');
            }
            
            // For AI battles, get current UHP move history to send to WASM engine
            // This ensures the engine knows what pieces are already on the board
            let gameString = '';
            if (window.uhpClient && window.uhpClient.uhpMoveHistory && window.uhpClient.uhpMoveHistory.size > 0) {
                const moves = [];
                const maxMoveNum = Math.max(...window.uhpClient.uhpMoveHistory.keys());
                for (let i = 1; i <= maxMoveNum; i++) {
                    if (window.uhpClient.uhpMoveHistory.has(i)) {
                        moves.push(window.uhpClient.uhpMoveHistory.get(i));
                    }
                }
                gameString = moves.join(';');
                console.log(`🎯 AI battle: Sending ${moves.length} moves to WASM engine: ${gameString}`);
            } else {
                console.log(`🎯 AI battle: No move history found, starting fresh game`);
            }
            
            // Use personality-specific engine settings for AI battles
            const difficultyMap = {
                'sunny': { timeLimit: 2, depthLimit: 2 },     // Easy: 2s, depth 2
                'buzzwell': { timeLimit: 4, depthLimit: 4 },  // Medium: 4s, depth 4  
                'beedric': { timeLimit: 6, depthLimit: 6 }    // Hard: 6s, depth 6
            };
            
            const personalitySettings = difficultyMap[aiName] || difficultyMap['buzzwell'];
            const searchMode = 'time'; // Use time mode for consistent battle pacing
            
            const engineOptions = {
                mode: searchMode,
                timeLimit: personalitySettings.timeLimit,
                depthLimit: personalitySettings.depthLimit
            };
            
            console.log(`🎯 Using personality settings for ${aiName}: ${personalitySettings.timeLimit}s (${personality.name})`);
            
            // Get best move from WASM engine with personality settings
            const bestMove = await window.wasmEngine.getBestMove(gameString, engineOptions);
            
            if (!bestMove || bestMove.toLowerCase().includes('err')) {
                throw new Error(`Invalid move response: ${bestMove}`);
            }
            
            console.log(`🎯 ${aiName} suggests: ${bestMove}`);
            
            // Store the move in battle history instead of applying to main game
            if (!this.currentBattle.moveHistory) {
                this.currentBattle.moveHistory = [];
            }
            this.currentBattle.moveHistory.push({
                aiName: aiName,
                move: bestMove,
                personality: personality.name,
                timestamp: Date.now()
            });
            
            // Apply the move to the game (this will update the main game state)
            const moveApplied = await this.applyUHPMove(bestMove);
            
            if (!moveApplied) {
                throw new Error(`WASM engine rejected move: ${bestMove}`);
            }
            
            this.updateBattleStatus(`✅ ${aiName} played: ${bestMove}`);
            // Wait for any animations to complete
            while (window.animating) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            return Promise.resolve();
        } catch (error) {
            console.error(`Error making AI move for ${aiName}:`, error);
            this.updateBattleStatus(`❌ Error: ${error.message}`);
            throw error;
        }
    }
    
    // Export current game state to UHP format for AI battles
    exportGameStateToUHP() {
        // Use the existing UHP move history from the game system
        if (window.uhpMoveHistory && window.uhpMoveHistory.length > 0) {
            // Extract UHP moves from the move history
            const uhpMoves = window.uhpMoveHistory.map(entry => {
                if (Array.isArray(entry) && entry.length >= 2) {
                    return entry[1]; // UHP string is at index 1
                }
                return entry.uhp || entry.move || entry; // fallback for different formats
            }).filter(move => move && move.trim());
            
            if (uhpMoves.length > 0) {
                const gameState = uhpMoves.join(';');
                console.log(`🎯 Using UHP history (${uhpMoves.length} moves): ${gameState}`);
                return gameState;
            }
        }
        
        // For fresh games, return empty string (same as human vs AI)
        console.log(`🎯 Fresh game - no UHP history yet`);
        return '';
    }
    
    // Apply UHP move to the game state
    async applyUHPMove(uhpMove) {
        if (!uhpMove || typeof uhpMove !== 'string') {
            console.error('❌ Invalid UHP move:', uhpMove);
            return false;
        }

        try {
            console.log(`🎯 Applying UHP move: ${uhpMove}`);
            
            // CRITICAL: Validate move with WASM engine first to prevent duplicate pieces
            if (window.wasmEngine) {
                // Get current game state for validation
                const currentMoves = [];
                if (window.uhpClient && window.uhpClient.uhpMoveHistory && window.uhpClient.uhpMoveHistory.size > 0) {
                    const maxMoveNum = Math.max(...window.uhpClient.uhpMoveHistory.keys());
                    for (let i = 1; i <= maxMoveNum; i++) {
                        if (window.uhpClient.uhpMoveHistory.has(i)) {
                            currentMoves.push(window.uhpClient.uhpMoveHistory.get(i));
                        }
                    }
                }
                
                // Test if the move is valid by simulating it
                try {
                    const testGameString = currentMoves.concat([uhpMove]).join(';');
                    const tempEngine = await window.wasmEngine.sendCommand('newgame Base');
                    
                    // Apply existing moves
                    for (const move of currentMoves) {
                        const result = await window.wasmEngine.sendCommand(`play ${move}`);
                        if (result.includes('invalidmove')) {
                            console.warn(`⚠️ Invalid existing move during validation: ${move}`);
                            break;
                        }
                    }
                    
                    // Test the new move
                    const testResult = await window.wasmEngine.sendCommand(`play ${uhpMove}`);
                    if (testResult.includes('invalidmove')) {
                        console.error(`❌ WASM engine rejects move: ${uhpMove}`);
                        console.error(`❌ Response: ${testResult}`);
                        return false; // Don't apply invalid moves to UI
                    }
                    
                    console.log(`✅ WASM engine accepts move: ${uhpMove}`);
                } catch (validationError) {
                    console.error('❌ Move validation failed:', validationError);
                    return false;
                }
            }            // Handle "pass" moves
            if (uhpMove.toLowerCase() === 'pass') {
                if (window.passTurn) {
                    window.passTurn();
                }
                return;
            }
            
            // Parse the UHP move - handle both placement and movement
            const moveMatch = uhpMove.match(/([wb])([QAGBS])(\d*)([/\\-]?)(.*)/);
            if (!moveMatch) {
                console.error('❌ Failed to parse UHP move:', uhpMove);
                return;
            }
            
            const [, color, pieceType, pieceNumber, direction, position] = moveMatch;
            const fullColor = color === 'w' ? 'white' : 'black';
            
            // Check if this is a movement (piece already placed) or placement
            const existingPiece = window.tray.find(p => 
                p.meta.color === fullColor && 
                p.meta.key === pieceType && 
                p.placed
            );
            
            if (existingPiece) {
                // This is a movement - find a legal destination
                console.log(`🎯 Moving existing ${fullColor} ${pieceType}`);
                
                if (window.selectMove && window.commitMove && window.legalMoveZones) {
                    const legalMoves = window.legalMoveZones(existingPiece);
                    if (legalMoves && legalMoves.length > 0) {
                        const targetKey = Array.isArray(legalMoves) ? legalMoves[0] : Array.from(legalMoves)[0];
                        const [q, r] = targetKey.split(',').map(Number);
                        
                        window.selectMove(existingPiece);
                        window.commitMove(q, r);
                    } else {
                        console.warn(`⚠️ No legal moves found for ${fullColor} ${pieceType}`);
                    }
                }
            } else {
                // This is a placement - find an unplaced piece
                console.log(`🎯 Placing new ${fullColor} ${pieceType}`);
                
                const piece = window.tray.find(p => 
                    p.meta.color === fullColor && 
                    p.meta.key === pieceType && 
                    !p.placed
                );
                
                if (!piece) {
                    console.error(`❌ Could not find unplaced ${fullColor} ${pieceType} piece`);
                    return;
                }
                
                // Find a valid placement location
                if (window.selectPlacement && window.commitPlacement && window.legalPlacementZones) {
                    const legalZones = window.legalPlacementZones(fullColor);
                    if (legalZones.size > 0) {
                        const firstLegal = Array.from(legalZones)[0];
                        const [q, r] = firstLegal.split(',').map(Number);
                        
                        window.selectPlacement(piece);
                        window.commitPlacement(q, r);
                    } else {
                        console.error(`❌ No legal placement zones for ${fullColor}`);
                    }
                } else {
                    console.error('❌ Placement functions not available');
                }
            }
            
            console.log(`✅ Successfully applied UHP move: ${uhpMove}`);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to apply UHP move:', error);
            return false;
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

        // Hide export button while a learning session is active
        try {
            const exportBtn = document.getElementById('export-learning-data');
            if (exportBtn) exportBtn.style.display = 'none';
        } catch (e) { /* ignore */ }
        
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

        // Reveal export button now that learning data has been saved
        try {
            const exportBtn = document.getElementById('export-learning-data');
            if (exportBtn) exportBtn.style.display = 'block';
        } catch (e) { /* ignore */ }
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
        
        // Calculate human win rate (count all games where human won, regardless of color)
        const humanWins = learningData.filter(game => {
            // If human played white, win is 'white'; if human played black, win is 'black'
            // Assume human always plays white unless game.humanColor is set
            if (game.humanColor) {
                return game.winner === game.humanColor;
            }
            // Fallback: if no color info, assume human is white
            return game.winner === 'white';
        }).length;
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
            // If we have learning data available, reveal export button and notify user
            try {
                const exportBtn = document.getElementById('export-learning-data');
                if (exportBtn && this.statistics.humanLearningData && this.statistics.humanLearningData.length > 0) {
                    exportBtn.style.display = 'block';
                    if (window.showToast) window.showToast('Learning data saved — Export available', 3000);
                }
            } catch (e) { /* ignore DOM errors */ }
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
                // If learned data exists, reveal export button so user can download it
                try {
                    const exportBtn = document.getElementById('export-learning-data');
                    if (exportBtn && this.statistics.humanLearningData && this.statistics.humanLearningData.length > 0) {
                        exportBtn.style.display = 'block';
                    }
                } catch (e) { /* ignore */ }
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
        
        // Load personality settings
        this.loadPersonalitySettings();
    }
    
    // Personalities Management
    setupPersonalitiesControls() {
        // Load saved personality settings
        this.loadPersonalitySettings();
        
        // Setup sliders and controls for each personality
        const personalities = ['sunny', 'buzzwell', 'beedric'];
        
        personalities.forEach(personality => {
            // Time limit slider
            const timeSlider = document.getElementById(`${personality}-time-limit`);
            const timeValue = document.getElementById(`${personality}-time-value`);
            if (timeSlider && timeValue) {
                timeSlider.addEventListener('input', (e) => {
                    const value = e.target.value;
                    timeValue.textContent = `${value}s`;
                    this.updatePersonalitySetting(personality, 'timeLimit', parseInt(value));
                });
            }
            
            // Depth limit slider
            const depthSlider = document.getElementById(`${personality}-depth-limit`);
            const depthValue = document.getElementById(`${personality}-depth-value`);
            if (depthSlider && depthValue) {
                depthSlider.addEventListener('input', (e) => {
                    const value = e.target.value;
                    depthValue.textContent = `${value} ply`;
                    this.updatePersonalitySetting(personality, 'depthLimit', parseInt(value));
                });
            }
            
            // Mode select
            const modeSelect = document.getElementById(`${personality}-mode`);
            if (modeSelect) {
                modeSelect.addEventListener('change', (e) => {
                    this.updatePersonalitySetting(personality, 'mode', e.target.value);
                });
            }
        });
        
        // Action buttons
        const saveBtn = document.getElementById('save-personalities');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.savePersonalitySettings());
        }
        
        const resetBtn = document.getElementById('reset-personalities');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetPersonalitySettings());
        }
        
        const testBtn = document.getElementById('test-personalities');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testPersonalitySettings());
        }
    }
    
    loadPersonalitySettings() {
        // Default personality settings
        this.personalitySettings = {
            sunny: { timeLimit: 2, depthLimit: 3, mode: 'time' },
            buzzwell: { timeLimit: 4, depthLimit: 5, mode: 'time' },
            beedric: { timeLimit: 10, depthLimit: 8, mode: 'time' }
        };
        
        try {
            const saved = localStorage.getItem('hyvemynd-personality-settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.personalitySettings = { ...this.personalitySettings, ...parsed };
            }
        } catch (error) {
            console.error('Failed to load personality settings:', error);
        }
        
        // Apply settings to UI
        this.applyPersonalitySettingsToUI();
    }
    
    applyPersonalitySettingsToUI() {
        Object.keys(this.personalitySettings).forEach(personality => {
            const settings = this.personalitySettings[personality];
            
            // Update time slider
            const timeSlider = document.getElementById(`${personality}-time-limit`);
            const timeValue = document.getElementById(`${personality}-time-value`);
            if (timeSlider && timeValue) {
                timeSlider.value = settings.timeLimit;
                timeValue.textContent = `${settings.timeLimit}s`;
            }
            
            // Update depth slider
            const depthSlider = document.getElementById(`${personality}-depth-limit`);
            const depthValue = document.getElementById(`${personality}-depth-value`);
            if (depthSlider && depthValue) {
                depthSlider.value = settings.depthLimit;
                depthValue.textContent = `${settings.depthLimit} ply`;
            }
            
            // Update mode select
            const modeSelect = document.getElementById(`${personality}-mode`);
            if (modeSelect) {
                modeSelect.value = settings.mode;
            }
        });
    }
    
    updatePersonalitySetting(personality, setting, value) {
        if (!this.personalitySettings[personality]) {
            this.personalitySettings[personality] = {};
        }
        
        this.personalitySettings[personality][setting] = value;
        console.log(`🎭 Updated ${personality} ${setting}: ${value}`);
        
        // Auto-save after changes
        this.savePersonalitySettings(false);
    }
    
    savePersonalitySettings(showNotification = true) {
        try {
            localStorage.setItem('hyvemynd-personality-settings', JSON.stringify(this.personalitySettings));
            
            // Update AI UI system with new settings
            if (window.AIUI && window.AIUI.updatePersonalitySettings) {
                window.AIUI.updatePersonalitySettings(this.personalitySettings);
            }
            
            if (showNotification) {
                this.showPersonalityNotification('💾 Personality settings saved successfully!');
                console.log('🎭 Personality settings saved:', this.personalitySettings);
            }
        } catch (error) {
            console.error('Failed to save personality settings:', error);
            if (showNotification) {
                this.showPersonalityNotification('❌ Failed to save settings');
            }
        }
    }
    
    resetPersonalitySettings() {
        // Reset to defaults
        this.personalitySettings = {
            sunny: { timeLimit: 2, depthLimit: 3, mode: 'time' },
            buzzwell: { timeLimit: 4, depthLimit: 5, mode: 'time' },
            beedric: { timeLimit: 10, depthLimit: 8, mode: 'time' }
        };
        
        // Apply to UI
        this.applyPersonalitySettingsToUI();
        
        // Save
        this.savePersonalitySettings();
        
        this.showPersonalityNotification('🔄 Personality settings reset to defaults');
    }
    
    testPersonalitySettings() {
        const personality = 'sunny'; // Test with Sunny for quick results
        const settings = this.personalitySettings[personality];
        
        this.showPersonalityNotification(`🧪 Testing ${personality} settings: ${settings.timeLimit}s, ${settings.depthLimit} ply...`);
        
        // Start a quick game against the test personality
        if (window.AIUI) {
            // Temporarily apply settings and start game
            setTimeout(() => {
                if (window.AIUI.startAIMode) {
                    window.AIUI.startAIMode(personality);
                    this.hideModal(); // Close dev-ops to see the game
                    
                    setTimeout(() => {
                        this.showPersonalityNotification(`✅ Test started! Playing against ${personality} with current settings.`);
                    }, 1000);
                }
            }, 500);
        } else {
            this.showPersonalityNotification('❌ AI UI system not available for testing');
        }
    }
    
    showPersonalityNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50px;
            right: 20px;
            background: rgba(230, 184, 77, 0.95);
            color: #000;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: 'Milonga', serif;
            font-size: 14px;
            font-weight: bold;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        // Add CSS animation if not exists
        if (!document.getElementById('personality-notification-style')) {
            const style = document.createElement('style');
            style.id = 'personality-notification-style';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
    
    // Public method to get personality settings for AI UI system
    getPersonalitySettings(personality) {
        return this.personalitySettings[personality] || null;
    }
    
    // Public method to get all personality settings
    getAllPersonalitySettings() {
        return this.personalitySettings;
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