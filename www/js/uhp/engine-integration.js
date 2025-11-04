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
            window.updateEngineThinking = (thinking) => this.updateThinkingIndicator(thinking);
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
        
        // Settings persistence
        saveSettings() {
            const settings = {
                engineEnabled: document.getElementById('engine-enabled')?.checked || false,
                engineMode: document.getElementById('engine-mode')?.value || 'time',
                timeLimit: parseInt(document.getElementById('time-limit')?.value) || 5,
                depthLimit: parseInt(document.getElementById('depth-limit')?.value) || 4,
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