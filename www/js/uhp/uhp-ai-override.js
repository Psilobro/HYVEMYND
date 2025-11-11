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
        
        // Use the UHP client's built-in color checking logic
        return window.uhpClient && 
               window.uhpClient.isEnabled() && 
               window.uhpClient.shouldPlayForColor(currentPlayer);
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
                    
                    // Only use UHP engine for black moves in single player mode
                    if (window.state && window.state.current === 'black') {
                        // Check if UHP engine is already processing to prevent recursion
                        if (window.uhpClient && window.uhpClient.isProcessingCommand) {
                            console.log('🎯 UHP engine already processing, skipping duplicate call');
                            return;
                        }
                        
                        // Use UHP engine
                        setTimeout(() => {
                            if (window.uhpClient && window.uhpClient.connected && !window.uhpClient.isProcessingCommand) {
                                console.log('🎯 Requesting UHP engine move for black...');
                                window.uhpClient.getBestMove();
                            }
                        }, 150);
                        
                        return; // Stop any further AI processing
                    } else {
                        console.log('🤖 UHP AI Override: Not black\'s turn, skipping UHP engine');
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
    
    // Apply overrides when everything is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyOverrides);
    } else {
        applyOverrides();
    }
    
    // Also apply overrides after a delay to catch late initializations
    setTimeout(applyOverrides, 2000);
    
})();