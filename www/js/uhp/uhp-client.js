// HYVEMYND UHP Client - Browser WebSocket client for UHP engines
// Connects to uhp-bridge.js and manages engine communication

(function() {
    'use strict';

    class HYVEMYNDUHPClient {
        constructor() {
            this.ws = null;
            this.pending = null;
            this.pendingCommand = null;
            this.responseBuffer = [];
            this.connected = false;
            this.currentEngine = null;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            // Track UHP piece numbering by PLACEMENT ORDER (chronological)
            this.uhpPieceMap = new Map(); // Maps "color_pieceType_uhpNumber" to piece object
            this.uhpCounters = {}; // Tracks next UHP number for each color_pieceType
            this.placementOrder = []; // Chronological record of all piece placements
            this.reconnectDelay = 3000;
            this.isConnecting = false; // Track if we're currently trying to connect
            this.lastRecommendedMove = null; // Track last move to prevent duplicates
            this.settings = this.loadSettings();
            
            // Failure tracking to prevent infinite loops
            this.consecutiveFailures = 0;
            this.maxConsecutiveFailures = 3;
            this.lastFailedGameState = null;
            
            // Command queue management to prevent concurrent commands
            this.commandQueue = [];
            this.isProcessingCommand = false;
            this.isFallbackActive = false;
            
            // Bind methods to preserve 'this' context
            this.connect = this.connect.bind(this);
            this.handleMessage = this.handleMessage.bind(this);
            
            // Health check interval for maintaining connection - disabled for WASM-only mode
            this.healthCheckInterval = null;
            // this.startHealthCheck(); // Disabled - WASM doesn't need WebSocket health checks
            
            console.log('🐝 HYVEMYND UHP Client initializing (WASM mode - no WebSocket needed)...');
            
            // WASM mode: Keep UHP protocol parsing but skip WebSocket connection
            // The UHP protocol is still used for move notation, just no network communication
            console.log('🧩 UHP protocol parser ready for WASM engine integration');
            
            // Set initial status for WASM mode
            this.updateConnectionStatus('WASM Engine Ready - UHP Protocol Active');
            
            // Make sure the global uhpClient is available for AI systems
            window.uhpClient = this;
            
            // Track UHP moves by move number for history display
            this.uhpMoveHistory = new Map(); // moveNumber -> uhpMove
        }

        /**
         * Validate piece mobility for current player to catch pinned pieces
         * Returns count of pieces that can actually move
         */
        validatePieceMobility(color) {
            if (!window.legalMoveZones || !window.tray) {
                console.warn('🔍 Mobility validation: Required functions not available');
                return 0;
            }

            const placedPieces = window.tray.filter(p => 
                p.meta && p.meta.color === color && p.meta.placed
            );

            let mobilePieceCount = 0;
            const pinnedPieces = [];

            for (const piece of placedPieces) {
                try {
                    const moveZones = window.legalMoveZones(piece);
                    const zones = Array.isArray(moveZones) ? moveZones : Array.from(moveZones);
                    
                    if (zones.length > 0) {
                        mobilePieceCount++;
                        console.log(`🔍 Mobile: ${piece.meta.key} at (${piece.meta.q},${piece.meta.r}) - ${zones.length} moves`);
                    } else {
                        pinnedPieces.push(`${piece.meta.key}@(${piece.meta.q},${piece.meta.r})`);
                    }
                } catch (error) {
                    console.warn(`🔍 Error checking mobility for ${piece.meta.key}:`, error);
                }
            }

            if (pinnedPieces.length > 0) {
                console.log(`🔍 Pinned pieces for ${color}:`, pinnedPieces);
            }

            return mobilePieceCount;
        }

        /**
         * Record a piece placement in chronological order for correct UHP numbering
         */
        recordPiecePlacement(piece, q, r, moveNumber) {
            const color = piece.meta?.color || piece.color;
            const pieceType = piece.meta?.key || piece.key;
            
            // Initialize counter if needed
            const counterKey = `${color}_${pieceType}`;
            if (!this.uhpCounters[counterKey]) {
                this.uhpCounters[counterKey] = 0;
            }
            
            // Increment placement counter for this piece type
            this.uhpCounters[counterKey]++;
            const uhpNumber = this.uhpCounters[counterKey];
            
            // Generate UHP piece ID (Queens don't have numbers)
            const uhpId = pieceType === 'Q' ? 
                `${color.charAt(0)}Q` : 
                `${color.charAt(0)}${pieceType}${uhpNumber}`;
            
            // Store in placement order tracking
            const placementRecord = {
                moveNumber: moveNumber,
                piece: piece,
                uhpId: uhpId,
                color: color,
                pieceType: pieceType,
                uhpNumber: uhpNumber,
                position: { q: q, r: r }
            };
            
            this.placementOrder.push(placementRecord);
            
            // Store in UHP piece map for quick lookup
            const mapKey = `${color}_${pieceType}_${uhpNumber}`;
            this.uhpPieceMap.set(mapKey, {
                piece: piece,
                position: `${q},${r}`,
                uhpId: uhpId,
                placementOrder: uhpNumber
            });
            
            console.log(`📝 Recorded placement: ${uhpId} at (${q}, ${r}) - move ${moveNumber} - placement order ${uhpNumber}`);
            return uhpId;
        }

        /**
         * Get piece by UHP placement order (chronological numbering)
         */
        getPieceByUHPId(uhpKey) {
            console.log(`🔍 Looking up UHP piece: ${uhpKey}`);
            
            // Parse UHP key format (e.g., "bG2" -> black grasshopper #2)
            const match = uhpKey.match(/^([wb])([QAGBS])(\d*)$/);
            if (!match) {
                console.warn(`❌ Invalid UHP key format: ${uhpKey}`);
                return null;
            }
            
            const [, colorCode, pieceType, numberStr] = match;
            const color = colorCode === 'w' ? 'white' : 'black';
            const uhpNumber = numberStr ? parseInt(numberStr) : 1;
            
            // Look up in placement order tracking
            const mapKey = `${color}_${pieceType}_${uhpNumber}`;
            if (this.uhpPieceMap.has(mapKey)) {
                const data = this.uhpPieceMap.get(mapKey);
                console.log(`✅ Found UHP piece ${uhpKey}: ${data.uhpId} at ${data.position}`);
                return data;
            }
            
            // Fallback: search placement order chronologically
            const matchingPlacements = this.placementOrder.filter(p => 
                p.color === color && p.pieceType === pieceType
            );
            
            if (uhpNumber > 0 && uhpNumber <= matchingPlacements.length) {
                const placement = matchingPlacements[uhpNumber - 1]; // Convert to 0-based
                console.log(`✅ Found via placement order: ${uhpKey} -> ${placement.uhpId}`);
                return {
                    piece: placement.piece,
                    position: `${placement.position.q},${placement.position.r}`,
                    uhpId: placement.uhpId,
                    placementOrder: placement.uhpNumber
                };
            }
            
            console.warn(`❌ UHP piece not found: ${uhpKey} (looking for ${color} ${pieceType} #${uhpNumber})`);
            console.warn(`   Available ${color} ${pieceType}:`, matchingPlacements.map(p => p.uhpId));
            return null;
        }

        /**
         * Get the current turn color from game state
         */
        getCurrentTurnColor() {
            if (window.state && typeof window.state.current === 'string') {
                return window.state.current;
            }
            
            // Fallback: determine from move count
            const gameState = this.exportGameState();
            if (gameState && gameState.hasState) {
                return gameState.current || 'white';
            }
            
            return 'white'; // Default fallback
        }

        /**
         * Find piece object at a specific board position
         */
        findPieceByPosition(q, r) {
            if (!window.tray) return null;
            
            return window.tray.find(p => 
                p.meta && p.meta.placed && p.meta.q === q && p.meta.r === r
            );
        }

        getUHPMoveForTurn(moveNumber) {
            return this.uhpMoveHistory.get(moveNumber) || '';
        }

        getLastUHPMove() {
            // Get the most recent move
            if (this.uhpMoveHistory.size === 0) return '';
            const lastMoveNumber = Math.max(...this.uhpMoveHistory.keys());
            return this.uhpMoveHistory.get(lastMoveNumber) || '';
        }

        loadSettings() {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            const defaults = {
                autoStart: isLocalhost, // Only auto-start on localhost
                defaultEngine: 'nokamute',
                timeLimit: 5,
                depthLimit: 4,
                mode: 'time', // 'time' or 'depth'
                enabled: true, // Enable by default for WASM mode
                aiColor: 'black' // AI plays black in single player mode
            };
            
            const saved = localStorage.getItem('hyvemynd-uhp-settings');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        }

        saveSettings() {
            localStorage.setItem('hyvemynd-uhp-settings', JSON.stringify(this.settings));
        }

        startHealthCheck() {
            // Check connection health every 30 seconds
            this.healthCheckInterval = setInterval(() => {
                this.performHealthCheck();
            }, 30000);
        }

        performHealthCheck() {
            // Check if we should try to connect/reconnect
            const hostname = window.location.hostname;
            const isLocalDev = hostname === 'localhost' || 
                             hostname === '127.0.0.1' || 
                             hostname.startsWith('192.168.') ||
                             hostname === '' ||
                             window.location.port === '8000';
            
            if (!isLocalDev) {
                // Skip health check for remote servers
                return;
            }
            
            // Don't interfere if already trying to connect
            if (this.isConnecting) {
                return;
            }
            
            // If not connected and haven't exceeded max attempts, try to reconnect
            if (!this.connected && this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log('🔄 Health check: Attempting to restore UHP connection...');
                this.connect();
            }
            
            // Reset reconnect attempts after successful quiet period
            if (this.connected && this.reconnectAttempts > 0) {
                console.log('🔧 Resetting reconnect attempts after successful connection');
                this.reconnectAttempts = 0;
            }
        }

        connect() {
            try {
                // Prevent multiple simultaneous connection attempts
                if (this.isConnecting) {
                    return;
                }
                
                this.isConnecting = true;
                
                // Skip UHP if running on remote server (like Render) - but allow localhost and dev servers
                const hostname = window.location.hostname;
                const isLocalDev = hostname === 'localhost' || 
                                 hostname === '127.0.0.1' || 
                                 hostname.startsWith('192.168.') ||
                                 hostname === '' ||
                                 window.location.port === '8000'; // Allow our dev server
                
                // Skip UHP connection entirely if we have working WASM engine
                // This prevents the spam of connection errors when WASM AI is working fine
                if (window.wasmEngine && window.wasmEngine.isAvailable()) {
                    console.log(`🧩 WASM engine available - skipping UHP connection`);
                    this.connected = false;
                    this.isConnecting = false;
                    this.updateConnectionStatus('Using WASM engine - UHP not needed');
                    return;
                }
                
                if (!isLocalDev) {
                    console.log(`🌐 Running on remote server (${hostname}) - UHP bridge not available`);
                    this.connected = false;
                    this.isConnecting = false;
                    this.updateConnectionStatus('Remote server - using built-in AI');
                    return;
                }
                
                const wsUrl = `ws://localhost:8080`;
                console.log(`🔗 Connecting to UHP Bridge: ${wsUrl} (from ${hostname}:${window.location.port})`);
                
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ UHP Bridge connected');
                    this.connected = true;
                    this.isConnecting = false;
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
                    this.isConnecting = false;
                    this.currentEngine = null;
                    this.updateConnectionStatus('Disconnected');
                    
                    // More persistent reconnection - don't give up entirely
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                        console.log(`🔄 Reconnecting in ${delay/1000}s... (attempt ${this.reconnectAttempts})`);
                        setTimeout(this.connect, delay);
                    } else {
                        console.log('⏸️ Max consecutive reconnection attempts reached - will retry via health check');
                        this.updateConnectionStatus('Offline - using built-in AI (will retry periodically)');
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ UHP WebSocket error:', error);
                    this.isConnecting = false;
                };

            } catch (error) {
                console.log('❌ UHP Bridge not available:', error.message);
                this.connected = false;
                this.isConnecting = false;
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
            const isTerminalResponse = line === 'ok' || line.startsWith('err') || line.startsWith('invalidmove');
            
            // For bestmove commands, we need to wait for the actual move, not just "ok"
            if (this.pendingCommand && this.pendingCommand.startsWith('bestmove')) {
                // For bestmove, only complete when we get a move (not just "ok") or an error
                const hasMove = this.responseBuffer.some(l => 
                    l && l !== 'ok' && !l.startsWith('err') && !l.startsWith('invalidmove')
                );
                
                if (isTerminalResponse && hasMove) {
                    // We have both a move and a terminal response - command complete
                    const resolve = this.pending;
                    this.pending = null;
                    this.pendingCommand = null;
                    const response = this.responseBuffer.slice();
                    this.responseBuffer = [];
                    resolve(response);
                    
                    // Process next queued command
                    this.processCommandQueue();
                } else if (line.startsWith('err') || line.startsWith('invalidmove')) {
                    // Error responses complete immediately even for bestmove
                    const resolve = this.pending;
                    this.pending = null;
                    this.pendingCommand = null;
                    const response = this.responseBuffer.slice();
                    this.responseBuffer = [];
                    resolve(response);
                    
                    // Process next queued command
                    this.processCommandQueue();
                }
            } else {
                // For other commands, complete on any terminal response
                if (isTerminalResponse) {
                    const resolve = this.pending;
                    this.pending = null;
                    this.pendingCommand = null;
                    const response = this.responseBuffer.slice();
                    this.responseBuffer = [];
                    resolve(response);
                    
                    // Process next queued command
                    this.processCommandQueue();
                }
            }
        }

        async sendCommand(command) {
            return new Promise((resolve, reject) => {
                if (!this.connected) {
                    reject(new Error('UHP Bridge not connected'));
                    return;
                }

                if (this.pending) {
                    // Queue the command instead of immediately rejecting
                    console.log('🔄 Queuing command:', command);
                    this.commandQueue.push({ command, resolve, reject });
                    return;
                }

                this.executeCommand(command, resolve, reject);
            });
        }

        executeCommand(command, resolve, reject) {
            this.pending = resolve;
            this.pendingCommand = command;
            
            console.log('🎯 Sending UHP command:', command);
            this.ws.send(JSON.stringify({ type: 'command', data: command }));
            
            // Timeout after 30 seconds
            setTimeout(() => {
                    if (this.pending === resolve) {
                        this.pending = null;
                        this.pendingCommand = null;
                        this.responseBuffer = [];
                        reject(new Error('Command timeout'));
                        // Process next queued command even on timeout
                        this.processCommandQueue();
                    }
                }, 30000);
        }

        processCommandQueue() {
            if (this.commandQueue.length > 0 && !this.pending) {
                const { command, resolve, reject } = this.commandQueue.shift();
                console.log('🔄 Processing queued command:', command);
                this.executeCommand(command, resolve, reject);
            }
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

                // Build move history first to get actual game state
                const allMoves = this.buildMoveHistory();
                
                // Calculate turn based on actual moves played
                const currentPlayer = window.state ? window.state.current : 'white';
                let turnNum = 1;
                let turnColor = 'White';
                
                // For UHP, we send the current board state (all moves played so far)
                // The turn string indicates whose turn it is to move next
                const movesToSend = allMoves.slice(); // Include all moves
                
                if (allMoves.length > 0) {
                    // Count moves by each player to determine turn number
                    const whiteMoves = allMoves.filter(move => move.startsWith('w')).length;
                    const blackMoves = allMoves.filter(move => move.startsWith('b')).length;
                    
                    // UHP format: Color[X] means that Color just completed move X
                    // If it's black's turn, then white just completed their move
                    if (currentPlayer === 'black') {
                        // White just completed their turn
                        turnNum = whiteMoves;
                        turnColor = 'White';
                    } else {
                        // Black just completed their turn  
                        turnNum = blackMoves;
                        turnColor = 'Black';
                    }
                } else {
                    turnColor = 'White'; // Game starts with white
                    turnNum = 1;
                }
                
                const turnString = `${turnColor}[${turnNum}]`;
                
                console.log(`🔍 Turn calculation: total=${allMoves.length}, sending=${movesToSend.length}, white=${allMoves.filter(m=>m.startsWith('w')).length}, black=${allMoves.filter(m=>m.startsWith('b')).length}, current=${currentPlayer}, turnNum=${turnNum}, turnString=${turnString}`);
                console.log(`🔍 All moves: [${allMoves.join(', ')}]`);
                console.log(`🔍 Moves to send: [${movesToSend.join(', ')}]`);
                
                // Include current position information for engine
                let gameString;
                if (movesToSend.length > 0) {
                    gameString = `${gameType};${gameState};${turnString};${movesToSend.join(';')}`;
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
            try {
                console.log('🐝 Building UHP move history - using recorded moves in correct order');
                
                const moves = [];
                
                // First, try to use the recorded move history if we have it
                if (this.uhpMoveHistory.size > 0) {
                    console.log('🎯 Using recorded move history:', this.uhpMoveHistory.size, 'moves');
                    
                    // Get moves in chronological order (1, 2, 3, 4, 5, ...)
                    const maxMoveNum = Math.max(...this.uhpMoveHistory.keys());
                    for (let i = 1; i <= maxMoveNum; i++) {
                        if (this.uhpMoveHistory.has(i)) {
                            const move = this.uhpMoveHistory.get(i);
                            moves.push(move);
                            console.log(`✅ Recorded move ${i}: ${move}`);
                        }
                    }
                } else {
                    console.log('🎯 No recorded moves, falling back to virtual placement system');
                    
                    // Fallback: build from board state (keep existing logic as backup)
                    const pieceCounters = {};
                    
                    // Get all pieces currently on the board and treat them as placements
                    if (window.cells) {
                        const placedPieces = [];
                        
                        // Collect all pieces from board
                        window.cells.forEach((cell, key) => {
                            if (cell && cell.stack && cell.stack.length > 0) {
                                cell.stack.forEach((piece) => {
                                    const color = piece.color || piece.meta?.color;
                                    const pieceKey = piece.key || piece.meta?.key;
                                    const placed = piece.placed || piece.meta?.placed;
                                    
                                    if (color && pieceKey && placed) {
                                        placedPieces.push({
                                            color,
                                            key: pieceKey,
                                            q: cell.q,
                                            r: cell.r,
                                            id: piece.id || `${color}_${pieceKey}_${piece.i || 1}`
                                        });
                                    }
                                });
                            }
                        });
                        
                        console.log('🎯 Current board pieces:', placedPieces.length);
                        
                        // Sort by some logical order (maybe by distance from origin or move order)
                        placedPieces.sort((a, b) => {
                            // Sort by distance from origin, then by color
                            const distA = Math.abs(a.q) + Math.abs(a.r);
                            const distB = Math.abs(b.q) + Math.abs(b.r);
                            if (distA !== distB) return distA - distB;
                            return a.color.localeCompare(b.color);
                        });
                        
                        // Convert each piece to UHP placement notation
                        const playedPieces = []; // For reference tracking
                        
                        placedPieces.forEach((piece, index) => {
                            const colorPrefix = piece.color === 'white' ? 'w' : 'b';
                            const pieceKey = colorPrefix + piece.key;
                            
                            // Increment counter for this piece type (UHP standard: number by placement order)
                            pieceCounters[pieceKey] = (pieceCounters[pieceKey] || 0) + 1;
                            const uhpPieceId = piece.key === 'Q' ? 
                                `${colorPrefix}Q` : 
                                `${colorPrefix}${piece.key}${pieceCounters[pieceKey]}`;
                            
                            console.log(`🏷️ UHP ID: ${uhpPieceId} for ${piece.key} (placement order ${pieceCounters[pieceKey]}, piece.meta.i=${piece.meta?.i})`);
                            
                            let moveString;
                            const moveNumber = index + 1; // Move numbers start at 1
                            
                            if (moves.length === 0) {
                                // First piece is always just the piece ID
                                moveString = uhpPieceId;
                                moves.push(moveString);
                                console.log(`✅ Virtual placement ${moveNumber}: ${moveString} (first piece)`);
                            } else {
                                // Build relative placement notation
                                const mockPiece = {
                                    position: { q: piece.q, r: piece.r },
                                    color: piece.color,
                                    key: piece.key
                                };
                                moveString = this.buildUHPPositionalMove(uhpPieceId, mockPiece, playedPieces);
                                moves.push(moveString);
                                console.log(`✅ Virtual placement ${moveNumber}: ${moveString}`);
                            }
                            
                            // Add to tracking for future reference calculations
                            playedPieces.push({
                                uhpId: uhpPieceId,
                                q: piece.q,
                                r: piece.r,
                                color: piece.color,
                                type: piece.key
                            });
                        });
                    }
                }
                
                console.log('🐝 Final UHP move history (chronological order):', moves);
                return moves;
                
            } catch (error) {
                console.error('❌ Failed to build move history:', error);
                return [];
            }
        }

        // Find piece that moved in our historical tracking
        findMovedPieceInHistory(color, pieceType, fromQ, fromR, playedPieces) {
            console.log(`🔍 Finding moved piece: ${color} ${pieceType} from (${fromQ}, ${fromR}) in history`);
            
            // Look for a piece of this color/type that was at the fromPosition
            for (const piece of playedPieces) {
                if (piece.color === color && piece.type === pieceType && 
                    piece.q === fromQ && piece.r === fromR) {
                    console.log(`✅ Found moved piece in history: ${piece.uhpId}`);
                    return piece;
                }
            }
            
            // If not found by exact position, try to find by piece identity and update position
            // This happens when the piece has moved previously but our tracking is out of sync
            console.log(`🔧 Position not found, searching by piece identity for ${color} ${pieceType}`);
            
            // Get piece count for this type
            const colorPrefix = color === 'white' ? 'w' : 'b';
            const sameTypeCount = playedPieces.filter(p => p.color === color && p.type === pieceType).length;
            
            if (sameTypeCount === 1) {
                // Only one piece of this type, must be it
                const piece = playedPieces.find(p => p.color === color && p.type === pieceType);
                if (piece) {
                    console.log(`✅ Found unique piece by type: ${piece.uhpId}, updating position from (${piece.q}, ${piece.r}) to (${fromQ}, ${fromR})`);
                    piece.q = fromQ;
                    piece.r = fromR;
                    return piece;
                }
            } else if (sameTypeCount > 1) {
                // Multiple pieces, need to check actual board state
                console.log(`🔧 Multiple ${color} ${pieceType} pieces exist, checking board state`);
                if (window.cells) {
                    const cell = window.cells.get(`${fromQ},${fromR}`);
                    if (cell && cell.stack && cell.stack.length > 0) {
                        const boardPiece = cell.stack[cell.stack.length - 1]; // Top piece
                        const boardColor = boardPiece.color || boardPiece.meta?.color;
                        const boardType = boardPiece.key || boardPiece.meta?.key;
                        
                        if (boardColor === color && boardType === pieceType) {
                            // Find the matching piece in playedPieces and update position
                            const pieceId = boardPiece.id || `${color}_${pieceType}_${boardPiece.i || 1}`;
                            for (const piece of playedPieces) {
                                if (piece.uhpId.includes(pieceType) && piece.color === color) {
                                    // Check if this could be the right piece by process of elimination
                                    piece.q = fromQ;
                                    piece.r = fromR;
                                    console.log(`✅ Updated piece position: ${piece.uhpId} now at (${fromQ}, ${fromR})`);
                                    return piece;
                                }
                            }
                        }
                    }
                }
            }
            
            console.warn(`❌ Could not find moved piece ${color} ${pieceType} at (${fromQ}, ${fromR}) in history`);
            return null;
        }

        // Find a piece that has moved from one position to another
        findMovedPiece(color, pieceName, fromQ, fromR, toQ, toR, playedPieces) {
            // Map piece name to type
            const pieceMap = {
                'grasshopper': 'G', 'spider': 'S', 'beetle': 'B', 'ant': 'A', 'queen': 'Q'
            };
            const pieceType = pieceMap[pieceName.toLowerCase()];
            
            // Find the piece in playedPieces that was at fromQ,fromR and should now be at toQ,toR
            for (const played of playedPieces) {
                if (played.q === fromQ && played.r === fromR) {
                    // Check if this piece matches the type and color
                    const uhpColor = played.uhpId.charAt(0); // 'w' or 'b'
                    const uhpType = played.uhpId.charAt(1); // piece type letter
                    const expectedColor = color === 'white' ? 'w' : 'b';
                    
                    if (uhpColor === expectedColor && uhpType === pieceType) {
                        console.log(`🔍 Found moved piece: ${played.uhpId} from (${fromQ}, ${fromR}) to (${toQ}, ${toR})`);
                        return { uhpId: played.uhpId, piece: played.piece };
                    }
                }
            }
            
            console.warn(`❌ Could not find moved piece: ${color} ${pieceName} from (${fromQ}, ${fromR})`);
            return null;
        }

        // Build UHP movement notation like "bA1 \wG2"
        buildMovementNotation(uhpId, toQ, toR, playedPieces) {
            console.log(`🧭 Building movement notation for ${uhpId} to (${toQ}, ${toR})`);
            console.log(`🧭 Available reference pieces:`, playedPieces.map(p => `${p.uhpId} at (${p.q}, ${p.r})`));
            
            // Find adjacent reference piece (must exist due to one-hive rule)
            let bestRef = null;
            
            for (const played of playedPieces) {
                // Skip the piece that's moving
                if (played.uhpId === uhpId) continue;
                
                // Proper hex distance calculation
                const dq = played.q - toQ;
                const dr = played.r - toR;
                const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
                console.log(`🧭 Distance from ${played.uhpId} at (${played.q}, ${played.r}) to destination: ${distance}`);
                
                // Look for adjacent piece (distance 1) - must exist due to one-hive rule
                if (distance === 1) {
                    bestRef = played;
                    console.log(`🧭 Found adjacent reference: ${bestRef.uhpId} at (${bestRef.q}, ${bestRef.r})`);
                    break; // Use first adjacent piece found
                }
            }
            
            if (!bestRef) {
                console.error('❌ No adjacent reference piece found - this violates the one-hive rule!');
                return null;
            }
            
            // Calculate direction from reference to destination
            const deltaQ = toQ - bestRef.q;
            const deltaR = toR - bestRef.r;
            
            console.log(`🧭 Movement: ${uhpId} from ${bestRef.uhpId} at (${bestRef.q}, ${bestRef.r}) to (${toQ}, ${toR})`);
            console.log(`🧭 Delta: (${deltaQ}, ${deltaR})`);
            
            // UHP Movement Notation: POSITIONAL/VISUAL direction mapping
            // Directions are visual pointers relative to the reference piece:
            // / = northeast pointer, \ = northwest pointer, - = horizontal pointer
            // Position determines which side of the symbol the piece appears on
            
            let moveNotation = '';
            
            if (deltaQ === 0 && deltaR === -1) {
                // North (straight up): piece/
                moveNotation = `${uhpId} ${bestRef.uhpId}/`;
                console.log(`🎯 North: ${uhpId} ${bestRef.uhpId}/`);
            } else if (deltaQ === 1 && deltaR === -1) {
                // NorthEast: piece-
                moveNotation = `${uhpId} ${bestRef.uhpId}-`;
                console.log(`🎯 NorthEast: ${uhpId} ${bestRef.uhpId}-`);
            } else if (deltaQ === 1 && deltaR === 0) {
                // SouthEast: piece\
                moveNotation = `${uhpId} ${bestRef.uhpId}\\`;
                console.log(`🎯 SouthEast: ${uhpId} ${bestRef.uhpId}\\`);
            } else if (deltaQ === 0 && deltaR === 1) {
                // South (straight down): piece /reference
                moveNotation = `${uhpId} /${bestRef.uhpId}`;
                console.log(`🎯 South: ${uhpId} /${bestRef.uhpId}`);
            } else if (deltaQ === -1 && deltaR === 1) {
                // SouthWest: piece -reference
                moveNotation = `${uhpId} -${bestRef.uhpId}`;
                console.log(`🎯 SouthWest: ${uhpId} -${bestRef.uhpId}`);
            } else if (deltaQ === -1 && deltaR === 0) {
                // NorthWest: piece \reference
                moveNotation = `${uhpId} \\${bestRef.uhpId}`;
                console.log(`🎯 NorthWest: ${uhpId} \\${bestRef.uhpId}`);
            } else {
                console.error(`❌ Invalid delta (${deltaQ}, ${deltaR}) for adjacent pieces`);
                return null;
            }
            
            console.log(`🔧 Built movement notation: ${moveNotation}`);
            return moveNotation;
        }

        // Find actual piece that was played at specific coordinates
        findActualPlayedPieceAtPosition(color, pieceType, moveIndex, targetQ, targetR) {
            console.log(`🔍 Finding actual piece: ${color} ${pieceType} for move ${moveIndex} at (${targetQ}, ${targetR})`);
            
            // Look for piece at exact coordinates
            const cellKey = `${targetQ},${targetR}`;
            const cell = window.cells.get(cellKey);
            
            if (cell && cell.stack && cell.stack.length > 0) {
                for (const piece of cell.stack) {
                    if (piece && (piece.placed || piece.meta?.placed)) {
                        const pColor = piece.color || piece.meta?.color;
                        const pKey = piece.key || piece.meta?.key;
                        
                        console.log(`🔍 Checking piece at (${targetQ}, ${targetR}): ${pColor} ${pKey} (placed: ${piece.placed || piece.meta?.placed})`);
                        
                        if (pColor === color && pKey === pieceType) {
                            console.log(`✅ Found exact match ${color} ${pieceType} at (${targetQ}, ${targetR})`);
                            return {
                                piece: piece,
                                position: { q: targetQ, r: targetR },
                                cellKey: cellKey,
                                stackIndex: 0
                            };
                        }
                    }
                }
            }
            
            console.log(`❌ No ${color} ${pieceType} found at (${targetQ}, ${targetR})`);
            return null;
        }

        // Find actual piece that was played (fallback method)
        findActualPlayedPiece(color, pieceType, moveIndex) {
            // Find the piece that was actually played at this move index
            console.log(`🔍 Finding actual piece: ${color} ${pieceType} for move ${moveIndex}`);
            
            if (!window.cells) {
                console.log(`🔍 No cells available`);
                return null;
            }
            
            const placedPieces = [];
            
            // Collect all placed pieces of the requested type and color
            window.cells.forEach((cell, key) => {
                if (cell && cell.stack && cell.stack.length > 0) {
                    cell.stack.forEach((piece, stackIndex) => {
                        if (piece && (piece.placed || piece.meta?.placed)) {
                            const pColor = piece.color || piece.meta?.color;
                            const pKey = piece.key || piece.meta?.key;
                            
                            console.log(`🔍 Checking piece at (${cell.q}, ${cell.r}): ${pColor} ${pKey} (placed: ${piece.placed || piece.meta?.placed})`);
                            
                            if (pColor === color && pKey === pieceType) {
                                placedPieces.push({
                                    piece: piece,
                                    position: { q: cell.q, r: cell.r },
                                    cellKey: key,
                                    stackIndex: stackIndex
                                });
                                console.log(`✅ Found matching ${color} ${pieceType} at (${cell.q}, ${cell.r})`);
                            }
                        }
                    });
                }
            });
            
            console.log(`🔍 Found ${placedPieces.length} placed ${color} ${pieceType} pieces total`);
            
            if (placedPieces.length === 0) {
                console.log(`❌ No placed pieces found for ${color} ${pieceType}`);
                return null;
            }
            
            // For move ordering, alternate between white and black
            // Move 0 = white 1st, Move 1 = black 1st, Move 2 = white 2nd, etc.
            const isWhite = color === 'white';
            const colorMoveIndex = isWhite ? Math.floor(moveIndex / 2) : Math.floor((moveIndex - 1) / 2);
            
            console.log(`🔍 Move ${moveIndex}: ${color} piece #${colorMoveIndex + 1}`);
            
            // Sort pieces by some consistent order (coordinate-based for determinism)
            placedPieces.sort((a, b) => {
                const aCoord = a.position.q + a.position.r * 1000;
                const bCoord = b.position.q + b.position.r * 1000;
                return aCoord - bCoord;
            });
            
            // Return the piece for this move index
            const targetPiece = placedPieces[colorMoveIndex] || placedPieces[0];
            
            if (targetPiece) {
                console.log(`✅ Selected ${color} ${pieceType} at (${targetPiece.position.q}, ${targetPiece.position.r})`);
            }
            
            return targetPiece;
        }

        buildUHPPositionalMove(uhpPieceId, actualPiece, playedPieces) {
            // Build UHP move with proper relative positioning
            console.log(`🔧 Building UHP move for ${uhpPieceId}`, { actualPiece, playedPieces: playedPieces.length });
            
            if (!actualPiece || !actualPiece.position || playedPieces.length === 0) {
                // Fallback to simple relative placement
                const lastPiece = playedPieces[playedPieces.length - 1];
                console.log(`🔧 Using fallback positioning relative to ${lastPiece.uhpId}`);
                return `${uhpPieceId} ${lastPiece.uhpId}/`;
            }
            
            // Get the actual position of this piece
            const myPos = actualPiece.position;
            console.log(`🔧 My position: (${myPos.q}, ${myPos.r})`);
            
            // Find the best reference piece (prefer adjacent pieces)
            let bestReference = null;
            let minDistance = Infinity;
            let adjacentPieces = [];
            
            for (const placedPiece of playedPieces) {
                // Use direct q,r coordinates from our historical tracking
                const refQ = placedPiece.q;
                const refR = placedPiece.r;
                const distance = Math.abs(myPos.q - refQ) + Math.abs(myPos.r - refR);
                
                console.log(`🔧 Distance to ${placedPiece.uhpId} at (${refQ}, ${refR}): ${distance}`);
                
                // Collect all adjacent pieces (distance = 1)
                if (distance === 1) {
                    adjacentPieces.push(placedPiece);
                    console.log(`✅ Found adjacent piece: ${placedPiece.uhpId}`);
                }
                
                // Track closest piece as backup
                if (distance < minDistance) {
                    minDistance = distance;
                    bestReference = placedPiece;
                }
            }
            
            // Use the first adjacent piece if any exist
            if (adjacentPieces.length > 0) {
                bestReference = adjacentPieces[0];
                minDistance = 1;
                console.log(`🎯 Using adjacent reference: ${bestReference.uhpId}`);
            }
            
            if (!bestReference) {
                // No reference found, use last piece
                const lastPiece = playedPieces[playedPieces.length - 1];
                console.log(`🔧 No reference found, using last piece ${lastPiece.uhpId}`);
                return `${uhpPieceId} ${lastPiece.uhpId}-`;
            }
            
            // Validate that we have an adjacent reference
            if (minDistance !== 1) {
                console.log(`⚠️ WARNING: Best reference is not adjacent (distance: ${minDistance})`);
                console.log(`⚠️ This may result in invalid UHP notation that Nokamute will reject`);
                console.log(`⚠️ Piece position: (${myPos.q}, ${myPos.r})`);
                console.log(`⚠️ Reference position: (${bestReference.q}, ${bestReference.r})`);
            }
            
            // Calculate relative direction and determine correct UHP notation
            const deltaQ = myPos.q - bestReference.q;
            const deltaR = myPos.r - bestReference.r;
            
            console.log(`🔧 Delta from reference: (${deltaQ}, ${deltaR})`);
            
            // OFFICIAL UHP Protocol based on uhp-samples:
            // UHP uses pointy-top hex with directions:
            // Up = (0, -1), UpRight = (1, -1), DownRight = (1, 0)
            // Down = (0, 1), DownLeft = (-1, 1), UpLeft = (-1, 0)
            //
            // Our flat-top hex rotated 60° clockwise to match UHP:
            // Our (0, -1) → UHP Up, Our (1, -1) → UHP UpRight, etc.
            //
            // Each UHP direction has TWO sides (BEFORE and AFTER):
            // BEFORE: -ref, /ref, \ref  |  AFTER: ref-, ref/, ref\
            
            let result;
            
            // Standard UHP Direction Mapping (based on real Nokamute/Mzinga examples):
            // UHP uses axial coordinates with these 6 adjacent directions:
            // (0,-1) = North → piece referencepiece/
            // (1,-1) = NorthEast → piece referencepiece-  
            // (1,0) = SouthEast → piece referencepiece\
            // (0,1) = South → piece /referencepiece
            // (-1,1) = SouthWest → piece -referencepiece
            // (-1,0) = NorthWest → piece \referencepiece
            
            if (deltaQ === 0 && deltaR === -1) {
                // North: piece referencepiece/
                result = `${uhpPieceId} ${bestReference.uhpId}/`;
                console.log(`🎯 Delta (0,-1) → North: ${uhpPieceId} ${bestReference.uhpId}/`);
            } else if (deltaQ === 1 && deltaR === -1) {
                // NorthEast: piece referencepiece-
                result = `${uhpPieceId} ${bestReference.uhpId}-`;
                console.log(`🎯 Delta (1,-1) → NorthEast: ${uhpPieceId} ${bestReference.uhpId}-`);
            } else if (deltaQ === 1 && deltaR === 0) {
                // SouthEast: piece referencepiece\
                result = `${uhpPieceId} ${bestReference.uhpId}\\`;
                console.log(`🎯 Delta (1,0) → SouthEast: ${uhpPieceId} ${bestReference.uhpId}\\`);
            } else if (deltaQ === 0 && deltaR === 1) {
                // South: piece /referencepiece
                result = `${uhpPieceId} /${bestReference.uhpId}`;
                console.log(`🎯 Delta (0,1) → South: ${uhpPieceId} /${bestReference.uhpId}`);
            } else if (deltaQ === -1 && deltaR === 1) {
                // SouthWest: piece -referencepiece
                result = `${uhpPieceId} -${bestReference.uhpId}`;
                console.log(`🎯 Delta (-1,1) → SouthWest: ${uhpPieceId} -${bestReference.uhpId}`);
            } else if (deltaQ === -1 && deltaR === 0) {
                // NorthWest: piece \referencepiece
                result = `${uhpPieceId} \\${bestReference.uhpId}`;
                console.log(`🎯 Delta (-1,0) → NorthWest: ${uhpPieceId} \\${bestReference.uhpId}`);
            } else {
                // Non-adjacent - find an actually adjacent piece or use proper multi-step notation
                console.log(`⚠️ Non-adjacent reference (${deltaQ}, ${deltaR}) - finding adjacent alternative`);
                
                // Look for an adjacent piece instead
                let adjacentReference = null;
                for (const placedPiece of playedPieces) {
                    const refQ = placedPiece.q;
                    const refR = placedPiece.r;
                    const adjDeltaQ = myPos.q - refQ;
                    const adjDeltaR = myPos.r - refR;
                    const distance = Math.abs(adjDeltaQ) + Math.abs(adjDeltaR);
                    
                    if (distance === 1) {
                        adjacentReference = placedPiece;
                        console.log(`✅ Found adjacent alternative: ${adjacentReference.uhpId} at (${refQ}, ${refR})`);
                        
                        // Use the adjacent reference with standard UHP direction
                        if (adjDeltaQ === 0 && adjDeltaR === -1) {
                            result = `${uhpPieceId} ${adjacentReference.uhpId}/`;
                            console.log(`🎯 Adjacent North: ${uhpPieceId} ${adjacentReference.uhpId}/`);
                        } else if (adjDeltaQ === 1 && adjDeltaR === -1) {
                            result = `${uhpPieceId} ${adjacentReference.uhpId}-`;
                            console.log(`🎯 Adjacent NorthEast: ${uhpPieceId} ${adjacentReference.uhpId}-`);
                        } else if (adjDeltaQ === 1 && adjDeltaR === 0) {
                            result = `${uhpPieceId} ${adjacentReference.uhpId}\\`;
                            console.log(`🎯 Adjacent SouthEast: ${uhpPieceId} ${adjacentReference.uhpId}\\`);
                        } else if (adjDeltaQ === 0 && adjDeltaR === 1) {
                            result = `${uhpPieceId} /${adjacentReference.uhpId}`;
                            console.log(`🎯 Adjacent South: ${uhpPieceId} /${adjacentReference.uhpId}`);
                        } else if (adjDeltaQ === -1 && adjDeltaR === 1) {
                            result = `${uhpPieceId} -${adjacentReference.uhpId}`;
                            console.log(`🎯 Adjacent SouthWest: ${uhpPieceId} -${adjacentReference.uhpId}`);
                        } else if (adjDeltaQ === -1 && adjDeltaR === 0) {
                            result = `${uhpPieceId} \\${adjacentReference.uhpId}`;
                            console.log(`🎯 Adjacent NorthWest: ${uhpPieceId} \\${adjacentReference.uhpId}`);
                        }
                        break;
                    }
                }
                
                if (!adjacentReference) {
                    // This is a critical error - the piece is not adjacent to any existing piece
                    // This violates Hive placement rules and will be rejected by Nokamute
                    console.error(`❌ CRITICAL: Attempted invalid placement at (${myPos.q}, ${myPos.r})`);
                    console.error(`❌ No adjacent pieces found - this violates Hive placement rules`);
                    console.error(`❌ Available pieces:`, playedPieces.map(p => `${p.uhpId} at (${p.q}, ${p.r})`));
                    
                    // Return null to prevent recording this invalid move
                    result = null;
                    console.log(`❌ INVALID PLACEMENT: Returning null to prevent UHP corruption`);
                }
            }
            
            console.log(`🔧 Final UHP move: ${result}`);
            
            // Don't record here - moves are recorded when the full sequence is built
            
            return result;
        }

        // Get best move from engine
        async getBestMove() {
            // Reset fallback flag at start of each new AI request
            // This ensures we don't get permanently stuck in fallback mode
            if (this.isFallbackActive && !this.isProcessingCommand) {
                console.log('🔄 Resetting fallback flag for new turn');
                this.isFallbackActive = false;
                this.consecutiveFailures = 0; // Reset failure count when recovering
            }
            
            // Prevent recursive calls during active fallback processing
            if (this.isFallbackActive) {
                console.log('🔄 Fallback processing active, skipping UHP engine request');
                return false;
            }
            
            this.isProcessingCommand = true;
            
            if (!this.connected || !this.currentEngine) {
                console.log('🤖 Engine not available, using built-in AI');
                return this.fallbackToBuiltinAI();
            }

            try {
                console.log('🧠 Requesting best move from engine...');
                
                // Show progress popup with engine configuration
                const engineMode = this.settings.mode;
                const timeLimit = this.settings.timeLimit;
                const depthLimit = this.settings.depthLimit;
                
                this.updateThinkingStatus(true, {
                    mode: engineMode,
                    timeLimit: timeLimit,
                    depthLimit: depthLimit,
                    status: `Searching ${engineMode === 'time' ? timeLimit + 's' : depthLimit + ' ply'}...`
                });

                // Export current game state - pure UHP notation
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
                console.log('🔍 Engine response contents:', response.map((line, i) => `[${i}]: "${line}"`));
                console.log('🔍 Full response array:', JSON.stringify(response));
                
                // Check for engine errors first
                const errorResponse = response.find(line => 
                    line && (line.startsWith('err') || line.startsWith('invalidmove'))
                );
                
                if (errorResponse) {
                    console.warn('❌ Engine rejected game state:', errorResponse);
                    this.consecutiveFailures++;
                    this.lastFailedGameState = this.exportGameString();
                    return this.fallbackToBuiltinAI();
                }
                
                // Find the move in response
                const moveString = response.find(line => 
                    line && line !== 'ok' && !line.startsWith('err') && !line.startsWith('invalidmove')
                );
                console.log('🔍 Filtered move string:', moveString);

                if (moveString && moveString !== 'pass') {
                    console.log('🎯 Engine recommends:', moveString);
                    
                    // Check for duplicate moves
                    if (this.lastRecommendedMove === moveString) {
                        console.warn('⚠️ UHP engine recommended the same move twice:', moveString);
                        console.warn('   This indicates engine internal issue with complex board state');
                        console.warn('   Engine may be stuck in logic loop - switching to manual control');
                        this.showAIGaveUpMessage();
                        return false;
                    }
                    
                    // Check for repeated invalid moves (engine stuck in logic loop)
                    if (!this.invalidMoveHistory) {
                        this.invalidMoveHistory = new Map();
                    }
                    const invalidCount = this.invalidMoveHistory.get(moveString) || 0;
                    if (invalidCount >= 2) {
                        console.warn(`⚠️ UHP engine repeatedly suggesting invalid move: ${moveString}`);
                        console.warn(`   Move has been rejected ${invalidCount} times - engine appears stuck`);
                        this.showAIGaveUpMessage();
                        return false;
                    }
                    
                    this.lastRecommendedMove = moveString;
                    
                    // Debug: Log current board state when UHP recommends questionable moves
                    if (moveString && moveString.includes(' ') && !moveString.includes('\\') && !moveString.includes('/') && !moveString.includes('-')) {
                        console.log('🤔 UHP recommended potential beetle climb move:', moveString);
                        console.log('🗺️ Current UHP piece positions:');
                        if (this.uhpPieceMap) {
                            for (const [key, value] of this.uhpPieceMap.entries()) {
                                console.log(`   ${key}: ${value.position} (${value.uhpId})`);
                            }
                        }
                    }
                    const action = this.importMove(moveString);
                    
                    if (action) {
                        this.consecutiveFailures = 0; // Reset on success
                        this.lastRecommendedMove = null; // Reset after successful move
                        
                        // Clear invalid move history on successful move
                        if (this.invalidMoveHistory) {
                            this.invalidMoveHistory.clear();
                        }
                        
                        this.executeEngineMove(action);
                        return true;
                    } else {
                        console.warn('❌ Could not parse engine move');
                        
                        // Track failed moves to detect repeated invalid suggestions
                        if (!this.invalidMoveHistory) {
                            this.invalidMoveHistory = new Map();
                        }
                        const currentCount = this.invalidMoveHistory.get(moveString) || 0;
                        this.invalidMoveHistory.set(moveString, currentCount + 1);
                        console.log(`📊 Invalid move count for "${moveString}": ${currentCount + 1}`);
                        
                        this.showAIGaveUpMessage();
                        return false;
                    }
                } else if (moveString === 'pass') {
                    console.log('🤖 Engine passes turn');
                    this.consecutiveFailures = 0; // Reset on success
                    if (window.passTurn) window.passTurn();
                    return true;
                }

            } catch (error) {
                console.error('❌ Engine error:', error);
                
                // Don't fallback on command queue errors - wait for queue to process
                if (error.message && error.message.includes('Another command is pending')) {
                    console.log('🔄 Command queued, will retry automatically');
                    return false;
                }
                
                this.consecutiveFailures++;
            } finally {
                this.updateThinkingStatus(false);
                this.isProcessingCommand = false;
            }

            // Show AI gave up message instead of fallback
            this.showAIGaveUpMessage();
            return false;
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
                const pieceMatch = pieceKey.match(/^([wb])([QAGBS])(\d*)$/);
                if (!pieceMatch) {
                    console.warn('❌ Invalid piece format:', pieceKey);
                    return null;
                }
                
                const [, colorCode, pieceType, pieceNum] = pieceMatch;
                const color = colorCode === 'w' ? 'white' : 'black';
                
                // CRITICAL: AI should only control black pieces
                const aiColor = this.settings.aiColor || 'black';
                if (color !== aiColor) {
                    console.warn(`❌ AI tried to move ${color} piece ${pieceKey} but AI is assigned to ${aiColor}!`);
                    return null;
                }
                
                // Queens don't have numbers in UHP, default to 1
                const actualPieceNum = pieceNum || (pieceType === 'Q' ? '1' : '');
                if (!actualPieceNum && pieceType !== 'Q') {
                    console.warn('❌ Missing piece number for non-Queen:', pieceKey);
                    return null;
                }
                
                console.log(`🔍 Looking for: ${color} ${pieceType}${actualPieceNum} (UHP chronological placement order)`);
                
                // Check if this piece is already on the board (movement vs placement)
                let placedPiece = null;
                let placedPosition = null;
                
                // Use correct UHP piece lookup by chronological placement order
                const uhpPieceData = this.getPieceByUHPId(pieceKey);
                if (uhpPieceData) {
                    console.log(`✅ Found UHP piece: ${pieceKey} -> ${uhpPieceData.uhpId} at ${uhpPieceData.position}`);
                    placedPiece = uhpPieceData.piece;
                    placedPosition = uhpPieceData.position;
                } else {
                    console.log(`🔍 UHP piece ${pieceKey} not found in placement records, checking board state...`);
                    
                    // Emergency fallback: scan board for pieces and try to infer placement order
                    const allMatchingPieces = [];
                    if (window.cells) {
                        for (const [key, cell] of window.cells.entries()) {
                            if (cell.stack && cell.stack.length > 0) {
                                for (const boardPiece of cell.stack) {
                                    const bColor = boardPiece.color || boardPiece.meta?.color;
                                    const bKey = boardPiece.key || boardPiece.meta?.key;
                                    
                                    if (bColor === color && bKey === pieceType) {
                                        allMatchingPieces.push({
                                            piece: boardPiece,
                                            position: key,
                                            metaI: boardPiece.i || boardPiece.meta?.i || 1
                                        });
                                    }
                                }
                            }
                        }
                        
                        console.log(`🔍 Emergency fallback: Found ${allMatchingPieces.length} ${color}${pieceType} pieces on board`);
                        
                        if (allMatchingPieces.length > 0) {
                            // Sort by internal numbering as best guess for placement order
                            allMatchingPieces.sort((a, b) => a.metaI - b.metaI);
                            
                            // Use UHP number as 1-based index (may not be accurate)
                            const targetIndex = parseInt(actualPieceNum) - 1;
                            if (targetIndex >= 0 && targetIndex < allMatchingPieces.length) {
                                const target = allMatchingPieces[targetIndex];
                                placedPiece = target.piece;
                                placedPosition = target.position;
                                console.warn(`⚠️ Emergency fallback match: ${color}${pieceType}${actualPieceNum} = piece with meta.i=${target.metaI} at ${placedPosition}`);
                                console.warn(`   This may be inaccurate - UHP numbering relies on chronological placement order!`);
                            }
                        }
                    }
                }
                
                // If piece is already placed, this is a MOVEMENT
                if (placedPiece) {
                    console.log(`🚀 Parsing as MOVEMENT: ${moveString}`);
                    return this.parseMovement(moveString, placedPiece, placedPosition);
                }
                
                // Find matching piece in tray
                let piece = null;
                
                if (window.tray) {
                    // Debug: Show available pieces
                    const availablePieces = window.tray.filter(p => {
                        const pColor = p.color || p.meta?.color;
                        const pPlaced = p.placed || p.meta?.placed;
                        return pColor === color && !pPlaced;
                    });
                    console.log(`🔍 Available ${color} pieces:`, availablePieces.map(p => `${p.key || p.meta?.key}${p.i || p.meta?.i || 1}`));
                    
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

                // Parse the UHP notation to determine where to place the piece
                const uhpMatch = moveString.match(/^([wb][A-Z]\d+)\s+(.+)$/);
                if (uhpMatch) {
                    const [, pieceId, positionNotation] = uhpMatch;
                    console.log(`🎯 Parsing placement UHP: ${pieceId} ${positionNotation}`);
                    
                    // Try to parse the position from the UHP notation
                    const placement = this.parseUHPPlacementPosition(positionNotation);
                    if (placement) {
                        console.log(`🎯 Placing ${color} ${pieceType} at (${placement.q}, ${placement.r}) from UHP notation`);
                        return { type: 'place', piece, q: placement.q, r: placement.r };
                    }
                }

                // Fallback: Use legal placement zones
                if (window.legalPlacementZones) {
                    const legalZones = window.legalPlacementZones(color);
                    if (legalZones && legalZones.size > 0) {
                        const firstZone = Array.from(legalZones)[0];
                        const [q, r] = firstZone.split(',').map(Number);
                        
                        console.log(`🎯 Placing ${color} ${pieceType} at (${q}, ${r}) from legal zones`);
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

        // Parse UHP placement position from notation like "-bS1" or "wG1-"
        parseUHPPlacementPosition(positionNotation) {
            try {
                // Extract reference piece and direction
                let refPieceMatch, direction, refPieceId;
                
                if (positionNotation.match(/^-\w+$/)) {
                    // Format: -refPiece (piece is southwest of reference)
                    refPieceId = positionNotation.substring(1);
                    direction = 'southwest';
                } else if (positionNotation.match(/^\\\w+$/)) {
                    // Format: \refPiece (piece is northwest of reference)
                    refPieceId = positionNotation.substring(1);
                    direction = 'northwest';
                } else if (positionNotation.match(/^\/\w+$/)) {
                    // Format: /refPiece (piece is south of reference)
                    refPieceId = positionNotation.substring(1);
                    direction = 'south';
                } else if (positionNotation.match(/^\w+-$/)) {
                    // Format: refPiece- (piece is northeast of reference)
                    refPieceId = positionNotation.slice(0, -1);
                    direction = 'northeast';
                } else if (positionNotation.match(/^\w+\\$/)) {
                    // Format: refPiece\ (piece is southeast of reference)
                    refPieceId = positionNotation.slice(0, -1);
                    direction = 'southeast';
                } else if (positionNotation.match(/^\w+\/$/)) {
                    // Format: refPiece/ (piece is north of reference)
                    refPieceId = positionNotation.slice(0, -1);
                    direction = 'north';
                } else {
                    console.log(`❌ Unrecognized UHP placement format: ${positionNotation}`);
                    return null;
                }

                // Find the reference piece
                const refPiece = this.getPieceByUHPId(refPieceId);
                if (!refPiece) {
                    console.log(`❌ Reference piece not found: ${refPieceId}`);
                    return null;
                }

                // Get the reference piece coordinates - handle different possible formats
                let refQ, refR;
                if (refPiece.q !== undefined && refPiece.r !== undefined) {
                    refQ = refPiece.q;
                    refR = refPiece.r;
                } else if (typeof refPiece.position === 'string') {
                    // Position is in format "q,r"
                    const [qStr, rStr] = refPiece.position.split(',');
                    refQ = parseInt(qStr);
                    refR = parseInt(rStr);
                } else if (refPiece.position && typeof refPiece.position === 'object') {
                    refQ = refPiece.position.q;
                    refR = refPiece.position.r;
                } else if (refPiece.meta) {
                    refQ = refPiece.meta.q;
                    refR = refPiece.meta.r;
                } else {
                    console.log(`❌ Reference piece ${refPieceId} has no valid coordinates:`, refPiece);
                    return null;
                }

                console.log(`🎯 Reference piece ${refPieceId} at (${refQ}, ${refR})`);

                // Validate coordinates
                if (isNaN(refQ) || isNaN(refR)) {
                    console.log(`❌ Invalid reference coordinates: (${refQ}, ${refR})`);
                    return null;
                }

                // Calculate position based on direction
                let targetQ, targetR;

                switch (direction) {
                    case 'north':     // (0, -1)
                        targetQ = refQ; targetR = refR - 1; break;
                    case 'northeast': // (1, -1)
                        targetQ = refQ + 1; targetR = refR - 1; break;
                    case 'southeast': // (1, 0)
                        targetQ = refQ + 1; targetR = refR; break;
                    case 'south':     // (0, 1)
                        targetQ = refQ; targetR = refR + 1; break;
                    case 'southwest': // (-1, 1)
                        targetQ = refQ - 1; targetR = refR + 1; break;
                    case 'northwest': // (-1, 0)
                        targetQ = refQ - 1; targetR = refR; break;
                    default:
                        console.log(`❌ Unknown direction: ${direction}`);
                        return null;
                }

                console.log(`🎯 Parsed UHP placement: ${direction} of ${refPieceId} at (${refQ}, ${refR}) → (${targetQ}, ${targetR})`);
                return { q: targetQ, r: targetR };

            } catch (error) {
                console.error('❌ Failed to parse UHP placement position:', error);
                return null;
            }
        }

        // Parse UHP movement notation like "bA3 \wG2"
        parseMovement(moveString, piece, currentPosition) {
            try {
                console.log(`🔍 Parsing movement: ${moveString} from ${currentPosition}`);
                
                // Validate input piece position
                if (currentPosition && piece && piece.meta) {
                    const [currentQ, currentR] = currentPosition.split(',').map(Number);
                    const pieceQ = piece.meta.q;
                    const pieceR = piece.meta.r;
                    
                    if (currentQ !== pieceQ || currentR !== pieceR) {
                        console.warn('⚠️ UHP piece position mismatch detected');
                        console.warn(`   Expected piece at (${currentQ}, ${currentR}) but found at (${pieceQ}, ${pieceR})`);
                        console.warn(`   This indicates stale piece data - AI may be trying to move a piece that already moved`);
                        this.showAIGaveUpMessage();
                        return null;
                    }
                }
                
                // Extract destination from UHP notation like "bA3 \wG2"
                const parts = moveString.trim().split(' ');
                if (parts.length < 2) {
                    console.warn('❌ Invalid movement format - missing destination');
                    return null;
                }
                
                const destinationPart = parts[1]; // e.g., "\wG2", "/wG1", "wG1-"
                
                // Parse the reference piece and direction
                let refMatch = destinationPart.match(/^([\\\/\-]?)([wb][QAGBS]\d*)([\\\/\-]?)$/);
                let beforeSep = '', refPieceKey = '', afterSep = '', separator = '';
                
                if (refMatch) {
                    [, beforeSep, refPieceKey, afterSep] = refMatch;
                    separator = beforeSep || afterSep;
                } else {
                    // Check for direct piece reference (beetle climbing): "wG2"
                    const directMatch = destinationPart.match(/^([wb][QAGBS]\d*)$/);
                    if (directMatch) {
                        refPieceKey = directMatch[1];
                        separator = ''; // No separator means climbing onto the same position
                        console.log(`🎯 Beetle climbing notation detected: ${refPieceKey}`);
                    } else {
                        console.warn('❌ Invalid destination format:', destinationPart);
                        return null;
                    }
                }
                
                console.log(`🎯 Movement reference: piece=${refPieceKey}, separator=${separator}`);
                
                // Find the reference piece on the board
                const refPosition = this.findPiecePosition(refPieceKey);
                if (!refPosition) {
                    console.warn('❌ Reference piece not found:', refPieceKey);
                    
                    // Debug: Show available pieces to identify ID mismatch
                    console.log(`🔍 Debug: Looking for reference piece "${refPieceKey}"`);
                    console.log(`🔍 All placed pieces:`, window.tray.filter(p => p.meta.placed).map(p => 
                        `${p.meta.color}${p.meta.key}${p.meta.i || ''} (id: ${p.id}) at (${p.meta.q},${p.meta.r})`
                    ));
                    
                    // Try alternative lookup for debugging
                    const [, colorChar, typeChar, indexStr] = refPieceKey.match(/^([wb])([QAGBS])(\d*)$/) || [];
                    if (colorChar && typeChar) {
                        const color = colorChar === 'w' ? 'white' : 'black';
                        const type = typeChar;
                        const index = indexStr ? parseInt(indexStr) : 1;
                        
                        console.log(`🔍 Searching for: ${color} ${type} #${index}`);
                        
                        // Find the Nth placed piece of this type
                        const candidates = window.tray.filter(p => 
                            p.meta.color === color && 
                            p.meta.key === type && 
                            p.meta.placed
                        ).sort((a, b) => (a.meta.i || 0) - (b.meta.i || 0));
                        
                        console.log(`🔍 Available ${color} ${type} pieces:`, candidates.map(p => 
                            `${p.meta.color}${p.meta.key}${p.meta.i || ''} (id: ${p.id}) at (${p.meta.q},${p.meta.r})`
                        ));
                    }
                    
                    return null;
                }
                
                // Calculate destination coordinates based on separator and side
                const destination = this.calculateMovementDestination(refPosition, separator, beforeSep ? 'left' : 'right', piece);
                if (!destination) {
                    console.warn('❌ Could not calculate destination');
                    return null;
                }
                
                console.log(`🎯 Movement destination: (${destination.q}, ${destination.r})`);
                
                // Check if this is trying to move to the same position (invalid move)
                const currentPos = currentPosition.split(',').map(Number);
                const currentQ = currentPos[0];
                const currentR = currentPos[1];
                
                if (destination.q === currentQ && destination.r === currentR) {
                    console.warn('⚠️ UHP engine recommended same-position move:', moveString);
                    console.warn('   UHP engine may be indicating no legal moves available');
                    
                    // Show "AI gave up" message and switch to manual control
                    this.showAIGaveUpMessage();
                    return null;
                }
                
                // CRITICAL: Validate move against game rules before executing
                if (window.legalMoveZones && piece) {
                    const legalZones = window.legalMoveZones(piece);
                    const destKey = `${destination.q},${destination.r}`;
                    
                    let isLegal = false;
                    if (Array.isArray(legalZones)) {
                        isLegal = legalZones.includes(destKey);
                    } else if (legalZones && legalZones.has) {
                        isLegal = legalZones.has(destKey);
                    }
                    
                    if (!isLegal) {
                        console.warn('❌ UHP engine suggested ILLEGAL move according to game rules!');
                        console.warn(`   ${piece.meta?.color || piece.color} ${piece.meta?.key || piece.key} cannot move to (${destination.q}, ${destination.r})`);
                        console.warn(`   Legal destinations:`, Array.isArray(legalZones) ? legalZones : Array.from(legalZones || []));
                        console.warn(`   This indicates UHP/engine rule mismatch - AI giving up for safety`);
                        this.showAIGaveUpMessage();
                        return null;
                    } else {
                        console.log(`✅ UHP move validated: ${piece.meta?.color || piece.color} ${piece.meta?.key || piece.key} can legally move to (${destination.q}, ${destination.r})`);
                    }
                }
                
                // Check if destination is occupied (pieces cannot stack except beetles)
                const destKey = `${destination.q},${destination.r}`;
                const destCell = window.cells.get(destKey);
                if (destCell && destCell.stack && destCell.stack.length > 0) {
                    // Only beetles can stack on other pieces
                    const movingPieceType = piece.meta?.key || piece.key;
                    if (movingPieceType !== 'B') {
                        console.warn('⚠️ UHP engine recommended illegal move - destination occupied!');
                        console.warn(`   ${piece.meta?.color || piece.color} ${movingPieceType} trying to move to occupied position (${destination.q}, ${destination.r})`);
                        console.warn(`   Occupied by: ${destCell.stack.map(p => `${p.meta?.color || p.color} ${p.meta?.key || p.key}`).join(', ')}`);
                        console.warn('   AI gave up due to illegal UHP move');
                        this.showAIGaveUpMessage();
                        return null;
                    }
                }
                
                return { 
                    type: 'move', 
                    piece: piece, 
                    q: destination.q, 
                    r: destination.r,
                    fromPosition: currentPosition
                };
                
            } catch (error) {
                console.error('❌ Failed to parse movement:', error);
                return null;
            }
        }

        // Find position of a piece on the board by UHP key (chronological placement order)
        findPiecePosition(uhpKey) {
            console.log(`[UHP] Looking for reference piece: ${uhpKey}`);
            
            // Use correct UHP piece lookup by chronological placement order
            const uhpPieceData = this.getPieceByUHPId(uhpKey);
            if (uhpPieceData && uhpPieceData.piece.meta) {
                const piece = uhpPieceData.piece;
                const q = piece.meta.q;
                const r = piece.meta.r;
                
                console.log(`[UHP] Reference piece ${uhpKey} found at (${q}, ${r}) via placement order`);
                return { q: q, r: r, key: `${q},${r}` };
            }
            
            console.log(`[UHP] Piece ${uhpKey} not found in placement records, using emergency fallback...`);
            
            // Emergency fallback: try to parse and find pieces directly on board
            const pieceMatch = uhpKey.match(/^([wb])([QAGBS])(\d*)$/);
            if (!pieceMatch) {
                console.warn(`[UHP] Invalid UHP key format: ${uhpKey}`);
                return null;
            }
            
            const [, colorCode, pieceType, pieceNumStr] = pieceMatch;
            const color = colorCode === 'w' ? 'white' : 'black';
            const pieceNumber = parseInt(pieceNumStr) || 1;
            
            // Get all pieces of this type and color from the board
            const matchingPieces = [];
            if (window.cells) {
                for (const [key, cell] of window.cells.entries()) {
                    if (cell.stack && cell.stack.length > 0) {
                        for (const boardPiece of cell.stack) {
                            const bColor = boardPiece.color || boardPiece.meta?.color;
                            const bKey = boardPiece.key || boardPiece.meta?.key;
                            
                            if (bColor === color && bKey === pieceType) {
                                const [q, r] = key.split(',').map(Number);
                                matchingPieces.push({ 
                                    piece: boardPiece, 
                                    q, r, key,
                                    metaI: boardPiece.meta?.i || 1
                                });
                            }
                        }
                    }
                }
            }
            
            console.warn(`[UHP] Emergency fallback: Found ${matchingPieces.length} ${color} ${pieceType} pieces on board`);
            
            if (matchingPieces.length > 0) {
                // Sort by internal numbering as best guess for placement order
                matchingPieces.sort((a, b) => a.metaI - b.metaI);
                
                // Use UHP number as 1-based index (may not be accurate)
                const targetIndex = pieceNumber - 1;
                if (targetIndex >= 0 && targetIndex < matchingPieces.length) {
                    const targetPiece = matchingPieces[targetIndex];
                    console.warn(`[UHP] Emergency fallback: Reference piece ${uhpKey} -> (${targetPiece.q}, ${targetPiece.r}) (may be inaccurate!)`);
                    return { q: targetPiece.q, r: targetPiece.r, key: targetPiece.key };
                }
            }
            
            console.error(`[UHP] Reference piece ${uhpKey} not found anywhere!`);
            return null;
        }

        // Calculate movement destination based on UHP separator and side
    calculateMovementDestination(refPosition, separator, side, movingPiece) {
            // UHP uses pointy-top hex coordinates, HYVEMYND uses flat-top
            // Need to convert UHP directions to HYVEMYND coordinates
            
            // Correct UHP direction mapping based on actual game behavior
            // For UHP notation like "piece ref/" - piece goes to upper-right of ref
            // For UHP notation like "piece ref\" - piece goes to down-right of ref
            // For UHP notation like "piece /ref" - piece goes to down-left of ref  
            // UHP Direction Parsing: POSITIONAL/VISUAL notation
            // Directions are visual pointers, not compass directions:
            // / = northeast pointer, \ = northwest pointer, - = horizontal pointer
            // Position relative to reference determines the actual direction:
            
            console.log(`🧭 Parsing movement: separator="${separator}", side="${side}", refPos=(${refPosition.q}, ${refPosition.r})`);
            
            // Map based on visual pointer direction and piece position
            // CORRECTED: Must exactly match CORRECTED buildUHPPositionalMove logic
            // When parsing, we reverse-engineer the direction from separator and side
            let direction;
            if (separator === '/' && side === 'left') {
                // Pattern: /piece → South (direction 3)
                direction = 3;  // South
            } else if (separator === '/' && side === 'right') {
                // Pattern: piece/ → North (direction 0)
                direction = 0;  // North
            } else if (separator === '\\' && side === 'left') {
                // Pattern: \piece → NorthWest (direction 5)
                direction = 5;  // NorthWest  
            } else if (separator === '\\' && side === 'right') {
                // Pattern: piece\ → SouthEast (direction 2)
                direction = 2;  // SouthEast
            } else if (separator === '-' && side === 'left') {
                // Pattern: -piece → SouthWest (direction 4)
                direction = 4;  // SouthWest
            } else if (separator === '-' && side === 'right') {
                // Pattern: piece- → NorthEast (direction 1)
                direction = 1;  // NorthEast
            } else if (separator === '' || !separator) {
                // Beetle climbing: piece moves to same position as reference (stacks on top)
                console.log('🎯 Beetle climbing: moving to same position as reference piece');
                // VALIDATION: Check if this is actually a valid beetle climbing move
                const movingPieceKey = movingPiece?.key || movingPiece?.meta?.key;
                if (movingPieceKey && movingPieceKey.includes('B')) {
                    // This is a beetle - beetle climbing is valid
                    return { q: refPosition.q, r: refPosition.r };
                } else {
                    // Not a beetle trying to climb - this is likely an invalid move
                    console.warn('❌ Non-beetle piece cannot climb to same position as reference');
                    return null;
                }
            } else {
                console.warn('❌ Unknown separator:', separator);
                return null;
            }
            
            // Flat-top hex direction offsets
            const directionOffsets = [
                { q: 0, r: -1 },  // Up
                { q: 1, r: -1 },  // UpRight  
                { q: 1, r: 0 },   // DownRight
                { q: 0, r: 1 },   // Down
                { q: -1, r: 1 },  // DownLeft
                { q: -1, r: 0 }   // UpLeft
            ];
            
            const offset = directionOffsets[direction];
            console.log(`🧭 Movement: ${separator} (${side}) → direction ${direction} → offset (${offset.q}, ${offset.r})`);
            
            return {
                q: refPosition.q + offset.q,
                r: refPosition.r + offset.r
            };
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
                        // Use commitMove to ensure proper turn handling
                        window.commitMove(action.q, action.r);
                    }, 100);
                }
            } catch (error) {
                console.error('❌ Failed to execute engine move:', error);
                this.showAIGaveUpMessage();
            }
        }

        // Direct piece movement without animation for AI moves
        directMove(piece, toQ, toR) {
            try {
                console.log(`🤖 AI direct move: ${piece.meta.color} ${piece.meta.key} to (${toQ}, ${toR})`);
                
                // Update board state directly (same as commitMove but without animation)
                const oldKey = `${piece.meta.q},${piece.meta.r}`;
                const oldCell = window.cells.get(oldKey);
                const ix = oldCell.stack.indexOf(piece);
                if (ix >= 0) oldCell.stack.splice(ix, 1);

                // Reposition remaining pieces in old cell
                oldCell.stack.forEach((c, i) => {
                    const rel = window.axialToPixel(oldCell.q, oldCell.r);
                    c.x = rel.x;
                    c.y = rel.y - i * 6;
                });

                // Move piece to new cell
                const newCell = window.cells.get(`${toQ},${toR}`);
                newCell.stack.push(piece);

                // Update piece position directly (no animation)
                const rel = window.axialToPixel(toQ, toR);
                newCell.stack.forEach((c, i) => {
                    c.x = rel.x;
                    c.y = rel.y - i * 6;
                    window.pieceLayer.setChildIndex(c,
                        window.pieceLayer.children.length - newCell.stack.length + i
                    );
                });

                piece.meta.q = toQ;
                piece.meta.r = toR;

                // Record UHP movement move
                try {
                    console.log(`🎯 Recording UHP movement for AI: ${piece.meta.color} ${piece.meta.key} to (${toQ}, ${toR}), move ${window.state.moveNumber || 1}`);
                    
                    // Get current move number before incrementing
                    const currentMoveNumber = window.state.moveNumber || 1;
                    
                    // Get all placed pieces for reference (after the move)
                    const placedPieces = window.tray.filter(p2 => p2.meta.placed).map(p2 => ({
                        q: p2.meta.q,
                        r: p2.meta.r,
                        uhpId: `${p2.meta.color.charAt(0)}${p2.meta.key}${p2.meta.key === 'Q' ? '' : (p2.meta.i || 1)}`,
                        color: p2.meta.color,
                        key: p2.meta.key
                    }));
                    
                    // Build UHP piece ID  
                    const uhpPieceId = `${piece.meta.color.charAt(0)}${piece.meta.key}${piece.meta.key === 'Q' ? '' : (piece.meta.i || 1)}`;
                    
                    // Generate movement notation
                    let uhpMove = '';
                    if (placedPieces.length > 1 && this.buildMovementNotation) {
                        uhpMove = this.buildMovementNotation(uhpPieceId, toQ, toR, placedPieces);
                    }
                    
                    if (uhpMove) {
                        console.log(`📝 Recorded UHP movement ${currentMoveNumber}: ${uhpMove}`);
                        this.uhpMoveHistory.set(currentMoveNumber, uhpMove);
                        console.log(`🔍 Current UHP move history:`, Array.from(this.uhpMoveHistory.entries()));
                        
                        // Update UHP piece mapping with new position
                        const [coords] = uhpMove.split(' '); // Extract piece ID (e.g., "bG2" from "bG2 -wQ")
                        
                        // Extract UHP number from the move notation (e.g., "bG3" -> "3")
                        const uhpNumberMatch = coords.match(/[a-zA-Z]+(\d+)$/);
                        const uhpNumber = uhpNumberMatch ? uhpNumberMatch[1] : '1';
                        
                        const uhpKey = `${piece.meta.color}_${piece.meta.key}_${uhpNumber}`;
                        this.uhpPieceMap.set(uhpKey, {
                            piece: piece,
                            position: `${toQ},${toR}`,
                            uhpId: coords
                        });
                        console.log(`🗺️ Updated UHP piece map: ${uhpKey} -> ${toQ},${toR} (from move: ${coords})`);
                    } else {
                        console.log(`⚠️ Could not generate UHP movement notation for ${uhpPieceId}`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error recording UHP movement:`, error);
                }

                // Clear selection only - let commitMove handle turn changes
                window.clearHighlights();
                window.selected = null;
                window.tray.forEach(p => p.interactive = true);
                
                console.log(`🤖 AI direct move completed - board updated, no turn change here`);

                // Check for winner
                const winner = window.checkForWinner();
                if (winner) {
                    console.log(`🏆 Game over: ${winner} wins!`);
                    window.state.gameOver = true;
                    return;
                }

                console.log('✅ AI move executed successfully');

            } catch (error) {
                console.error('❌ Error in direct move:', error);
                this.showAIGaveUpMessage();
            }
        }

        showAIGaveUpMessage() {
            console.log('🤖💀 AI gave up - switching to manual control');
            
            // Disable UHP AI for this turn by temporarily setting aiColor to null
            const originalAiColor = this.aiColor;
            this.aiColor = null;
            
            // Update HUD to show "AI gave up" message
            if (window.updateHUD) {
                // Store original AI state and show message
                setTimeout(() => {
                    const hudElement = document.getElementById('hud');
                    if (hudElement) {
                        const originalText = hudElement.textContent;
                        hudElement.style.color = '#ff6b6b';
                        hudElement.textContent = `${window.state.current.charAt(0).toUpperCase() + window.state.current.slice(1)} Turn - A.I. gave up`;
                        
                        // Restore color after a few seconds but keep the message
                        setTimeout(() => {
                            hudElement.style.color = '';
                        }, 3000);
                    }
                    
                    // Re-enable AI for next turn
                    setTimeout(() => {
                        this.aiColor = originalAiColor;
                        console.log('🤖🔄 AI re-enabled for next turn');
                    }, 1000);
                }, 100);
            }
            
            // Make sure manual input is enabled for this turn
            this.isManualControlActive = true;
        }

        fallbackToBuiltinAI() {
            console.log('🧠 Using built-in AI fallback');
            
            // Prevent recursive fallback calls
            if (this.isFallbackActive) {
                console.warn('🔄 Fallback already active, skipping recursive call');
                return false;
            }
            
            // Check if we've had too many consecutive failures
            if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
                console.warn(`❌ Too many consecutive UHP failures (${this.consecutiveFailures}). Disabling UHP AI for this turn.`);
                this.consecutiveFailures = 0; // Reset for next turn
                return false;
            }
            
            this.isFallbackActive = true;
            
            // Use available built-in AI engines as fallback
            if (window.originalPerformAIAction || 
                (window.AIEngine && window.AIEngine.checkAndMakeMove) ||
                (window.AIEngineNokamuteMzinga && window.AIEngineNokamuteMzinga.makeMove)) {
                setTimeout(() => {
                    try {
                        if (window.originalPerformAIAction) {
                            console.log('🔄 Using original AI action');
                            window.originalPerformAIAction();
                        } else if (window.AIEngineNokamuteMzinga && window.AIEngineNokamuteMzinga.makeMove) {
                            console.log('🔄 Using Nokamute-Mzinga AI engine as fallback');
                            window.AIEngineNokamuteMzinga.makeMove();
                        } else if (window.AIEngine && window.AIEngine.checkAndMakeMove) {
                            window.AIEngine.checkAndMakeMove();
                        }
                    } finally {
                        this.isFallbackActive = false;
                    }
                }, 200);
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

        updateThinkingStatus(thinking, data = {}) {
            if (window.updateEngineThinking) {
                window.updateEngineThinking(thinking, data);
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
            // In WASM mode, we're enabled if WASM engine is available, regardless of WebSocket connection
            if (window.wasmEngine && window.wasmEngine.isAvailable()) {
                return this.settings.enabled; // Only check settings, not connection
            }
            // Fallback to old WebSocket-based check
            return this.settings.enabled && this.connected && this.currentEngine;
        }

        disconnect() {
            // Clean up health check
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            
            // Close WebSocket connection
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            
            this.connected = false;
            this.isConnecting = false;
            this.currentEngine = null;
            console.log('🔌 UHP Client disconnected and cleaned up');
        }
        
        shouldPlayForColor(color) {
            // AI should only play black in single player mode
            const aiColor = this.settings.aiColor || 'black';
            const shouldPlay = this.isEnabled() && color === aiColor;
            console.log(`🎯 UHP shouldPlayForColor(${color}): aiColor=${aiColor}, enabled=${this.isEnabled()}, shouldPlay=${shouldPlay}`);
            return shouldPlay;
        }
    }

    // Initialize UHP client globally - WASM mode (no WebSocket needed)
    if (!window.uhpClient) {
        window.uhpClient = new HYVEMYNDUHPClient();
        console.log('🐝 UHP Client initialized globally for WASM mode');
    }
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (window.uhpClient) {
            window.uhpClient.disconnect();
        }
    });
    
    console.log('🐝 HYVEMYND UHP Client loaded');

})();