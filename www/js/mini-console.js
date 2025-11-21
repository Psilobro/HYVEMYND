/**
 * HYVEMYND Mini-Console System
 * Shows raw engine data stream above player trays during AI thinking
 */

(function() {
    'use strict';
    
    // Mini-console management for raw data stream display
    window.updateMiniConsole = function(color, outputLines, personalityName) {
        console.log(`📟 updateMiniConsole called - color: ${color}, lines: ${outputLines?.length}, personality: ${personalityName}`);
        
        const consoleClass = color === 'white' ? '.white-mini-console' : '.black-mini-console';
        const consoleElement = document.querySelector(consoleClass);
        
        if (!consoleElement) {
            console.warn(`⚠️ Mini-console element not found: ${consoleClass}`);
            return;
        }
        
        console.log(`✅ Found console element: ${consoleClass}`);
        
        // Show THIS console and hide opposite
        const oppositeConsole = document.querySelector(color === 'white' ? '.black-mini-console' : '.white-mini-console');
        consoleElement.style.display = 'flex';
        if (oppositeConsole) oppositeConsole.style.display = 'none';
        
        console.log(`👁️ Console visibility set - showing ${color} console (${consoleClass})`);
        
        // Update icon based on personality
        const icon = consoleElement.querySelector('.player-icon');
        if (icon) {
            // Get personality crest from Personalities system
            let crest = '';
            if (window.Personalities && window.Personalities.opponents) {
                const difficultyMap = {
                    'sunny': 'easy',
                    'buzzwell': 'medium',
                    'beedric': 'hard'
                };
                const difficulty = difficultyMap[personalityName?.toLowerCase()] || 'medium';
                const personality = window.Personalities.opponents[difficulty];
                crest = personality?.crest || (color === 'white' ? '👑' : '🌻');
            } else {
                crest = color === 'white' ? '👑' : '🌻';
            }
            icon.textContent = crest;
            console.log(`🎭 Set icon to: ${crest} for ${color} (${personalityName})`);
        }
        
        // Show countdown spinner with personality time limit
        console.log('🔍 Checking spinner conditions:', {
            personalityName,
            hasShowFunc: !!window.showCountdownSpinner
        });
        
        if (personalityName && window.showCountdownSpinner) {
            // Load settings from localStorage
            const savedSettings = localStorage.getItem('personalitySettings');
            let settings = null;
            
            if (savedSettings) {
                try {
                    const allSettings = JSON.parse(savedSettings);
                    settings = allSettings[personalityName.toLowerCase()];
                    console.log(`⚙️ Loaded personality settings for ${personalityName}:`, settings);
                } catch (e) {
                    console.error('❌ Failed to parse personality settings:', e);
                }
            }
            
            if (settings) {
                const isDepthMode = settings.mode === 'depth';
                const limit = isDepthMode ? settings.depthLimit : settings.timeLimit;
                console.log(`🚀 Calling showCountdownSpinner(${color}, ${limit}, ${isDepthMode})`);
                window.showCountdownSpinner(color, limit, isDepthMode);
            } else {
                console.warn(`⚠️ No settings found for personality: ${personalityName} - using defaults`);
                // Use defaults: sunny=2s, buzzwell=4s, beedric=10s
                const defaults = { sunny: 2, buzzwell: 4, beedric: 10 };
                const defaultTime = defaults[personalityName.toLowerCase()] || 5;
                console.log(`🚀 Calling showCountdownSpinner with default(${color}, ${defaultTime}, false)`);
                window.showCountdownSpinner(color, defaultTime, false);
            }
        } else {
            console.warn('⚠️ Spinner prerequisites not met');
        }
        
        // Update data stream with RAW engine output (slot-machine style rapid updates)
        const dataStream = consoleElement.querySelector('.data-stream');
        if (dataStream) {
            let streamText = '';
            
            // Try to use outputLines first
            if (outputLines && outputLines.length > 0) {
                streamText = outputLines.join(' • ');
                console.log(`📊 Stream (${outputLines.length} lines):`, outputLines);
            } else {
                // Fallback: construct from parsed thinking data
                console.log(`⚠️ No outputLines - using parsed data:`, data);
                const parts = [];
                if (data.depth !== undefined) parts.push(`D${data.depth}`);
                if (data.nodes !== undefined) parts.push(`${data.nodes}n`);
                if (data.nps !== undefined) parts.push(`${data.nps}/s`);
                if (data.pv) parts.push(`PV: ${data.pv.substring(0, 30)}`);
                streamText = parts.length > 0 ? parts.join(' │ ') : '[analyzing...]';
            }
            
            dataStream.textContent = streamText;
            
            // Pulse effect on update
            dataStream.style.opacity = '0.6';
            setTimeout(() => { dataStream.style.opacity = '1'; }, 50);
        }
    };
    
    window.hideMiniConsoles = function() {
        console.log('🙈 Hiding mini-consoles');
        const whiteConsole = document.querySelector('.white-mini-console');
        const blackConsole = document.querySelector('.black-mini-console');
        if (whiteConsole) whiteConsole.style.display = 'none';
        if (blackConsole) blackConsole.style.display = 'none';
        
        // Hide countdown spinners
        if (window.hideAllCountdownSpinners) {
            window.hideAllCountdownSpinners();
        }
    };
    
    // Set up universal thinking listener for all modes
    function setupUniversalThinkingListener() {
        if (!window.wasmEngine) {
            console.log('⏳ Waiting for WASM engine...');
            setTimeout(setupUniversalThinkingListener, 100);
            return;
        }
        
        console.log('🎧 Setting up universal thinking listener for mini-consoles');
        
        window.wasmEngine.on('thinking', (data) => {
            console.log('🧠 WASM thinking event received:', data);
            
            if (!window.state || !window.state.current) {
                console.log('⚠️ No game state available');
                return;
            }
            
            // Don't update console on 'complete' phase - just let it hide naturally
            if (data.phase === 'complete') {
                return;
            }
            
            const currentColor = window.state.current;
            console.log(`🎯 Current turn: ${currentColor}`);
            
            // Get personality name for the AI that is ACTUALLY thinking
            let personalityName = 'buzzwell'; // default
            // INVERT: state.current is who WILL move, but thinking happens BEFORE state updates
            let thinkingColor = currentColor === 'white' ? 'black' : 'white';
            
            // Check if in Dev Ops battle mode
            if (window.devOpsSystem && window.devOpsSystem.currentBattle && window.devOpsSystem.currentBattle.active) {
                // Get personality based on who is ACTUALLY thinking (thinkingColor, not currentColor)
                personalityName = thinkingColor === 'white' 
                    ? window.devOpsSystem.currentBattle.whiteAI 
                    : window.devOpsSystem.currentBattle.blackAI;
                console.log(`🎮 Dev Ops mode - ${thinkingColor} AI (${personalityName}) is thinking`);
            } else {
                // Single player or other mode
                const singleModeBtn = document.getElementById('single-mode-button');
                if (singleModeBtn && singleModeBtn.dataset.difficulty) {
                    personalityName = singleModeBtn.dataset.difficulty;
                    console.log(`👤 Single player mode - personality: ${personalityName}`);
                }
            }
            
            // Show mini-console with REAL raw engine output
            const output = data.output && data.output.length > 0 
                ? data.output 
                : [`[${data.phase || 'thinking'}]`];
            
            console.log(`📊 Updating ${thinkingColor} mini-console (${personalityName}) with ${output.length} lines`);
            window.updateMiniConsole(thinkingColor, output, personalityName);
        });
        
        console.log('✅ Universal thinking listener active');
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupUniversalThinkingListener);
    } else {
        setupUniversalThinkingListener();
    }
    
    console.log('✅ Mini-console system initialized');
})();
