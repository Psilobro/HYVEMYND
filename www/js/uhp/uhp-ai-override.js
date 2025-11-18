/**
 * UHP AI Override System
 * Prevents built-in AI conflicts when UHP engine is active
 */

(function() {
    'use strict';
    
    console.log('🚫 UHP AI Override System initializing...');
    
    // Store original AI functions before they get overridden
    let originalNokamuteMzinga = null;
    let originalAIEngineCheckAndMakeMove = null;
    let originalUpdateHUD = null;
    
    // Global function to check if UHP engine should be active
    window.shouldUseUHPEngine = function() {
        const currentPlayer = window.state?.current;
        
        console.log('🔍 shouldUseUHPEngine check - UHP DISABLED, using WASM only:', {
            currentPlayer,
            wasmEngine: !!window.wasmEngine,
            wasmAvailable: window.wasmEngine?.isAvailable(),
            wasmInitialized: window.wasmEngine?.initialized
        });
        
        // Always use WASM engine - UHP system removed
        if (window.wasmEngine && window.wasmEngine.isAvailable()) {
            console.log('✅ Using WASM engine for AI (UHP system disabled)');
            return true; // Use WASM engine whenever possible for offline AI
        }
        
        // Fallback to WebSocket UHP client
        const useWebSocket = window.uhpClient && 
                            window.uhpClient.isEnabled() && 
                            window.uhpClient.shouldPlayForColor(currentPlayer);
        
        console.log('🔍 WebSocket fallback:', useWebSocket);
        return useWebSocket;
    };
    
    // Global function to determine which engine to use
    window.getActiveEngine = function() {
        if (window.wasmEngine && window.wasmEngine.isAvailable()) {
            return 'wasm'; // Always prefer WASM for offline AI
        } else if (window.uhpClient && window.uhpClient.connected) {
            return 'websocket';
        }
        return null;
    };
    
    // Override the main updateHUD function to control AI flow
    function interceptUpdateHUD() {
        if (window.updateHUD && !originalUpdateHUD) {
            originalUpdateHUD = window.updateHUD;
            
            window.updateHUD = function() {
                // Call original updateHUD first
                originalUpdateHUD.apply(this, arguments);
                
                // Check if UHP engine should take control
                if (window.shouldUseUHPEngine && window.shouldUseUHPEngine()) {
                    console.log('🎯 UHP Engine Override: Blocking all built-in AI');
                    
                    // Completely disable all AI systems
                    if (window.AIEngine) {
                        window.AIEngine.enabled = false;
                    }
                    if (window.AIEngineV2) {
                        window.AIEngineV2.enabled = false;
                    }
                    if (window.AIEngineNokamuteMzinga) {
                        window.AIEngineNokamuteMzinga.enabled = false;
                    }
                    
                    // Check if current player is an AI opponent
                    const currentPlayer = window.state?.current;
                    const isDevOpsBattle = window.devOpsSystem && window.devOpsSystem.currentBattle && window.devOpsSystem.currentBattle.active;
                    const isSinglePlayerAI = window.singlePlayerMode && currentPlayer === 'black'; // AI plays black in single mode
                    const isAITurn = isSinglePlayerAI || isDevOpsBattle; // AI vs AI battles or single player AI
                    
                    if (isAITurn) {
                        if (isDevOpsBattle) {
                            // Dev Ops AI vs AI battle - let the battle system handle it
                            console.log(`🎯 Dev Ops battle detected - letting battle system handle ${currentPlayer} move`);
                            return; // Let dev-ops battle loop handle the move
                        }
                        
                        const activeEngine = window.getActiveEngine();
                        
                        if (activeEngine === 'wasm') {
                            // Use WASM engine (offline mode)
                            setTimeout(() => {
                                console.log(`🧩 Requesting WASM engine move for ${currentPlayer}...`);
                                window.requestWASMMove();
                            }, 150);
                        } else if (activeEngine === 'websocket') {
                            // Check if UHP engine is already processing to prevent recursion
                            if (window.uhpClient && window.uhpClient.isProcessingCommand) {
                                console.log('🎯 UHP engine already processing, skipping duplicate call');
                                return;
                            }
                            
                            // Use WebSocket UHP engine
                            setTimeout(() => {
                                if (window.uhpClient && window.uhpClient.connected && !window.uhpClient.isProcessingCommand) {
                                    console.log(`🎯 Requesting UHP engine move for ${currentPlayer}...`);
                                    window.uhpClient.getBestMove();
                                }
                            }, 150);
                        }
                        
                        return; // Stop any further AI processing
                    } else {
                        console.log(`🤖 Engine Override: Not AI turn (current: ${currentPlayer}), skipping engine`);
                    }
                }
            };
        }
    }
    
    // Override AIEngine.checkAndMakeMove to prevent conflicts
    function interceptAIEngine() {
        if (window.AIEngine && window.AIEngine.checkAndMakeMove && !originalAIEngineCheckAndMakeMove) {
            originalAIEngineCheckAndMakeMove = window.AIEngine.checkAndMakeMove;
            
            window.AIEngine.checkAndMakeMove = async function() {
                if (window.shouldUseUHPEngine && window.shouldUseUHPEngine()) {
                    console.log('🚫 AIEngine.checkAndMakeMove blocked - UHP active');
                    return; // Block built-in AI
                }
                
                return originalAIEngineCheckAndMakeMove.apply(this, arguments);
            };
        }
    }
    
    // Override Nokamute/Mzinga activation function
    function interceptNokamuteMzinga() {
        if (window.activateNokamuteMzingaAI && !originalNokamuteMzinga) {
            originalNokamuteMzinga = window.activateNokamuteMzingaAI;
            
            window.activateNokamuteMzingaAI = function(difficulty) {
                console.log('🚫 Nokamute/Mzinga activation intercepted');
                
                if (window.shouldUseUHPEngine && window.shouldUseUHPEngine()) {
                    console.log('🚫 Blocking Nokamute/Mzinga - UHP engine active');
                    return; // Block activation
                }
                
                console.log('✅ Allowing Nokamute/Mzinga activation');
                return originalNokamuteMzinga.apply(this, arguments);
            };
        }
    }
    
    // Apply all overrides when DOM is ready
    function applyOverrides() {
        interceptUpdateHUD();
        interceptAIEngine();
        interceptNokamuteMzinga();
        
        console.log('✅ UHP AI Override System active');
    }
    
    // WASM engine move request function
    window.requestWASMMove = async function() {
        console.log('🧩 requestWASMMove called');
        
        if (!window.wasmEngine) {
            console.error('❌ WASM engine not available');
            return;
        }
        
        try {
            // Initialize WASM engine if needed
            if (!window.wasmEngine.initialized) {
                console.log('🧩 Initializing WASM engine...');
                await window.wasmEngine.initialize();
            }
            
            // Get current game state as UHP string
            const gameString = getCurrentUHPGameString();
            console.log('📝 Current game state:', gameString);
            
            // Get personality settings for AI difficulty
            const personality = getCurrentPersonality();
            const options = {
                mode: 'time',
                timeLimit: personality?.timeLimit || 2 // seconds
            };
            
            console.log('🎯 Getting best move with options:', options);
            
            // Request best move from WASM engine
            const bestMove = await window.wasmEngine.getBestMove(gameString, options);
            console.log('✅ WASM engine returned move:', bestMove);
            
            if (bestMove && bestMove !== 'null' && bestMove !== 'error') {
                // Apply the move to the game
                applyWASMMove(bestMove);
            } else {
                console.error('❌ WASM engine returned invalid move:', bestMove);
            }
            
        } catch (error) {
            console.error('❌ WASM move request failed:', error);
        }
    };
    
    // Convert current game state to UHP format
    function getCurrentUHPGameString() {
        // Use existing UHP history if available
        if (window.uhpMoveHistory && window.uhpMoveHistory.length > 0) {
            return window.uhpMoveHistory.join(';');
        }
        
        // If no UHP history, return empty string for new game
        return '';
    }
    
    // Get current AI personality settings
    function getCurrentPersonality() {
        if (window.currentAIPersonality && window.aiPersonalities) {
            return window.aiPersonalities[window.currentAIPersonality];
        }
        return { timeLimit: 2, difficulty: 'easy' };
    }
    
    // Apply WASM move to the game
    function applyWASMMove(uhpMove) {
        console.log('🎯 Applying WASM move:', uhpMove);
        
        if (!uhpMove || uhpMove === 'pass') {
            console.log('🎯 AI passes turn');
            if (window.passTurn) {
                window.passTurn();
            }
            return;
        }
        
        // Parse UHP move format (e.g., "bG1", "wQ -bG1")
        try {
            if (uhpMove.includes(' -')) {
                // Movement (e.g., "wQ -bG1")
                applyWASMMovement(uhpMove);
            } else {
                // Placement (e.g., "bG1")
                applyWASMPlacement(uhpMove);
            }
        } catch (error) {
            console.error('❌ Error applying WASM move:', error);
        }
    }
    
    // Apply WASM placement move
    function applyWASMPlacement(uhpMove) {
        console.log('🎯 Applying WASM placement:', uhpMove);
        
        // Parse piece type from UHP (e.g., "bG1" -> color: black, type: G)
        const color = uhpMove.charAt(0) === 'w' ? 'white' : 'black';
        const pieceType = uhpMove.charAt(1);
        
        // Find the piece in the tray
        const piece = window.tray.find(p => 
            p.meta.color === color && 
            p.meta.key === pieceType && 
            !p.meta.placed
        );
        
        if (!piece) {
            console.error('❌ Could not find piece for placement:', uhpMove);
            return;
        }
        
        // Get legal placement zones
        const legalZones = window.legalPlacementZones(color);
        if (legalZones.size === 0) {
            console.error('❌ No legal placement zones available');
            return;
        }
        
        // For now, place at first available legal zone
        // TODO: Parse exact position from UHP move
        const firstZone = Array.from(legalZones)[0];
        const [q, r] = firstZone.split(',').map(Number);
        
        console.log(`🎯 Placing ${color} ${pieceType} at (${q}, ${r})`);
        
        // Use existing placement system
        if (window.selectPlacement && window.commitPlacement) {
            window.selectPlacement(piece);
            window.commitPlacement(q, r);
        }
    }
    
    // Apply WASM movement move
    function applyWASMMovement(uhpMove) {
        console.log('🎯 Applying WASM movement:', uhpMove);
        
        // Parse movement (e.g., "wQ -bG1")
        const parts = uhpMove.split(' -');
        if (parts.length !== 2) {
            console.error('❌ Invalid movement format:', uhpMove);
            return;
        }
        
        const movingPiece = parts[0];
        const targetRef = parts[1];
        
        // Find the piece to move
        const color = movingPiece.charAt(0) === 'w' ? 'white' : 'black';
        const pieceType = movingPiece.charAt(1);
        
        const piece = window.tray.find(p => 
            p.meta.color === color && 
            p.meta.key === pieceType && 
            p.meta.placed
        );
        
        if (!piece) {
            console.error('❌ Could not find piece for movement:', uhpMove);
            return;
        }
        
        // Get legal move zones
        const legalMoves = window.legalMoveZones(piece);
        if (legalMoves.length === 0) {
            console.error('❌ No legal moves available for piece');
            return;
        }
        
        // For now, move to first available legal zone
        // TODO: Parse exact target position from UHP reference
        const firstMove = legalMoves[0];
        const [q, r] = firstMove.split(',').map(Number);
        
        console.log(`🎯 Moving ${color} ${pieceType} to (${q}, ${r})`);
        
        // Use existing movement system
        if (window.selectMove && window.commitMove) {
            window.selectMove(piece);
            window.commitMove(q, r);
        }
    }
    
    // Apply overrides when everything is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyOverrides);
    } else {
        applyOverrides();
    }
    
    // Also apply overrides after a delay to catch late initializations
    setTimeout(applyOverrides, 2000);
    
})();