// HYVEMYND Engine Integration
// Connects the Engine tab UI controls with the UHP client

(function() {
    'use strict';
    
    class EngineIntegration {
        constructor() {
            this.initialized = false;
            this.engineLogEntries = [];
            this.maxLogEntries = 100;
            
            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }
        
        updateProgressPopup(show, data = {}) {
            const popup = document.getElementById('engine-progress-popup');
            if (!popup) return;
            
            if (show) {
                this.showProgressPopup(data);
            } else {
                this.hideProgressPopup();
            }
        }
        
        updateThinkingIndicator(thinking, data = {}) {
            const indicator = document.getElementById('engine-thinking-indicator');
            if (indicator) {
                indicator.style.display = thinking ? 'block' : 'none';
            }
            
            // Also manage the progress popup
            this.updateProgressPopup(thinking, data);
        }
        
        init() {
            if (this.initialized) return;
            
            console.log('🔧 Initializing HYVEMYND Engine Integration...');
            
            // Setup UI event listeners
            this.setupEventListeners();
            
            // Setup UHP client integration
            this.setupUHPIntegration();
            
            // Load saved settings
            this.loadSettings();
            
            this.initialized = true;
            console.log('✅ HYVEMYND Engine Integration ready');
        }
        
        setupEventListeners() {
            // Engine selection
            const engineSelect = document.getElementById('engine-select');
            if (engineSelect) {
                engineSelect.addEventListener('change', (e) => this.handleEngineSelection(e.target.value));
            }
            
            // Restart engine button
            const restartBtn = document.getElementById('restart-engine');
            if (restartBtn) {
                restartBtn.addEventListener('click', () => this.restartEngine());
            }
            
            // Engine enabled checkbox
            const enabledCheckbox = document.getElementById('engine-enabled');
            if (enabledCheckbox) {
                enabledCheckbox.addEventListener('change', (e) => this.setEngineEnabled(e.target.checked));
            }
            
            // Engine mode selection
            const modeSelect = document.getElementById('engine-mode');
            if (modeSelect) {
                modeSelect.addEventListener('change', (e) => this.setEngineMode(e.target.value));
            }
            
            // Time limit slider
            const timeSlider = document.getElementById('time-limit');
            const timeValue = document.getElementById('time-value');
            if (timeSlider && timeValue) {
                timeSlider.addEventListener('input', (e) => {
                    const value = e.target.value;
                    timeValue.textContent = `${value}s`;
                    this.setTimeLimit(parseInt(value));
                });
            }
            
            // Depth limit slider
            const depthSlider = document.getElementById('depth-limit');
            const depthValue = document.getElementById('depth-value');
            if (depthSlider && depthValue) {
                depthSlider.addEventListener('input', (e) => {
                    const value = e.target.value;
                    depthValue.textContent = `${value} ply`;
                    this.setDepthLimit(parseInt(value));
                });
            }
            
            // Transposition table size slider
            const tableSizeSlider = document.getElementById('table-size');
            const tableSizeValue = document.getElementById('table-size-value');
            if (tableSizeSlider && tableSizeValue) {
                tableSizeSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    const displayValue = this.formatTableSize(value);
                    tableSizeValue.textContent = displayValue;
                    this.setTableSize(value);
                });
            }
            
            // Engine color selection
            const colorSelect = document.getElementById('engine-color');
            if (colorSelect) {
                colorSelect.addEventListener('change', (e) => this.setEngineColor(e.target.value));
            }
            
            // Custom engine controls
            const customEngineConfig = document.getElementById('custom-engine-config');
            if (engineSelect && customEngineConfig) {
                engineSelect.addEventListener('change', (e) => {
                    customEngineConfig.style.display = e.target.value === 'custom' ? 'block' : 'none';
                });
            }
            
            const addCustomBtn = document.getElementById('add-custom-engine');
            const customPath = document.getElementById('custom-engine-path');
            if (addCustomBtn && customPath) {
                addCustomBtn.addEventListener('click', () => {
                    const path = customPath.value.trim();
                    if (path) {
                        this.addCustomEngine(path);
                    }
                });
            }
            
            // Log controls
            const clearLogBtn = document.getElementById('clear-log');
            if (clearLogBtn) {
                clearLogBtn.addEventListener('click', () => this.clearLog());
            }
            
            const testEngineBtn = document.getElementById('test-engine');
            if (testEngineBtn) {
                testEngineBtn.addEventListener('click', () => this.testEngine());
            }
            
            // Start Game Now button
            const startGameBtn = document.getElementById('start-engine-game');
            if (startGameBtn) {
                startGameBtn.addEventListener('click', () => this.startEngineGame());
            }
        }
        
        setupUHPIntegration() {
            // Wait for UHP client to be available
            const checkUHPClient = () => {
                if (window.uhpClient) {
                    this.integrateWithUHPClient();
                } else {
                    setTimeout(checkUHPClient, 500);
                }
            };
            checkUHPClient();
        }
        
        integrateWithUHPClient() {
            console.log('🔗 Integrating with UHP client...');
            
            // Hook into UHP client status updates
            window.updateUHPStatus = (status) => this.updateConnectionStatus(status);
            window.updateEngineThinking = (thinking, data = {}) => this.updateThinkingIndicator(thinking, data);
            window.onEngineReady = (engineName) => this.onEngineReady(engineName);
            window.onEnginesList = (engines) => this.onEnginesList(engines);
            window.logEngineMessage = (data) => this.logEngineMessage(data);
            
            // Initial status update
            if (window.uhpClient.connected) {
                this.updateConnectionStatus('Connected to UHP Bridge');
            } else {
                this.updateConnectionStatus('Connecting to UHP Bridge...');
            }
            
            // Hook into game AI trigger
            this.setupAIIntegration();
        }
        
        setupAIIntegration() {
            // Override AI trigger to use UHP engine when enabled
            const originalPerformAIAction = window.performAIAction;
            
            // Store reference for fallback
            window.originalPerformAIAction = originalPerformAIAction;
            
            window.performAIAction = async () => {
                const engineEnabled = document.getElementById('engine-enabled')?.checked;
                const engineColor = document.getElementById('engine-color')?.value || 'black';
                const currentPlayer = window.state?.current;
                
                console.log(`🎯 performAIAction called: enabled=${engineEnabled}, color=${engineColor}, current=${currentPlayer}`);
                
                // Check if UHP engine should handle this move
                if (engineEnabled && window.uhpClient && window.uhpClient.isEnabled()) {
                    const shouldUseEngine = 
                        engineColor === 'both' ||
                        (engineColor === currentPlayer);
                    
                    if (shouldUseEngine) {
                        console.log(`🤖 Using UHP engine for ${currentPlayer} move`);
                        this.logEntry(`🎯 Engine playing ${currentPlayer}`);
                        
                        try {
                            const success = await window.uhpClient.getBestMove();
                            if (success) {
                                return; // Engine move completed
                            }
                        } catch (error) {
                            console.error('❌ UHP engine failed:', error);
                            this.logEntry(`❌ Engine error: ${error.message}`);
                        }
                    }
                }
                
                // Fallback to built-in AI
                console.log(`🧠 Using built-in AI for ${currentPlayer}`);
                this.logEntry(`🧠 Using built-in AI for ${currentPlayer}`);
                if (originalPerformAIAction) {
                    originalPerformAIAction();
                }
            };

            // Also override the AI Engine's checkAndMakeMove to prevent conflicts
            if (window.AIEngine && window.AIEngine.checkAndMakeMove) {
                const originalCheckAndMakeMove = window.AIEngine.checkAndMakeMove;
                
                window.AIEngine.checkAndMakeMove = async () => {
                    const engineEnabled = document.getElementById('engine-enabled')?.checked;
                    const engineColor = document.getElementById('engine-color')?.value || 'black';
                    const currentPlayer = window.state?.current;
                    
                    console.log(`🎯 AIEngine.checkAndMakeMove called: enabled=${engineEnabled}, color=${engineColor}, current=${currentPlayer}`);
                    
                    // Check if UHP engine should handle this move
                    if (engineEnabled && window.uhpClient && window.uhpClient.isEnabled()) {
                        const shouldUseEngine = 
                            engineColor === 'both' ||
                            (engineColor === currentPlayer);
                        
                        if (shouldUseEngine) {
                            console.log(`🚫 Blocking built-in AI - UHP engine will handle ${currentPlayer}`);
                            this.logEntry(`🚫 Blocking built-in AI - UHP engine active`);
                            return; // Block built-in AI
                        }
                    }
                    
                    // Allow built-in AI to proceed
                    console.log(`✅ Allowing built-in AI for ${currentPlayer}`);
                    return originalCheckAndMakeMove.call(window.AIEngine);
                };
            }
        }
        
        // Engine control methods
        handleEngineSelection(engineType) {
            console.log(`🔄 Switching to engine: ${engineType}`);
            this.logEntry(`🔄 Switching to ${engineType} engine`);
            
            if (window.uhpClient) {
                window.uhpClient.setSetting('defaultEngine', engineType);
                window.uhpClient.startEngine(engineType);
            }
        }
        
        async restartEngine() {
            const engineType = document.getElementById('engine-select')?.value || 'nokamute';
            console.log(`🔄 Restarting engine: ${engineType}`);
            this.logEntry(`🔄 Restarting ${engineType} engine`);
            
            // Reset restart button styling
            const restartBtn = document.getElementById('restart-engine');
            if (restartBtn) {
                restartBtn.style.background = '';
                restartBtn.style.animation = '';
                restartBtn.title = 'Restart Engine';
            }
            
            // Apply any pending WASM engine settings
            if (window.wasmEngine && window.wasmEngine.restart) {
                try {
                    await window.wasmEngine.restart();
                    this.logEntry('✅ WASM engine settings applied');
                } catch (error) {
                    console.error('❌ WASM engine restart error:', error);
                    this.logEntry(`❌ WASM restart error: ${error.message}`);
                }
            }
            
            if (window.uhpClient) {
                await window.uhpClient.stopEngine();
                setTimeout(() => {
                    window.uhpClient.startEngine(engineType);
                }, 1000);
            }
        }
        
        setEngineEnabled(enabled) {
            console.log(`🔧 Engine enabled: ${enabled}`);
            this.logEntry(`🔧 Engine ${enabled ? 'enabled' : 'disabled'}`);
            
            if (window.uhpClient) {
                window.uhpClient.setSetting('enabled', enabled);
            }
            
            this.saveSettings();
        }
        
        setEngineMode(mode) {
            console.log(`⚙️ Engine mode: ${mode}`);
            this.logEntry(`⚙️ Mode: ${mode}`);
            
            if (window.uhpClient) {
                window.uhpClient.setSetting('mode', mode);
            }
            
            this.saveSettings();
        }
        
        setTimeLimit(seconds) {
            console.log(`⏱️ Time limit: ${seconds}s`);
            
            if (window.uhpClient) {
                window.uhpClient.setSetting('timeLimit', seconds);
            }
            
            this.saveSettings();
        }
        
        setDepthLimit(depth) {
            console.log(`🔍 Depth limit: ${depth} ply`);
            
            if (window.uhpClient) {
                window.uhpClient.setSetting('depthLimit', depth);
            }
            
            this.saveSettings();
        }
        
        setTableSize(sizeMB) {
            const displaySize = this.formatTableSize(sizeMB);
            console.log(`💾 Transposition table: ${displaySize}`);
            this.logEntry(`💾 Table size: ${displaySize} (restart required)`);
            
            if (window.wasmEngine) {
                window.wasmEngine.setTableSize(sizeMB);
                
                // Listen for engine events to show restart notification
                window.wasmEngine.on('table-size-changed', (data) => {
                    if (data.requiresRestart) {
                        this.showTableSizeWarning(data.newSize);
                    }
                });
            }
            
            this.saveSettings();
        }
        
        showTableSizeWarning(sizeMB) {
            const displaySize = this.formatTableSize(sizeMB);
            
            // Highlight the restart button to indicate action needed
            const restartBtn = document.getElementById('restart-engine');
            if (restartBtn) {
                restartBtn.style.background = '#ff8c00';
                restartBtn.style.animation = 'pulse 2s infinite';
                restartBtn.title = `Restart engine to apply ${displaySize} table size`;
            }
            
            // Create a temporary notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(255, 165, 0, 0.95);
                color: #000;
                padding: 12px 20px;
                border-radius: 8px;
                font-family: 'Milonga', serif;
                font-size: 13px;
                font-weight: bold;
                z-index: 10001;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 300px;
                backdrop-filter: blur(10px);
                border: 2px solid #ff8c00;
            `;
            
            notification.innerHTML = `
                <div style="margin-bottom: 8px;">⚠️ Table Size Changed</div>
                <div style="font-size: 11px; font-weight: normal; margin-bottom: 8px;">
                    Transposition table set to ${displaySize}. Click "🔄 Restart" to apply changes.
                </div>
                <button onclick="this.parentElement.remove()" style="
                    background: #ff8c00;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-family: 'Milonga', serif;
                    font-size: 11px;
                    cursor: pointer;
                ">Got it</button>
            `;
            
            document.body.appendChild(notification);
            
            // Auto-remove after 8 seconds
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 8000);
        }
        
        formatTableSize(sizeMB) {
            if (sizeMB >= 1000) {
                return `${(sizeMB / 1000).toFixed(1)}GB`;
            }
            return `${sizeMB}MB`;
        }
        
        setEngineColor(color) {
            console.log(`🎨 Engine plays: ${color}`);
            this.logEntry(`🎨 Engine plays: ${color}`);
            
            this.saveSettings();
        }
        
        addCustomEngine(path) {
            console.log(`➕ Adding custom engine: ${path}`);
            this.logEntry(`➕ Custom engine: ${path}`);
            
            // TODO: Add custom engine to UHP bridge
            // For now, just log it
            this.saveSettings();
        }
        
        // UI update methods
        updateConnectionStatus(status) {
            const indicator = document.getElementById('connection-indicator');
            const text = document.getElementById('connection-text');
            
            if (indicator && text) {
                text.textContent = status;
                
                // Update indicator style based on status
                indicator.className = 'status-dot';
                if (status.includes('Connected') || status.includes('ready')) {
                    indicator.classList.add('connected');
                } else if (status.includes('Connecting') || status.includes('Starting')) {
                    indicator.classList.add('connecting');
                } else {
                    indicator.classList.add('disconnected');
                }
            }
            
            this.logEntry(`🔗 ${status}`);
        }
        
        updateThinkingIndicator(thinking) {
            const indicator = document.getElementById('engine-thinking-indicator');
            if (indicator) {
                indicator.style.display = thinking ? 'block' : 'none';
            }
            
            // Also manage the progress popup
            this.updateProgressPopup(thinking);
        }
        
        updateProgressPopup(show, data = {}) {
            const popup = document.getElementById('engine-progress-popup');
            if (!popup) return;
            
            if (show) {
                this.showProgressPopup(data);
            } else {
                this.hideProgressPopup();
            }
        }
        
        showProgressPopup(data = {}) {
            const popup = document.getElementById('engine-progress-popup');
            if (!popup) return;
            
            // Reset progress state
            this.progressStartTime = Date.now();
            this.progressUpdateInterval = null;
            this.wasmThinkingListener = null;
            
            // Set initial values
            const timeElement = document.getElementById('progress-time');
            const depthElement = document.getElementById('progress-depth');
            const statusElement = document.getElementById('engine-status');
            const progressBar = document.getElementById('progress-bar');
            const stopwatch = document.getElementById('progress-stopwatch');
            const engineOutput = document.querySelector('.engine-output code');
            const crtScreen = document.querySelector('.crt-screen');
            const progressTitle = document.querySelector('.progress-title');
            
            if (timeElement) timeElement.textContent = '0s';
            if (depthElement) depthElement.textContent = data.depth || '-';
            if (statusElement) statusElement.textContent = data.status || 'Analyzing position...';
            if (stopwatch) stopwatch.textContent = '0.0s';
            if (engineOutput) engineOutput.textContent = '';
            
            // Apply color theme based on AI difficulty comparison
            if (crtScreen && data.difficulty) {
                // Remove existing color classes
                crtScreen.classList.remove('color-green', 'color-amber', 'color-blue');
                // Apply new color class
                crtScreen.classList.add(`color-${data.difficulty}`);
                console.log(`🎨 Applied color class: color-${data.difficulty} to CRT screen`);
            } else if (crtScreen) {
                // Default to green if no difficulty specified
                crtScreen.classList.remove('color-amber', 'color-blue');
                crtScreen.classList.add('color-green');
                console.log(`🎨 Applied default color class: color-green to CRT screen`);
            }
            
            // Update title emoji based on AI name
            if (progressTitle && data.aiName) {
                const emoji = data.aiName.includes('Sunny') ? '🌻' : 
                             data.aiName.includes('Buzzwell') ? '⚔️' :
                             data.aiName.includes('Beedric') ? '👑' : '🤖';
                progressTitle.textContent = `${emoji} Engine Thinking...`;
            }
            
            // Determine progress mode based on engine settings
            const engineMode = document.getElementById('engine-mode')?.value || 'time';
            const timeLimit = parseInt(document.getElementById('time-limit')?.value) || 5;
            const depthLimit = parseInt(document.getElementById('depth-limit')?.value) || 4;
            
            if (progressBar) {
                if (engineMode === 'time') {
                    // Time-based progress
                    progressBar.classList.remove('indeterminate');
                    progressBar.style.width = '0%';
                    this.setupTimeProgress(timeLimit);
                } else if (engineMode === 'depth') {
                    // Depth-based progress (indeterminate for now)
                    progressBar.classList.add('indeterminate');
                    progressBar.style.width = '100%';
                } else {
                    // Unknown mode - indeterminate
                    progressBar.classList.add('indeterminate');
                    progressBar.style.width = '100%';
                }
            }
            
            // Start stopwatch for real-time elapsed display
            this.setupStopwatch();
            
            // Listen for WASM thinking events
            this.setupWASMThinkingListener();
            
            // Show popup with animation
            popup.classList.add('show');
            
            console.log('🎯 Engine progress popup shown');
        }
        
        hideProgressPopup() {
            const popup = document.getElementById('engine-progress-popup');
            if (!popup) return;
            
            // Clear any intervals
            if (this.progressUpdateInterval) {
                clearInterval(this.progressUpdateInterval);
                this.progressUpdateInterval = null;
            }
            
            if (this.stopwatchInterval) {
                clearInterval(this.stopwatchInterval);
                this.stopwatchInterval = null;
            }
            
            // Remove WASM thinking listener
            if (this.wasmThinkingListener && window.wasmEngine) {
                window.wasmEngine.off('thinking', this.wasmThinkingListener);
                this.wasmThinkingListener = null;
            }
            
            // Hide popup with animation
            popup.classList.remove('show');
            
            console.log('🎯 Engine progress popup hidden');
        }
        
        setupStopwatch() {
            const stopwatch = document.getElementById('progress-stopwatch');
            if (!stopwatch) return;
            
            // Update every 50ms for smooth display
            this.stopwatchInterval = setInterval(() => {
                const elapsed = (Date.now() - this.progressStartTime) / 1000;
                stopwatch.textContent = `${elapsed.toFixed(1)}s`;
            }, 50);
        }
        
        setupWASMThinkingListener() {
            // Check for WASM engine (the correct reference)
            if (!window.wasmEngine) return;
            
            const engineOutput = document.querySelector('.engine-output code');
            const depthElement = document.getElementById('progress-depth');
            
            if (!engineOutput) return;
            
            this.wasmThinkingListener = (data) => {
                // Update depth if available
                if (data.depth && depthElement) {
                    depthElement.textContent = data.depth;
                }
                
                // Update output display with last few lines
                if (data.output && data.output.length > 0) {
                    const lines = data.output.slice(-10); // Show last 10 lines
                    engineOutput.textContent = lines.join('\n');
                    
                    // Auto-scroll to bottom
                    const outputContainer = engineOutput.parentElement;
                    if (outputContainer) {
                        outputContainer.scrollTop = outputContainer.scrollHeight;
                    }
                }
            };
            
            window.wasmEngine.on('thinking', this.wasmThinkingListener);
        }
        
        setupTimeProgress(timeLimit) {
            const timeElement = document.getElementById('progress-time');
            const progressBar = document.getElementById('progress-bar');
            
            if (!timeElement || !progressBar) return;
            
            // Update progress every 100ms
            this.progressUpdateInterval = setInterval(() => {
                const elapsed = (Date.now() - this.progressStartTime) / 1000;
                const progress = Math.min((elapsed / timeLimit) * 100, 100);
                
                // Update time display
                timeElement.textContent = `${elapsed.toFixed(1)}s`;
                
                // Update progress bar
                progressBar.style.width = `${progress}%`;
                
                // Stop if we've exceeded the time limit
                if (elapsed >= timeLimit) {
                    clearInterval(this.progressUpdateInterval);
                    this.progressUpdateInterval = null;
                    
                    // Add slight pulsing effect when time is up
                    progressBar.style.animation = 'pulse 1s infinite';
                }
            }, 100);
        }
        
        onEngineReady(engineName) {
            console.log(`✅ Engine ready: ${engineName}`);
            this.logEntry(`✅ ${engineName} engine ready`);
            this.updateConnectionStatus(`${engineName} engine ready`);
        }
        
        onEnginesList(engines) {
            console.log('📋 Available engines:', engines);
            // TODO: Update engine selection dropdown with available engines
        }
        
        // Logging methods
        logEngineMessage(data) {
            if (data.type === 'engine-line') {
                this.logEntry(`🤖 ${data.engine}: ${data.line}`);
            } else if (data.type === 'engine-error') {
                this.logEntry(`❌ ${data.engine}: ${data.message}`);
            }
        }
        
        logEntry(message) {
            const timestamp = new Date().toLocaleTimeString();
            const entry = `${timestamp} ${message}`;
            
            this.engineLogEntries.push(entry);
            
            // Keep only recent entries
            if (this.engineLogEntries.length > this.maxLogEntries) {
                this.engineLogEntries = this.engineLogEntries.slice(-this.maxLogEntries);
            }
            
            this.updateLogDisplay();
        }
        
        updateLogDisplay() {
            const logElement = document.getElementById('engine-log');
            if (logElement) {
                logElement.innerHTML = this.engineLogEntries
                    .slice(-20) // Show only last 20 entries
                    .map(entry => `<div class="log-entry">${entry}</div>`)
                    .join('');
                
                // Auto-scroll to bottom
                logElement.scrollTop = logElement.scrollHeight;
            }
        }
        
        clearLog() {
            this.engineLogEntries = [];
            this.updateLogDisplay();
            this.logEntry('🗑️ Log cleared');
        }
        
        async testEngine() {
            this.logEntry('🧪 Testing engine connection...');
            
            if (!window.uhpClient || !window.uhpClient.connected) {
                this.logEntry('❌ Test failed: No UHP connection');
                return;
            }
            
            try {
                // Test basic engine info
                const response = await window.uhpClient.sendCommand('info');
                if (response && response.length > 0) {
                    this.logEntry(`✅ Test passed: Engine responded`);
                    response.forEach(line => {
                        if (line && line !== 'ok') {
                            this.logEntry(`   ${line}`);
                        }
                    });
                } else {
                    this.logEntry('❌ Test failed: No response from engine');
                }
            } catch (error) {
                this.logEntry(`❌ Test failed: ${error.message}`);
            }
        }
        
        startEngineGame() {
            this.logEntry('🚀 Starting new engine game...');
            
            try {
                // 1. Reset the game to initial state
                if (window.resetGame) {
                    window.resetGame();
                } else {
                    // Fallback: refresh the page to reset
                    console.log('🔄 Resetting game state...');
                    // Reset game state variables
                    if (window.state) {
                        window.state.current = 'white';
                        window.state.move = 1;
                        window.state.gameOver = false;
                    }
                    
                    // Clear the board
                    if (window.cells) {
                        window.cells.forEach(cell => {
                            if (cell.stack) cell.stack.length = 0;
                        });
                    }
                    
                    // Reset pieces to tray
                    if (window.tray) {
                        window.tray.forEach(piece => {
                            if (piece.meta) {
                                piece.meta.placed = false;
                                piece.meta.q = null;
                                piece.meta.r = null;
                            }
                        });
                    }
                }
                
                // 2. Enable UHP engine with current settings
                const engineEnabled = document.getElementById('engine-enabled');
                if (engineEnabled) {
                    engineEnabled.checked = true;
                    this.setEngineEnabled(true);
                }
                
                // 3. Set engine to play black (human plays white)
                const engineColor = document.getElementById('engine-color');
                if (engineColor) {
                    engineColor.value = 'black';
                }
                
                // 4. Close the dev-ops modal
                const modal = document.querySelector('.dev-ops-modal');
                if (modal) {
                    modal.style.display = 'none';
                }
                
                // 5. Update the game display
                if (window.updateHUD) {
                    window.updateHUD();
                }
                
                // 6. Layout trays if function exists
                if (window.layoutTrays) {
                    window.layoutTrays();
                }
                
                this.logEntry('✅ Engine game started - you play white, engine plays black');
                console.log('🎮 Engine game started! Human: White, Engine: Black');
                
            } catch (error) {
                console.error('❌ Failed to start engine game:', error);
                this.logEntry(`❌ Failed to start: ${error.message}`);
            }
        }
        
        // Settings persistence
        saveSettings() {
            const settings = {
                engineEnabled: document.getElementById('engine-enabled')?.checked || false,
                engineMode: document.getElementById('engine-mode')?.value || 'time',
                timeLimit: parseInt(document.getElementById('time-limit')?.value) || 5,
                depthLimit: parseInt(document.getElementById('depth-limit')?.value) || 4,
                tableSize: parseInt(document.getElementById('table-size')?.value) || 100,
                engineColor: document.getElementById('engine-color')?.value || 'black',
                selectedEngine: document.getElementById('engine-select')?.value || 'nokamute'
            };
            
            localStorage.setItem('hyvemynd-engine-settings', JSON.stringify(settings));
        }
        
        loadSettings() {
            try {
                const saved = localStorage.getItem('hyvemynd-engine-settings');
                if (!saved) return;
                
                const settings = JSON.parse(saved);
                
                // Apply saved settings to UI
                const engineEnabled = document.getElementById('engine-enabled');
                if (engineEnabled) engineEnabled.checked = settings.engineEnabled || false;
                
                const engineMode = document.getElementById('engine-mode');
                if (engineMode) engineMode.value = settings.engineMode || 'time';
                
                const timeLimit = document.getElementById('time-limit');
                const timeValue = document.getElementById('time-value');
                if (timeLimit && timeValue) {
                    timeLimit.value = settings.timeLimit || 5;
                    timeValue.textContent = `${settings.timeLimit || 5}s`;
                }
                
                const depthLimit = document.getElementById('depth-limit');
                const depthValue = document.getElementById('depth-value');
                if (depthLimit && depthValue) {
                    depthLimit.value = settings.depthLimit || 4;
                    depthValue.textContent = `${settings.depthLimit || 4} ply`;
                }
                
                const tableSizeSlider = document.getElementById('table-size');
                const tableSizeValue = document.getElementById('table-size-value');
                if (tableSizeSlider && tableSizeValue) {
                    const tableSize = settings.tableSize || 100;
                    tableSizeSlider.value = tableSize;
                    tableSizeValue.textContent = this.formatTableSize(tableSize);
                }
                
                const engineColor = document.getElementById('engine-color');
                if (engineColor) engineColor.value = settings.engineColor || 'black';
                
                const engineSelect = document.getElementById('engine-select');
                if (engineSelect) engineSelect.value = settings.selectedEngine || 'nokamute';
                
                console.log('✅ Engine settings loaded');
                
            } catch (error) {
                console.error('❌ Failed to load engine settings:', error);
            }
        }
    }
    
    // Initialize engine integration
    window.engineIntegration = new EngineIntegration();
    
})();