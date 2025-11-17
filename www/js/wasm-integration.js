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
        
        try {
            console.log('🧩 Processing WASM engine move...');
            
            // Show progress popup
            if (window.engineIntegration) {
                window.engineIntegration.updateProgressPopup(true, {
                    phase: 'initializing',
                    progress: 0
                });
            }
            
            // Get current personality settings for AI difficulty
            const personality = getCurrentPersonality();
            console.log(`🎭 Using personality: ${personality.name}`);
            
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
            
            // Get best move from WASM engine
            const bestMove = await window.wasmEngine.getBestMove(gameString, searchOptions);
            
            if (!bestMove || bestMove.toLowerCase().includes('err')) {
                throw new Error(`Invalid move response: ${bestMove}`);
            }
            
            console.log(`🎯 WASM engine suggests: ${bestMove}`);
            
            // Validate that the suggested move is for the correct side
            const currentTurn = window.state?.current;
            const moveColor = bestMove.startsWith('w') ? 'white' : bestMove.startsWith('b') ? 'black' : null;
            
            if (moveColor && currentTurn && moveColor !== currentTurn) {
                console.warn(`❌ WASM suggested ${moveColor} move "${bestMove}" but current turn is ${currentTurn}`);
                console.warn(`⚠️ This indicates game state desync - rejecting move to prevent corruption`);
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
                
                // Hide progress popup
                if (window.engineIntegration) {
                    window.engineIntegration.updateProgressPopup(false);
                }
            }, 500); // Brief delay to show completion
            
        } catch (error) {
            console.error('❌ WASM engine move failed:', error);
            
            // Hide progress popup on error
            if (window.engineIntegration) {
                window.engineIntegration.updateProgressPopup(false);
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
    
    // Get current personality based on Single Mode state
    function getCurrentPersonality() {
        // Check if in Single Mode and get difficulty
        const singleModeBtn = document.getElementById('single-mode-button');
        const difficulty = singleModeBtn?.dataset?.difficulty || 'buzzwell'; // Default to medium
        
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