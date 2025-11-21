/**
 * HYVEMYND WASM Integration Bridge
 * Connects WASM engine with existing personality and progress systems
 */

(function() {
    'use strict';
    
    // Global function to request WASM engine move
    window.requestWASMMove = async function() {
        if (!window.wasmEngine || !window.state) {
            console.error('❌ WASM engine or game state not available');
            return;
        }
        
        // In single player mode, AI ONLY plays black (human is white)
        if (window.singlePlayerMode && window.singlePlayerAIColor) {
            const currentTurn = window.state.current;
            if (currentTurn !== window.singlePlayerAIColor) {
                console.log(`👤 Single Mode: Not AI turn (current: ${currentTurn}, AI plays ${window.singlePlayerAIColor} only) - skipping`);
                return; // Don't play for the human
            }
        }
        
        try {
            console.log('🧩 Processing WASM engine move...');
            
            // Get current personality settings for AI difficulty
            const personality = getCurrentPersonality();
            console.log(`🎭 Using personality: ${personality.name}`);
            
            // Determine color theme based on AI difficulty comparison
            const colorTheme = determineColorTheme(personality.name);
            
            // Show progress popup with color theme
            if (window.engineIntegration) {
                window.engineIntegration.updateProgressPopup(true, {
                    phase: 'initializing',
                    progress: 0,
                    difficulty: colorTheme,
                    aiName: personality.name
                });
            }
            
            // Export current game state to UHP format
            const gameString = exportGameStateToUHP();
            console.log(`📋 Game state: ${gameString}`);
            
            // Configure search parameters based on personality
            const searchOptions = {
                mode: personality.mode || 'time',
                timeLimit: personality.timeLimit || 4,
                depthLimit: personality.depthLimit || 5
            };
            
            // Update progress
            if (window.engineIntegration) {
                window.engineIntegration.updateProgressPopup(true, {
                    phase: 'analyzing',
                    progress: 25
                });
            }
            
            // Check move limit before allowing AI to think
            if (window.canAIMakeMove && !window.canAIMakeMove()) {
                console.log('❌ Move limit reached - stopping AI');
                throw new Error('Move limit reached');
            }
            
            // Set up timeout protection for AI thinking
            let moveCompleted = false;
            const moveTimeoutId = setTimeout(() => {
                if (!moveCompleted) {
                    console.warn('⏱️ AI move timeout (60s) - move taking too long');
                    if (window.engineIntegration) {
                        window.engineIntegration.updateProgressPopup(false);
                    }
                    const hud = document.getElementById('hud');
                    if (hud) {
                        hud.innerHTML = '⏱️ AI timeout - move took too long';
                        setTimeout(() => {
                            if (window.updateHUD) window.updateHUD();
                        }, 3000);
                    }
                }
            }, 60000); // 60 second timeout
            
            const emergencyTimeoutId = setTimeout(() => {
                if (!moveCompleted) {
                    console.error('🚨 Emergency timeout (120s) - forcing move termination');
                    moveCompleted = true;
                    clearTimeout(moveTimeoutId);
                    if (window.engineIntegration) {
                        window.engineIntegration.updateProgressPopup(false);
                    }
                    alert('AI engine timeout - please reset the game');
                }
            }, 120000); // 120 second emergency timeout
            
            // Get best move from WASM engine
            const bestMove = await window.wasmEngine.getBestMove(gameString, searchOptions);
            
            // Clear timeouts on successful completion
            moveCompleted = true;
            clearTimeout(moveTimeoutId);
            clearTimeout(emergencyTimeoutId);
            
            if (!bestMove || bestMove.toLowerCase().includes('err')) {
                throw new Error(`Invalid move response: ${bestMove}`);
            }
            
            console.log(`🎯 WASM engine suggests: ${bestMove}`);
            
            // Validate that the suggested move is for the correct side
            const currentTurn = window.state?.current;
            const moveColor = bestMove.startsWith('w') ? 'white' : bestMove.startsWith('b') ? 'black' : null;
            
            if (moveColor && currentTurn && moveColor !== currentTurn) {
                console.warn(`❌ WASM suggested ${moveColor} move "${bestMove}" but current turn is ${currentTurn}`);
                console.warn(`⚠️ Game state desync detected - attempting to fix by passing turn`);
                
                // Try to fix desync by passing the turn 
                if (window.passTurn) {
                    console.log(`🔄 Attempting to fix turn desync by passing turn`);
                    window.passTurn();
                    
                    // Retry the WASM request after a delay - requestWASMMove takes no params
                    setTimeout(() => {
                        console.log(`🔄 Retrying WASM move request after turn correction`);  
                        window.requestWASMMove();
                    }, 1000);
                    return;
                }
                
                throw new Error(`Turn mismatch: WASM suggested ${moveColor} move but current turn is ${currentTurn}`);
            }
            
            // Update progress
            if (window.engineIntegration) {
                window.engineIntegration.updateProgressPopup(true, {
                    phase: 'complete',
                    progress: 100
                });
            }
            
            // Apply the move to the game
            setTimeout(() => {
                applyEngineMove(bestMove);
                
                // Increment AI move counter after successful move
                if (window.incrementAIMoveCount) {
                    window.incrementAIMoveCount();
                }
                
                // Hide progress popup and mini-console immediately
                if (window.engineIntegration) {
                    window.engineIntegration.updateProgressPopup(false);
                }
                
                // Hide mini-console immediately after move completes
                if (window.hideMiniConsoles) {
                    window.hideMiniConsoles();
                }
            }, 100); // Very brief delay just to show move completion
            
        } catch (error) {
            console.error('❌ WASM engine move failed:', error);
            
            // Hide progress popup and mini-console on error
            if (window.engineIntegration) {
                window.engineIntegration.updateProgressPopup(false);
            }
            if (window.hideMiniConsoles) {
                window.hideMiniConsoles();
            }
            
            // Show error in HUD
            const hud = document.getElementById('hud');
            if (hud) {
                hud.innerHTML = `❌ AI Error: ${error.message}`;
                setTimeout(() => {
                    if (window.updateHUD) window.updateHUD();
                }, 3000);
            }
        }
    };
    
    // Get current personality based on Single Mode state or Dev Ops battle
    function getCurrentPersonality() {
        let difficulty = 'buzzwell'; // Default to medium
        
        // Check if in Dev Ops AI battle mode
        if (window.devOpsSystem && window.devOpsSystem.currentBattle && window.devOpsSystem.currentBattle.active) {
            const currentAI = window.state.current === 'white' 
                ? window.devOpsSystem.currentBattle.whiteAI 
                : window.devOpsSystem.currentBattle.blackAI;
            difficulty = currentAI || 'buzzwell';
            console.log(`🎭 Dev Ops battle mode - using ${difficulty} personality for ${window.state.current}`);
        } else {
            // Check if in Single Mode and get difficulty
            const singleModeBtn = document.getElementById('single-mode-button');
            difficulty = singleModeBtn?.dataset?.difficulty || 'buzzwell';
            console.log(`🎭 Single mode - using ${difficulty} personality`);
        }
        
        // Get personality settings from localStorage or defaults
        const personalities = {
            sunny: {
                name: 'Sunny Pollenpatch',
                mode: 'time',
                timeLimit: 2,
                depthLimit: 3
            },
            buzzwell: {
                name: 'Buzzwell Stingmore', 
                mode: 'time',
                timeLimit: 4,
                depthLimit: 5
            },
            beedric: {
                name: 'Beedric Bumbleton',
                mode: 'time', 
                timeLimit: 10,
                depthLimit: 8
            }
        };
        
        // Try to load saved personality settings
        try {
            const saved = localStorage.getItem('hyvemynd-personalities');
            if (saved) {
                const savedPersonalities = JSON.parse(saved);
                Object.assign(personalities, savedPersonalities);
            }
        } catch (e) {
            console.warn('Failed to load saved personalities, using defaults');
        }
        
        return personalities[difficulty] || personalities.buzzwell;
    }
    
    // Determine terminal color theme based on AI difficulty comparison
    function determineColorTheme(currentAIName) {
        // Map AI names to difficulty levels (1=easy, 2=medium, 3=hard)
        const difficultyMap = {
            'Sunny Pollenpatch': 1,
            'Buzzwell Stingmore': 2,
            'Beedric Bumbleton': 3
        };
        
        const currentDifficulty = difficultyMap[currentAIName] || 2;
        
        // Check if in AI battle mode
        if (window.devOpsSystem && window.devOpsSystem.currentBattle && window.devOpsSystem.currentBattle.active) {
            const whiteAI = window.devOpsSystem.currentBattle.whiteAI;
            const blackAI = window.devOpsSystem.currentBattle.blackAI;
            
            if (!whiteAI || !blackAI) {
                return 'green'; // Default
            }
            
            // Get AI names based on IDs
            const aiNames = {
                'sunny': 'Sunny Pollenpatch',
                'buzzwell': 'Buzzwell Stingmore',
                'beedric': 'Beedric Bumbleton'
            };
            
            const whiteAIName = aiNames[whiteAI];
            const blackAIName = aiNames[blackAI];
            
            const whiteDifficulty = difficultyMap[whiteAIName] || 2;
            const blackDifficulty = difficultyMap[blackAIName] || 2;
            
            // Mirror match - use blue
            if (whiteDifficulty === blackDifficulty) {
                return 'blue';
            }
            
            // Current AI is stronger - green (hacker vibe)
            // Current AI is weaker - amber (retro vibe)
            return currentDifficulty > (window.state.current === 'white' ? blackDifficulty : whiteDifficulty) ? 'green' : 'amber';
        }
        
        // Single player mode - always show AI's difficulty as green (player is facing the AI)
        return 'green';
    }
    
    // Clean up any invalid moves from UHP history
    function cleanupInvalidMoves() {
        if (window.uhpClient?.uhpMoveHistory) {
            const history = window.uhpClient.uhpMoveHistory;
            const invalidKeys = [];
            
            for (const [key, move] of history.entries()) {
                if (move && move.includes('INVALID')) {
                    invalidKeys.push(key);
                }
            }
            
            if (invalidKeys.length > 0) {
                console.log(`🧹 Found ${invalidKeys.length} invalid moves to remove:`, invalidKeys);
                invalidKeys.forEach(key => {
                    console.log(`🗑️ Removing invalid move ${key}: ${history.get(key)}`);
                    history.delete(key);
                });
                console.log(`✅ Cleaned up UHP history - removed ${invalidKeys.length} invalid moves`);
            }
        }
    }

    // Export current game state to UHP format
    function exportGameStateToUHP() {
        try {
            // Clean up any existing invalid moves first
            cleanupInvalidMoves();
            
            // Check if we have UHP move history available
            const uhpClient = window.uhpClient;
            const moveHistory = uhpClient?.uhpMoveHistory;
            
            console.log('🔍 Checking UHP data:', {
                uhpClient: !!uhpClient,
                moveHistory: !!moveHistory,
                moveCount: moveHistory?.size || 0,
                moves: moveHistory ? Array.from(moveHistory.entries()) : []
            });
            
            // Build UHP move string from recorded history, filtering out invalid moves
            if (moveHistory && moveHistory.size > 0) {
                const moves = [];
                const maxMoveNum = Math.max(...moveHistory.keys());
                for (let i = 1; i <= maxMoveNum; i++) {
                    if (moveHistory.has(i)) {
                        const move = moveHistory.get(i);
                        // Skip invalid moves to prevent WASM engine corruption
                        if (move && !move.includes('INVALID')) {
                            moves.push(move);
                        } else if (move) {
                            console.log(`🚫 Filtering out invalid move ${i}: ${move}`);
                        }
                    }
                }
                const uhpString = moves.join(';');
                console.log(`📝 Using UHP history (${moves.length} valid moves): ${uhpString}`);
                return uhpString;
            } else {
                console.log('📝 No UHP history yet, starting new game');
                return '';
            }
            
        } catch (error) {
            console.error('Failed to export UHP game state:', error);
            return ''; // Empty for new game
        }
    }
    
    // Format piece for UHP notation
    function formatPieceForUHP(piece) {
        if (!piece || !piece.meta) return '';
        
        const color = piece.color === 'white' ? 'w' : 'b';
        const pieceType = piece.meta.key;
        const position = `${piece.q},${piece.r}`;
        
        // For first move, just piece type
        if (piece.q === 0 && piece.r === 0) {
            return `${color}${pieceType}1`;
        }
        
        // Find reference piece for positioning
        // This is simplified - full UHP requires proper relative positioning
        return `${color}${pieceType}1 /${position}`;
    }
    
    // Apply engine move to the game
    function applyEngineMove(moveString) {
        if (!moveString || !window.commitMove || !window.commitPlacement) {
            console.error('❌ Cannot apply engine move - game functions not available');
            return;
        }
        
        try {
            console.log(`🎯 Applying engine move: ${moveString}`);
            
            // Use UHP client to parse and apply the move
            if (window.uhpClient && window.uhpClient.importMove) {
                console.log(`🔍 Parsing UHP move: ${moveString}`);
                const action = window.uhpClient.importMove(moveString);
                
                if (action) {
                    console.log(`✅ Parsed action:`, action);
                    
                    if ((action.type === 'placement' || action.type === 'place') && action.piece) {
                        // Select the piece first, then place it
                        console.log(`🎯 Selecting piece for placement:`, action.piece);
                        window.selectPlacement(action.piece);
                        
                        // Apply placement after a brief delay to allow selection
                        setTimeout(() => {
                            console.log(`🎯 Placing piece at (${action.q}, ${action.r})`);
                            window.commitPlacement(action.q, action.r);
                        }, 100);
                    } else if (action.type === 'move' && action.piece) {
                        // Select the piece first, then move it
                        console.log(`🎯 Selecting piece for movement:`, action.piece);
                        window.selectMove(action.piece);
                        
                        // Apply movement after a brief delay to allow selection
                        setTimeout(() => {
                            console.log(`🎯 Moving piece to (${action.q}, ${action.r})`);
                            window.commitMove(action.q, action.r);
                        }, 100);
                    } else {
                        console.warn(`❌ Unknown action type: ${action.type}`, action);
                    }
                } else {
                    console.warn('❌ Failed to parse UHP move, trying fallback');
                    makeValidMove();
                }
            } else {
                console.warn('❌ UHP client not available, trying fallback');
                makeValidMove();
            }
            
        } catch (error) {
            console.error('❌ Failed to apply engine move:', error);
            makeValidMove();
        }
    }
    
    // Make a valid move (placeholder implementation)
    function makeValidMove() {
        if (!window.state || !window.legalPlacementZones || !window.legalMoveZones) {
            return;
        }
        
        try {
            const currentColor = window.state.current;
            
            // Try placement first
            const availablePieces = window.tray.filter(piece => 
                piece.color === currentColor && !piece.placed
            );
            
            if (availablePieces.length > 0) {
                const piece = availablePieces[0];
                const zones = window.legalPlacementZones(currentColor);
                
                if (zones.size > 0) {
                    const zoneKeys = Array.from(zones);
                    const randomZone = zoneKeys[Math.floor(Math.random() * zoneKeys.length)];
                    const [q, r] = randomZone.split(',').map(Number);
                    
                    console.log(`🎯 Placing ${piece.meta.key} at ${q},${r}`);
                    
                    if (window.selectPlacement) {
                        window.selectPlacement(piece);
                        setTimeout(() => {
                            if (window.commitPlacement) {
                                window.commitPlacement(q, r);
                            }
                        }, 100);
                    }
                    return;
                }
            }
            
            // Try movement if no placement available
            const placedPieces = window.tray.filter(piece => 
                piece.color === currentColor && piece.placed
            );
            
            for (const piece of placedPieces) {
                const moveZones = window.legalMoveZones(piece);
                if (moveZones && moveZones.length > 0) {
                    const randomZone = moveZones[Math.floor(Math.random() * moveZones.length)];
                    const [q, r] = randomZone.split(',').map(Number);
                    
                    console.log(`🎯 Moving ${piece.meta.key} to ${q},${r}`);
                    
                    if (window.selectMove) {
                        window.selectMove(piece);
                        setTimeout(() => {
                            if (window.commitMove) {
                                window.commitMove(q, r);
                            }
                        }, 100);
                    }
                    return;
                }
            }
            
            console.warn('⚠️ No valid moves found');
        } catch (error) {
            console.error('❌ Failed to make valid move:', error);
        }
    }
    
    // Initialize WASM engine when appropriate
    function initializeWASMEngine() {
        if (window.Capacitor && window.wasmEngine) {
            console.log('📱 Capacitor detected - initializing WASM engine');
            
            // Show initialization progress
            if (window.engineIntegration) {
                window.engineIntegration.updateProgressPopup(true, {
                    phase: 'loading',
                    progress: 0
                });
            }
            
            window.wasmEngine.initialize().then(() => {
                console.log('✅ WASM engine ready for offline play');
                
                // Hide initialization progress
                if (window.engineIntegration) {
                    setTimeout(() => {
                        window.engineIntegration.updateProgressPopup(false);
                    }, 1000);
                }
                
                // Update connection status in Dev Ops panel
                const statusText = document.getElementById('connection-text');
                if (statusText) {
                    statusText.textContent = 'WASM Engine Ready (Offline)';
                }
                
                const statusDot = document.getElementById('connection-indicator');
                if (statusDot) {
                    statusDot.className = 'status-dot connected';
                }
                
            }).catch(error => {
                console.error('❌ WASM engine initialization failed:', error);
                
                // Hide progress and show error
                if (window.engineIntegration) {
                    window.engineIntegration.updateProgressPopup(false);
                }
            });
        }
    }
    
    // Initialize when loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWASMEngine);
    } else {
        initializeWASMEngine();
    }
    
    // Also try after a delay for late loading
    setTimeout(initializeWASMEngine, 1000);
    
    console.log('🧩 WASM Integration Bridge loaded');
    
})();