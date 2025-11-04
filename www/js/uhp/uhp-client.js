// HYVEMYND UHP Client - Browser WebSocket client for UHP engines
// Connects to uhp-bridge.js and manages engine communication

(function() {
    'use strict';

    class HYVEMYNDUHPClient {
        constructor() {
            this.ws = null;
            this.pending = null;
            this.responseBuffer = [];
            this.connected = false;
            this.currentEngine = null;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            this.reconnectDelay = 3000;
            this.settings = this.loadSettings();
            
            // Bind methods to preserve 'this' context
            this.connect = this.connect.bind(this);
            this.handleMessage = this.handleMessage.bind(this);
            
            console.log('🐝 HYVEMYND UHP Client initializing...');
            this.connect();
        }

        loadSettings() {
            const defaults = {
                autoStart: true,
                defaultEngine: 'nokamute',
                timeLimit: 5,
                depthLimit: 4,
                mode: 'time', // 'time' or 'depth'
                enabled: false
            };
            
            const saved = localStorage.getItem('hyvemynd-uhp-settings');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        }

        saveSettings() {
            localStorage.setItem('hyvemynd-uhp-settings', JSON.stringify(this.settings));
        }

        connect() {
            try {
                const wsUrl = `ws://localhost:8081`;
                console.log(`🔗 Connecting to UHP Bridge: ${wsUrl}`);
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ UHP Bridge connected');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.updateConnectionStatus('Connected to UHP Bridge');
                    
                    // Auto-start engine if enabled
                    if (this.settings.autoStart) {
                        setTimeout(() => {
                            this.startEngine(this.settings.defaultEngine);
                        }, 500);
                    }
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('❌ Failed to parse UHP message:', error);
                    }
                };

                this.ws.onclose = () => {
                    console.log('🔌 UHP Bridge disconnected');
                    this.connected = false;
                    this.currentEngine = null;
                    this.updateConnectionStatus('Disconnected');
                    
                    // Auto-reconnect with exponential backoff
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                        console.log(`🔄 Reconnecting in ${delay/1000}s... (attempt ${this.reconnectAttempts})`);
                        setTimeout(this.connect, delay);
                    } else {
                        console.log('❌ Max reconnection attempts reached');
                        this.updateConnectionStatus('Connection failed - using built-in AI');
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ UHP WebSocket error:', error);
                };

            } catch (error) {
                console.log('❌ UHP Bridge not available:', error.message);
                this.connected = false;
                this.updateConnectionStatus('Offline - using built-in AI');
            }
        }

        handleMessage(data) {
            // Log engine communication in dev-ops if available
            if (window.logEngineMessage) {
                window.logEngineMessage(data);
            }

            switch (data.type) {
                case 'bridge-ready':
                    console.log('🐝 HYVEMYND UHP Bridge ready');
                    break;
                    
                case 'engine-line':
                    this.handleEngineLine(data.line);
                    break;
                    
                case 'engine-started':
                    this.currentEngine = data.engine;
                    console.log(`✅ Engine started: ${data.engine}`);
                    this.updateConnectionStatus(`${data.engine} engine ready`);
                    this.notifyEngineReady(data.engine);
                    break;
                    
                case 'engine-exit':
                    console.log(`❌ Engine ${data.engine} exited (code: ${data.code})`);
                    this.currentEngine = null;
                    this.updateConnectionStatus('Engine stopped');
                    break;
                    
                case 'engine-error':
                    console.error('❌ Engine error:', data.message);
                    this.updateConnectionStatus(`Engine error: ${data.message}`);
                    break;
                    
                case 'engines-list':
                    this.handleEnginesList(data.engines);
                    break;
                    
                case 'error':
                    console.error('❌ UHP Bridge error:', data.message);
                    this.updateConnectionStatus(`Error: ${data.message}`);
                    break;
                    
                case 'pong':
                    // Keep-alive response
                    break;
                    
                default:
                    console.log('🔍 Unknown UHP message:', data);
            }
        }

        handleEngineLine(line) {
            if (!this.pending) {
                // Unsolicited engine output
                console.log('🤖 Engine:', line);
                return;
            }

            this.responseBuffer.push(line);
            
            // Check if this completes the command
            if (line === 'ok' || line.startsWith('err') || line.startsWith('invalidmove')) {
                const resolve = this.pending;
                this.pending = null;
                const response = this.responseBuffer.slice();
                this.responseBuffer = [];
                resolve(response);
            }
        }

        async sendCommand(command) {
            return new Promise((resolve, reject) => {
                if (!this.connected) {
                    reject(new Error('UHP Bridge not connected'));
                    return;
                }

                if (this.pending) {
                    reject(new Error('Another command is pending'));
                    return;
                }

                this.pending = resolve;
                
                console.log('🎯 Sending UHP command:', command);
                this.ws.send(JSON.stringify({ type: 'command', data: command }));
                
                // Timeout after 30 seconds
                setTimeout(() => {
                    if (this.pending === resolve) {
                        this.pending = null;
                        this.responseBuffer = [];
                        reject(new Error('Command timeout'));
                    }
                }, 30000);
            });
        }

        async startEngine(engineType = 'nokamute') {
            if (!this.connected) {
                console.warn('⚠️  Cannot start engine - bridge not connected');
                return false;
            }

            try {
                console.log(`🚀 Starting ${engineType} engine...`);
                this.ws.send(JSON.stringify({ type: 'start-engine', engine: engineType }));
                this.updateConnectionStatus(`Starting ${engineType}...`);
                return true;
            } catch (error) {
                console.error('❌ Failed to start engine:', error);
                return false;
            }
        }

        async stopEngine() {
            if (!this.connected) return;
            
            console.log('🛑 Stopping engine...');
            this.ws.send(JSON.stringify({ type: 'stop-engine' }));
        }

        async listEngines() {
            if (!this.connected) return {};
            
            this.ws.send(JSON.stringify({ type: 'list-engines' }));
        }

        // Convert HYVEMYND game state to UHP GameString
        exportGameString() {
            try {
                console.log('🔍 Debug game state:', {
                    hasState: !!window.state,
                    move: window.state?.move,
                    current: window.state?.current,
                    gameOver: window.state?.gameOver
                });
                
                // Basic game type - can extend for expansions later
                const gameType = 'Base';
                
                // Determine game state
                let gameState = 'InProgress';
                if (window.state && window.state.gameOver) {
                    if (window.state.gameOver.winner === 'white') gameState = 'WhiteWins';
                    else if (window.state.gameOver.winner === 'black') gameState = 'BlackWins';
                    else gameState = 'Draw';
                } else if (window.state && window.state.move <= 1) {
                    gameState = 'NotStarted';
                }

                // Current turn: White[1], Black[1], White[2], etc.
                let turnNum = 1;
                if (window.state && typeof window.state.move === 'number' && window.state.move > 0) {
                    turnNum = Math.ceil(window.state.move / 2);
                }
                
                const currentPlayer = window.state ? window.state.current : 'white';
                const turnColor = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
                const turnString = `${turnColor}[${turnNum}]`;

                // Build move history (simplified for now)
                const moves = this.buildMoveHistory();
                
                // Include current position information for engine
                let gameString;
                if (moves.length > 0) {
                    gameString = `${gameType};${gameState};${turnString};${moves.join(';')}`;
                } else {
                    // For empty board, explicitly state it's the beginning
                    gameString = `${gameType};${gameState};${turnString}`;
                }
                
                console.log('📤 Exported GameString:', gameString);
                return gameString;
                
            } catch (error) {
                console.error('❌ Failed to export game string:', error);
                return 'Base;NotStarted;White[1]'; // Safe fallback
            }
        }

        buildMoveHistory() {
            const moves = [];
            
            try {
                // Use HYVEMYND's existing history system!
                if (!window.historySnapshots || window.historySnapshots.length === 0) {
                    console.log('🔍 No history snapshots found');
                    return moves;
                }
                
                console.log('🔍 Found', window.historySnapshots.length, 'history snapshots');
                console.log('🔍 History snapshots:', window.historySnapshots);
                
                // Skip the first snapshot (empty board) and process each move
                for (let i = 1; i < window.historySnapshots.length; i++) {
                    const prevSnapshot = window.historySnapshots[i - 1];
                    const currentSnapshot = window.historySnapshots[i];
                    
                    console.log(`🔍 Comparing snapshot ${i-1} to ${i}:`, {
                        prev: prevSnapshot?.pieces?.length || 0,
                        current: currentSnapshot?.pieces?.length || 0
                    });
                    
                    // Find the difference - what piece was added/moved
                    const newPieces = this.findNewPieces(prevSnapshot.pieces || [], currentSnapshot.pieces || []);
                    
                    if (newPieces.length > 0) {
                        console.log(`🔍 Found ${newPieces.length} new pieces:`, newPieces);
                        
                        // Convert each new piece to UHP notation
                        newPieces.forEach(piece => {
                            const uhpMove = this.convertToUHPMove(piece, i);
                            if (uhpMove) {
                                moves.push(uhpMove);
                            }
                        });
                    } else {
                        console.log(`🔍 No new pieces found between snapshots ${i-1} and ${i}`);
                    }
                }
                
                console.log('🔍 Built UHP move history:', moves);
                
                // Fallback: If no moves found but we know pieces are on the board, get current state
                if (moves.length === 0 && window.cells) {
                    console.log('🔍 No history moves found, checking current board state...');
                    
                    window.cells.forEach((cell, key) => {
                        if (cell && cell.stack && cell.stack.length > 0) {
                            cell.stack.forEach(piece => {
                                if (piece && piece.meta) {
                                    const color = piece.meta.color === 'white' ? 'w' : 'b';
                                    const pieceType = piece.meta.key;
                                    const pieceNum = piece.i || 1;
                                    const uhpMove = `${color}${pieceType}${pieceNum}`;
                                    
                                    if (!moves.includes(uhpMove)) {
                                        moves.push(uhpMove);
                                        console.log(`🔍 Added piece from board: ${uhpMove}`);
                                    }
                                }
                            });
                        }
                    });
                }
                
                return moves;
                
            } catch (error) {
                console.error('❌ Error building move history:', error);
                return [];
            }
        }
        
        // Find pieces that are new in the current snapshot vs previous
        findNewPieces(prevPieces, currentPieces) {
            const newPieces = [];
            
            currentPieces.forEach(currentPiece => {
                // Check if this piece exists in the previous snapshot at the same position
                const existsInPrev = prevPieces.some(prevPiece => 
                    prevPiece.meta.id === currentPiece.meta.id && 
                    prevPiece.meta.q === currentPiece.meta.q && 
                    prevPiece.meta.r === currentPiece.meta.r
                );
                
                if (!existsInPrev) {
                    newPieces.push(currentPiece);
                }
            });
            
            return newPieces;
        }
        
        // Convert HYVEMYND piece to UHP move notation
        convertToUHPMove(piece, moveIndex) {
            try {
                const color = piece.meta.color === 'white' ? 'w' : 'b';
                let pieceType = piece.meta.key;
                
                // Map HYVEMYND piece types to UHP (they should be the same)
                const pieceNum = piece.i || 1;
                
                // For placement moves, the format is just the piece notation
                // UHP uses piece positions relative to existing pieces, but for simplicity
                // we'll send just the piece and let the engine figure out valid placements
                const uhpNotation = `${color}${pieceType}${pieceNum}`;
                
                console.log(`🔍 Move ${moveIndex}: ${piece.meta.color} ${piece.meta.key}${piece.i} at (${piece.meta.q},${piece.meta.r}) → ${uhpNotation}`);
                
                return uhpNotation;
                
            } catch (error) {
                console.error('❌ Error converting piece to UHP:', piece, error);
                return null;
            }
        }

        // Get best move from engine
        async getBestMove() {
            if (!this.connected || !this.currentEngine) {
                console.log('🤖 Engine not available, using built-in AI');
                return this.fallbackToBuiltinAI();
            }

            try {
                console.log('🧠 Requesting best move from engine...');
                this.updateThinkingStatus(true);

                // Export current game state
                const gameString = this.exportGameString();
                console.log('📤 Sending to engine:', gameString);
                
                await this.sendCommand(`newgame ${gameString}`);
                
                // Request best move based on settings
                let command;
                if (this.settings.mode === 'time') {
                    const timeString = this.formatTime(this.settings.timeLimit);
                    command = `bestmove time ${timeString}`;
                } else {
                    command = `bestmove depth ${this.settings.depthLimit}`;
                }
                
                console.log('🎯 Engine command:', command);
                const response = await this.sendCommand(command);
                console.log('📬 Engine response:', response);
                
                // Find the move in response
                const moveString = response.find(line => 
                    line && line !== 'ok' && !line.startsWith('err') && !line.startsWith('invalidmove')
                );

                if (moveString && moveString !== 'pass') {
                    console.log('🎯 Engine recommends:', moveString);
                    const action = this.importMove(moveString);
                    
                    if (action) {
                        this.executeEngineMove(action);
                        return true;
                    } else {
                        console.warn('❌ Could not parse engine move');
                    }
                } else if (moveString === 'pass') {
                    console.log('🤖 Engine passes turn');
                    if (window.passTurn) window.passTurn();
                    return true;
                }

            } catch (error) {
                console.error('❌ Engine error:', error);
            } finally {
                this.updateThinkingStatus(false);
            }

            // Fallback to built-in AI
            return this.fallbackToBuiltinAI();
        }

        // Convert UHP MoveString to HYVEMYND action
        importMove(moveString) {
            if (!moveString || moveString === 'pass') return null;

            try {
                console.log('🔍 Parsing UHP move:', moveString);
                
                // Handle UHP move formats like "bS1 /wG1" or "bG1 wG1\"
                // Extract just the piece being moved (first part)
                const parts = moveString.trim().split(' ');
                const pieceKey = parts[0]; // e.g., "wS1", "bG2"
                
                // Parse piece identifier with regex for safety
                const pieceMatch = pieceKey.match(/^([wb])([QAGBS])(\d+)/);
                if (!pieceMatch) {
                    console.warn('❌ Invalid piece format:', pieceKey);
                    return null;
                }
                
                const [, colorCode, pieceType, pieceNum] = pieceMatch;
                const color = colorCode === 'w' ? 'white' : 'black';
                
                console.log(`🔍 Looking for: ${color} ${pieceType}${pieceNum}`);
                
                // Find matching piece in tray
                let piece = null;
                
                if (window.tray) {
                    // First try to find exact match (unplaced) - check both direct properties and meta
                    piece = window.tray.find(p => {
                        const pColor = p.color || p.meta?.color;
                        const pKey = p.key || p.meta?.key;
                        const pPlaced = p.placed || p.meta?.placed;
                        
                        return pColor === color && 
                               pKey === pieceType && 
                               !pPlaced;
                    });
                    
                    // If not found, try broader search (any piece of this type)
                    if (!piece) {
                        piece = window.tray.find(p => {
                            const pColor = p.color || p.meta?.color;
                            const pKey = p.key || p.meta?.key;
                            
                            return pColor === color && pKey === pieceType;
                        });
                        
                        if (piece) {
                            const pPlaced = piece.placed || piece.meta?.placed;
                            console.log(`🔍 Broad search found:`, `${piece.key || piece.meta?.key}${piece.i || piece.meta?.i} (placed: ${pPlaced})`);
                        } else {
                            console.log(`🔍 Broad search found: none`);
                        }
                    }
                    
                    // If still not found, try any available piece of that color
                    if (!piece) {
                        const availablePieces = window.tray.filter(p => {
                            const pColor = p.color || p.meta?.color;
                            const pPlaced = p.placed || p.meta?.placed;
                            return pColor === color && !pPlaced;
                        });
                        
                        console.log(`🔍 All available ${color} pieces:`, availablePieces.map(p => `${p.key || p.meta?.key}${p.i || p.meta?.i}`));
                        
                        // As last resort, just pick the first available piece of the right color
                        piece = availablePieces[0];
                        if (piece) {
                            console.log(`🔄 Using fallback piece: ${piece.key || piece.meta?.key}${piece.i || piece.meta?.i} instead of ${pieceType}`);
                        }
                    }
                }

                if (!piece) {
                    console.warn('❌ Could not find piece for:', `${color} ${pieceType}`);
                    
                    // Debug all pieces in tray
                    if (window.tray) {
                        console.log('🔍 Full tray contents:');
                        window.tray.forEach((p, index) => {
                            console.log(`  ${index}: ${p.color || p.meta?.color} ${p.key || p.meta?.key}${p.i || p.meta?.i} (placed: ${p.placed || p.meta?.placed}, id: ${p.id || p.meta?.id})`);
                            if (index === 0) {
                                console.log('🔍 First piece structure:', p);
                                if (p.meta) console.log('🔍 First piece meta:', p.meta);
                            }
                        });
                        
                        const available = window.tray
                            .filter(p => !(p.placed || p.meta?.placed))
                            .map(p => `${p.key || p.meta?.key}${p.i || p.meta?.i}`);
                        console.log(`🔍 Available ${color} pieces:`, available);
                    }
                    return null;
                }

                // Use legal placement zones for positioning
                if (window.legalPlacementZones) {
                    const legalZones = window.legalPlacementZones(color);
                    if (legalZones && legalZones.size > 0) {
                        const firstZone = Array.from(legalZones)[0];
                        const [q, r] = firstZone.split(',').map(Number);
                        
                        console.log(`🎯 Placing ${color} ${pieceType} at (${q}, ${r})`);
                        return { type: 'place', piece, q, r };
                    }
                }

                console.warn('❌ No legal placement zones available');
                return null;
            } catch (error) {
                console.error('❌ Failed to import move:', error);
                return null;
            }
        }

        executeEngineMove(action) {
            try {
                if (action.type === 'place' && window.selectPlacement && window.commitPlacement) {
                    console.log('🎯 Executing placement:', action);
                    window.selectPlacement(action.piece);
                    setTimeout(() => {
                        window.commitPlacement(action.q, action.r);
                    }, 100);
                } else if (action.type === 'move' && window.selectMove && window.commitMove) {
                    console.log('🎯 Executing movement:', action);
                    window.selectMove(action.piece);
                    setTimeout(() => {
                        window.commitMove(action.q, action.r);
                    }, 100);
                }
            } catch (error) {
                console.error('❌ Failed to execute engine move:', error);
                this.fallbackToBuiltinAI();
            }
        }

        fallbackToBuiltinAI() {
            console.log('🧠 Using built-in AI fallback');
            if (window.performAIAction) {
                setTimeout(() => window.performAIAction(), 200);
                return true;
            }
            return false;
        }

        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        updateConnectionStatus(status) {
            // Update any UI elements showing connection status
            if (window.updateUHPStatus) {
                window.updateUHPStatus(status);
            }
            console.log('🔗 UHP Status:', status);
        }

        updateThinkingStatus(thinking) {
            if (window.updateEngineThinking) {
                window.updateEngineThinking(thinking);
            }
        }

        notifyEngineReady(engineName) {
            if (window.onEngineReady) {
                window.onEngineReady(engineName);
            }
        }

        handleEnginesList(engines) {
            if (window.onEnginesList) {
                window.onEnginesList(engines);
            }
        }

        // Settings management
        setSetting(key, value) {
            this.settings[key] = value;
            this.saveSettings();
        }

        getSetting(key) {
            return this.settings[key];
        }

        isEnabled() {
            return this.settings.enabled && this.connected && this.currentEngine;
        }
    }

    // Initialize UHP client globally
    window.uhpClient = new HYVEMYNDUHPClient();
    
    console.log('🐝 HYVEMYND UHP Client loaded');

})();