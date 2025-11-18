/**
 * HYVEMYND WASM Engine Integration
 * Provides offline Nokamute engine via WebAssembly
 * Maintains identical API to UHP WebSocket system for seamless integration
 */

(function() {
    'use strict';
    
    class WASMEngine {
        constructor() {
            this.initialized = false;
            this.initPromise = null;
            this.wasmModule = null;
            this.uhpFunction = null;
            this.eventListeners = {};
            this.tableSizeMB = 100; // Default 100MB
            this.pendingTableSize = null; // For changes requiring restart
            
            console.log('🧩 WASM Engine initializing...');
        }
        
        /**
         * Initialize the WASM module
         * Returns a promise that resolves when ready
         */
        async initialize() {
            if (this.initPromise) {
                return this.initPromise;
            }
            
            this.initPromise = this._loadWASM();
            return this.initPromise;
        }
        
        async _loadWASM() {
            try {
                console.log('📦 Loading Nokamute WASM module...');
                
                // Try multiple import paths
                let wasmModule;
                try {
                    // First try: same directory
                    wasmModule = await import('./nokamute.js');
                } catch (e1) {
                    try {
                        // Second try: js directory  
                        wasmModule = await import('../js/nokamute.js');
                    } catch (e2) {
                        try {
                            // Third try: absolute path
                            wasmModule = await import('/js/nokamute.js');
                        } catch (e3) {
                            console.error('❌ All WASM import paths failed:', {e1, e2, e3});
                            throw e3;
                        }
                    }
                }
                
                // Initialize the WASM module
                await wasmModule.default();
                
                this.wasmModule = wasmModule;
                this.uhpFunction = wasmModule.uhp;
                this.initialized = true;
                
                // Apply configured table size if it differs from default
                if (this.pendingTableSize && this.pendingTableSize !== this.tableSizeMB) {
                    this.tableSizeMB = this.pendingTableSize;
                    this.pendingTableSize = null;
                }
                
                const tableSizeDisplay = this.tableSizeMB >= 1000 ? 
                    `${(this.tableSizeMB / 1000).toFixed(1)}GB` : `${this.tableSizeMB}MB`;
                console.log(`✅ Nokamute WASM engine ready (${tableSizeDisplay} transposition table)`);
                this._emit('initialized');
                
                return true;
            } catch (error) {
                console.error('❌ Failed to initialize WASM engine:', error);
                this._emit('error', error);
                throw error;
            }
        }
        
        /**
         * Execute UHP command via WASM
         * Maintains identical API to WebSocket UHP client
         */
        async sendCommand(command) {
            if (!this.initialized) {
                await this.initialize();
            }
            
            try {
                console.log(`📤 WASM Command: ${command}`);
                const response = this.uhpFunction(command);
                console.log(`📥 WASM Response: ${response}`);
                
                // Emit response event for compatibility with UHP client
                this._emit('response', { command, response });
                
                return response;
            } catch (error) {
                console.error('❌ WASM command failed:', error);
                this._emit('error', error);
                throw error;
            }
        }
        
        /**
         * Get best move for current position
         * Compatible with personality system
         */
        async getBestMove(gameString, options = {}) {
            if (!this.initialized) {
                await this.initialize();
            }
            
            try {
                // Start a new base game
                console.log('🎯 Starting new Base game');
                const gameResponse = await this.sendCommand('newgame Base');
                console.log(`🎯 New game response: ${gameResponse}`);
                
                // Apply moves if provided, with error handling
                if (gameString && gameString.trim()) {
                    const moves = gameString.split(';');
                    console.log(`🎯 Applying ${moves.length} moves: ${moves.join(', ')}`);
                    
                    // Safeguard: Limit to prevent excessive message processing
                    const maxMoves = 200; // Reasonable limit for a Hive game
                    if (moves.length > maxMoves) {
                        console.warn(`⚠️ Move count (${moves.length}) exceeds safety limit (${maxMoves})`);
                        console.warn(`⚠️ Truncating to prevent engine overload`);
                        moves.splice(maxMoves);
                    }
                    
                    for (let i = 0; i < moves.length; i++) {
                        const move = moves[i].trim();
                        if (move) {
                            console.log(`🎯 Playing move ${i + 1}: ${move}`);
                            const moveResponse = await this.sendCommand(`play ${move}`);
                            console.log(`🎯 Move response: ${moveResponse}`);
                            
                            // Check for invalid moves and stop sending further moves
                            if (moveResponse.includes('invalidmove')) {
                                console.warn(`❌ Invalid move detected: ${move}`);
                                console.warn(`⚠️ Stopping move replay at position ${i + 1}/${moves.length}`);
                                console.warn(`⚠️ WASM game state may be out of sync with UI`);
                                break;
                            }
                        }
                    }
                }
                
                // Use bestmove with time parameter (UHP requires parameters)
                const { mode, timeLimit, depthLimit } = options;
                let searchCommand;
                
                if (mode === 'depth' && depthLimit) {
                    searchCommand = `bestmove depth ${depthLimit}`;
                } else {
                    // Default to time-based search (2 seconds)
                    const seconds = timeLimit || 2;
                    const timeString = `00:00:${seconds.toString().padStart(2, '0')}`;
                    searchCommand = `bestmove time ${timeString}`;
                }
                
                console.log(`🎯 Getting best move with: ${searchCommand}`);
                this._emit('thinking', { phase: 'starting', progress: 0 });
                
                const bestMove = await this.sendCommand(searchCommand);
                
                this._emit('thinking', { phase: 'complete', progress: 100 });
                
                return bestMove.trim();
            } catch (error) {
                console.error('❌ Failed to get best move:', error);
                this._emit('error', error);
                throw error;
            }
        }
        
        /**
         * Get valid moves for current position
         */
        async getValidMoves(gameString = null) {
            if (!this.initialized) {
                await this.initialize();
            }
            
            try {
                if (gameString) {
                    await this.sendCommand(`newgame ${gameString}`);
                }
                
                const validMoves = await this.sendCommand('validmoves');
                return validMoves.split(';').filter(move => move.trim());
            } catch (error) {
                console.error('❌ Failed to get valid moves:', error);
                throw error;
            }
        }
        
        /**
         * Get engine information
         */
        async getInfo() {
            if (!this.initialized) {
                await this.initialize();
            }
            
            return await this.sendCommand('info');
        }
        
        /**
         * Play a move and get updated game state
         */
        async playMove(move) {
            if (!this.initialized) {
                await this.initialize();
            }
            
            return await this.sendCommand(`play ${move}`);
        }
        
        /**
         * Event system for compatibility with existing code
         */
        on(event, callback) {
            if (!this.eventListeners[event]) {
                this.eventListeners[event] = [];
            }
            this.eventListeners[event].push(callback);
        }
        
        off(event, callback) {
            if (this.eventListeners[event]) {
                this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
            }
        }
        
        _emit(event, data) {
            if (this.eventListeners[event]) {
                this.eventListeners[event].forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in event listener for ${event}:`, error);
                    }
                });
            }
        }
        
        /**
         * Set transposition table size (requires engine restart to take effect)
         */
        setTableSize(sizeMB) {
            const oldSize = this.tableSizeMB;
            this.pendingTableSize = sizeMB;
            
            const newSizeDisplay = sizeMB >= 1000 ? `${(sizeMB / 1000).toFixed(1)}GB` : `${sizeMB}MB`;
            const oldSizeDisplay = oldSize >= 1000 ? `${(oldSize / 1000).toFixed(1)}GB` : `${oldSize}MB`;
            
            console.log(`🔧 Table size changed: ${oldSizeDisplay} → ${newSizeDisplay} (restart required)`);
            
            if (this.initialized) {
                console.log('⚠️ Engine restart required for table size change to take effect');
                this._emit('table-size-changed', { 
                    oldSize: oldSize, 
                    newSize: sizeMB, 
                    requiresRestart: true 
                });
            } else {
                // Engine not initialized yet, change will apply on next init
                this.tableSizeMB = sizeMB;
                this.pendingTableSize = null;
                console.log(`✅ Table size set to ${newSizeDisplay} for next initialization`);
            }
        }
        
        /**
         * Get current table size configuration
         */
        getTableSize() {
            return this.pendingTableSize || this.tableSizeMB;
        }
        
        /**
         * Restart engine with new settings (if supported by future implementation)
         */
        async restart() {
            if (!this.initialized) {
                console.log('🔄 Engine not initialized, performing fresh initialization...');
                return this.initialize();
            }
            
            console.log('🔄 Restarting WASM engine with new settings...');
            
            // Apply pending table size
            if (this.pendingTableSize) {
                this.tableSizeMB = this.pendingTableSize;
                this.pendingTableSize = null;
            }
            
            // For now, we don't support hot restart of WASM modules
            // This would require reloading the WASM module with new memory settings
            console.log('⚠️ WASM engine restart not fully implemented - settings will apply on page refresh');
            this._emit('restart-required');
            
            return Promise.resolve();
        }
        
        /**
         * Check if WASM engine is available
         */
        isAvailable() {
            // Return true if WebAssembly is supported and we have a module or are initializing
            return typeof WebAssembly !== 'undefined' && (this.initialized || this.initPromise);
        }
        
        /**
         * Get engine status for UI
         */
        getStatus() {
            if (this.initialized) {
                return 'ready';
            } else if (this.initPromise) {
                return 'initializing';
            } else {
                return 'not-initialized';
            }
        }
        
        /**
         * Get detailed engine info including table size
         */
        getEngineInfo() {
            const tableSizeDisplay = this.getTableSize() >= 1000 ? 
                `${(this.getTableSize() / 1000).toFixed(1)}GB` : `${this.getTableSize()}MB`;
                
            return {
                initialized: this.initialized,
                status: this.getStatus(),
                tableSizeMB: this.getTableSize(),
                tableSizeDisplay: tableSizeDisplay,
                requiresRestart: this.pendingTableSize !== null
            };
        }
    }
    
    // Create global instance
    window.wasmEngine = new WASMEngine();
    
    // Load saved table size setting before initialization
    try {
        const savedSettings = localStorage.getItem('hyvemynd-engine-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.tableSize && settings.tableSize >= 100 && settings.tableSize <= 2000) {
                window.wasmEngine.setTableSize(settings.tableSize);
                console.log(`🔧 Loaded saved table size: ${settings.tableSize}MB`);
            }
        }
    } catch (error) {
        console.warn('⚠️ Could not load saved table size setting:', error);
    }
    
    // Auto-initialize WASM engine immediately (for both browser and Capacitor)
    console.log('🧩 Auto-initializing WASM engine for offline AI...');
    window.wasmEngine.initialize().then(() => {
        console.log('✅ WASM engine auto-initialized successfully');
    }).catch(error => {
        console.error('❌ Failed to auto-initialize WASM engine:', error);
    });
    
    console.log('🧩 WASM Engine integration loaded');
    
})();