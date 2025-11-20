/**
 * Personality UI Management
 * Handles the Dev Ops > Personalities panel controls for AI engine configuration
 */

(function() {
    'use strict';
    
    // Aggression level labels
    const AGGRESSION_LABELS = {
        1: 'Defensive',
        2: 'Cautious', 
        3: 'Balanced',
        4: 'Aggressive',
        5: 'Reckless'
    };
    
    // Initialize personality controls on page load
    window.addEventListener('DOMContentLoaded', () => {
        initializePersonalityControls();
        initializeAIConsoles();
    });
    
    function initializePersonalityControls() {
        const personalities = ['sunny', 'buzzwell', 'beedric'];
        
        personalities.forEach(name => {
            // Time limit slider
            const timeSlider = document.getElementById(`${name}-time-limit`);
            const timeValue = document.getElementById(`${name}-time-value`);
            if (timeSlider && timeValue) {
                timeSlider.addEventListener('input', (e) => {
                    timeValue.textContent = `${e.target.value}s`;
                });
            }
            
            // Depth limit slider
            const depthSlider = document.getElementById(`${name}-depth-limit`);
            const depthValue = document.getElementById(`${name}-depth-value`);
            if (depthSlider && depthValue) {
                depthSlider.addEventListener('input', (e) => {
                    depthValue.textContent = `${e.target.value} ply`;
                });
            }
            
            // Aggression slider
            const aggressionSlider = document.getElementById(`${name}-aggression`);
            const aggressionValue = document.getElementById(`${name}-aggression-value`);
            if (aggressionSlider && aggressionValue) {
                aggressionSlider.addEventListener('input', (e) => {
                    const level = parseInt(e.target.value);
                    aggressionValue.textContent = `${level} (${AGGRESSION_LABELS[level]})`;
                });
            }
        });
        
        // Save button
        const saveBtn = document.getElementById('save-personalities');
        if (saveBtn) {
            saveBtn.addEventListener('click', savePersonalities);
        }
        
        // Reset button
        const resetBtn = document.getElementById('reset-personalities');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetPersonalities);
        }
        
        // Test button
        const testBtn = document.getElementById('test-personalities');
        if (testBtn) {
            testBtn.addEventListener('click', testPersonalities);
        }
        
        // Load saved values
        loadPersonalities();
    }
    
    function savePersonalities() {
        const personalities = ['sunny', 'buzzwell', 'beedric'];
        const settings = {};
        
        personalities.forEach(name => {
            settings[name] = {
                timeLimit: parseInt(document.getElementById(`${name}-time-limit`).value),
                depthLimit: parseInt(document.getElementById(`${name}-depth-limit`).value),
                aggression: parseInt(document.getElementById(`${name}-aggression`).value),
                hash: parseInt(document.getElementById(`${name}-hash`).value),
                mode: document.getElementById(`${name}-mode`).value,
                randomOpening: document.getElementById(`${name}-random-opening`).checked
            };
        });
        
        localStorage.setItem('personalitySettings', JSON.stringify(settings));
        console.log('💾 Personality settings saved:', settings);
        
        // Visual feedback
        const btn = document.getElementById('save-personalities');
        const originalText = btn.textContent;
        btn.textContent = '✅ Saved!';
        btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }
    
    function loadPersonalities() {
        const saved = localStorage.getItem('personalitySettings');
        if (!saved) return;
        
        try {
            const settings = JSON.parse(saved);
            Object.keys(settings).forEach(name => {
                const config = settings[name];
                
                // Time limit
                const timeSlider = document.getElementById(`${name}-time-limit`);
                const timeValue = document.getElementById(`${name}-time-value`);
                if (timeSlider && config.timeLimit) {
                    timeSlider.value = config.timeLimit;
                    if (timeValue) timeValue.textContent = `${config.timeLimit}s`;
                }
                
                // Depth limit
                const depthSlider = document.getElementById(`${name}-depth-limit`);
                const depthValue = document.getElementById(`${name}-depth-value`);
                if (depthSlider && config.depthLimit) {
                    depthSlider.value = config.depthLimit;
                    if (depthValue) depthValue.textContent = `${config.depthLimit} ply`;
                }
                
                // Aggression
                const aggressionSlider = document.getElementById(`${name}-aggression`);
                const aggressionValue = document.getElementById(`${name}-aggression-value`);
                if (aggressionSlider && config.aggression) {
                    aggressionSlider.value = config.aggression;
                    if (aggressionValue) {
                        aggressionValue.textContent = `${config.aggression} (${AGGRESSION_LABELS[config.aggression]})`;
                    }
                }
                
                // Hash
                const hashSelect = document.getElementById(`${name}-hash`);
                if (hashSelect && config.hash) {
                    hashSelect.value = config.hash;
                }
                
                // Mode
                const modeSelect = document.getElementById(`${name}-mode`);
                if (modeSelect && config.mode) {
                    modeSelect.value = config.mode;
                }
                
                // Random opening
                const randomCheckbox = document.getElementById(`${name}-random-opening`);
                if (randomCheckbox && config.randomOpening !== undefined) {
                    randomCheckbox.checked = config.randomOpening;
                }
            });
            
            console.log('📂 Personality settings loaded:', settings);
        } catch (err) {
            console.error('❌ Failed to load personality settings:', err);
        }
    }
    
    function resetPersonalities() {
        const defaults = {
            sunny: {
                timeLimit: 2,
                depthLimit: 3,
                aggression: 2,
                hash: 32,
                mode: 'time',
                randomOpening: false
            },
            buzzwell: {
                timeLimit: 4,
                depthLimit: 5,
                aggression: 3,
                hash: 64,
                mode: 'time',
                randomOpening: false
            },
            beedric: {
                timeLimit: 10,
                depthLimit: 8,
                aggression: 4,
                hash: 128,
                mode: 'time',
                randomOpening: false
            }
        };
        
        localStorage.setItem('personalitySettings', JSON.stringify(defaults));
        loadPersonalities();
        
        console.log('🔄 Personality settings reset to defaults');
        
        // Visual feedback
        const btn = document.getElementById('reset-personalities');
        const originalText = btn.textContent;
        btn.textContent = '✅ Reset!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }
    
    function testPersonalities() {
        console.log('🧪 Testing personality settings...');
        
        const settings = localStorage.getItem('personalitySettings');
        if (!settings) {
            alert('No saved settings. Using defaults.');
            return;
        }
        
        const config = JSON.parse(settings);
        console.table(config);
        alert('Personality settings logged to console. Check DevTools (F12) → Console tab.');
    }
    
    function initializeAIConsoles() {
        // Create console management functions
        window.showAIConsoles = function() {
            const whiteConsole = document.getElementById('white-ai-console');
            const blackConsole = document.getElementById('black-ai-console');
            if (whiteConsole) whiteConsole.style.display = 'block';
            if (blackConsole) blackConsole.style.display = 'block';
        };
        
        window.hideAIConsoles = function() {
            const whiteConsole = document.getElementById('white-ai-console');
            const blackConsole = document.getElementById('black-ai-console');
            if (whiteConsole) whiteConsole.style.display = 'none';
            if (blackConsole) blackConsole.style.display = 'none';
        };
        
        window.clearAIConsole = function(color) {
            const consoleId = `${color}-ai-console`;
            const consoleOutput = document.querySelector(`#${consoleId} .console-output`);
            if (consoleOutput) {
                consoleOutput.innerHTML = '';
            }
        };
        
        window.writeToAIConsole = function(color, message, cssClass = '') {
            const consoleId = `${color}-ai-console`;
            const consoleOutput = document.querySelector(`#${consoleId} .console-output`);
            if (!consoleOutput) return;
            
            const line = document.createElement('div');
            line.className = `console-line ${cssClass}`;
            line.textContent = message;
            consoleOutput.appendChild(line);
            
            // Auto-scroll to bottom
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
            
            // Limit to last 100 lines
            while (consoleOutput.children.length > 100) {
                consoleOutput.removeChild(consoleOutput.firstChild);
            }
        };
        
        console.log('🖥️ AI console functions initialized');
    }
})();
