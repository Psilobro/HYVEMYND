/**
 * Countdown Spinner System
 * Displays rotating hexagonal pieces with countdown timers above mini-consoles
 * during AI thinking phases.
 */

(function() {
    'use strict';

    // Pixi application for spinners (separate from game board)
    let spinnerApp = null;
    let whiteSpinner = null;
    let blackSpinner = null;
    let whiteCountdownInterval = null;
    let blackCountdownInterval = null;

    // Constants
    const SPINNER_RADIUS = 20; // 40px diameter
    const ROTATION_SPEED = 1; // 1 revolution per second

    /**
     * Initialize the Pixi application for spinners
     */
    function initSpinnerApp() {
        if (spinnerApp) return;

        const container = document.getElementById('countdown-spinners');
        if (!container) {
            console.error('❌ Countdown spinner container not found');
            return;
        }

        spinnerApp = new PIXI.Application({
            width: window.innerWidth,
            height: 200, // Increased height for spinners below consoles
            backgroundColor: 0x000000,
            backgroundAlpha: 0, // Transparent
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });

        container.appendChild(spinnerApp.view);
        console.log('✅ Countdown spinner app initialized');
    }

    /**
     * Draw a rounded hexagonal tile (similar to pieces.js)
     */
    function drawRoundedHex(graphics, radius, fillColor) {
        const cornerRadius = 8;
        const points = [];
        const angleStep = Math.PI / 3;

        // Generate 6 vertices for hexagon
        for (let i = 0; i < 6; i++) {
            points.push({
                x: radius * Math.cos(angleStep * i),
                y: radius * Math.sin(angleStep * i)
            });
        }

        graphics.beginFill(fillColor);
        graphics.lineStyle(2, fillColor === 0xFFFFFF ? 0x000000 : 0xFFFFFF, 0.3);

        // Start from midpoint between last and first vertex
        const last = points[points.length - 1];
        const first = points[0];
        graphics.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);

        // Draw rounded corners
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            graphics.arcTo(p1.x, p1.y, p2.x, p2.y, cornerRadius);
        }

        graphics.closePath();
        graphics.endFill();
    }

    /**
     * Create a spinner for a specific color
     */
    function createSpinner(color) {
        const container = new PIXI.Container();
        
        // Draw hexagon
        const hex = new PIXI.Graphics();
        const fillColor = color === 'white' ? 0xFFFFFF : 0x000000;
        drawRoundedHex(hex, SPINNER_RADIUS, fillColor);
        container.addChild(hex);

        // Add countdown text
        const textColor = color === 'white' ? '#000000' : '#FFFFFF';
        const text = new PIXI.Text('', {
            fontFamily: 'Arial, sans-serif',
            fontSize: 16,
            fontWeight: 'bold',
            fill: textColor,
            align: 'center'
        });
        text.anchor.set(0.5);
        text.x = 0;
        text.y = 0;
        container.addChild(text);

        // Store reference to text for updates
        container.countdownText = text;
        
        // Start hidden
        container.visible = false;

        return container;
    }

    /**
     * Position spinner based on screen size
     */
    function positionSpinner(spinner, color) {
        if (!spinner) return;

        const isMobile = window.innerWidth <= 768;
        const consoleTop = isMobile ? 10 : 83;
        const consoleHeight = 32; // Mini-console height
        const spinnerTop = consoleTop + consoleHeight + 16; // Below console + 16px gap
        const horizontalOffset = 20 + SPINNER_RADIUS; // Account for spinner radius

        // Move spinners 200px towards center (400px total closer)
        const centerOffset = 200;
        spinner.x = color === 'white' ? horizontalOffset + centerOffset : window.innerWidth - horizontalOffset - centerOffset;
        spinner.y = spinnerTop + SPINNER_RADIUS; // Account for anchor point (center of hex)
    }

    /**
     * Show countdown spinner for a specific color
     */
    window.showCountdownSpinner = function(color, timeLimit, isDepthMode = false) {
        console.log(`🔄 showCountdownSpinner called - color: ${color}, limit: ${timeLimit}, depthMode: ${isDepthMode}`);
        
        if (!spinnerApp) {
            console.log('⚙️ Initializing spinner app...');
            initSpinnerApp();
        }
        if (!spinnerApp) {
            console.error('❌ Failed to initialize spinner app');
            return;
        }

        console.log(`🔄 Showing ${color} countdown spinner: ${isDepthMode ? 'D' + timeLimit : timeLimit + 's'}`);

        // Create spinner if it doesn't exist
        if (color === 'white' && !whiteSpinner) {
            whiteSpinner = createSpinner('white');
            spinnerApp.stage.addChild(whiteSpinner);
        } else if (color === 'black' && !blackSpinner) {
            blackSpinner = createSpinner('black');
            spinnerApp.stage.addChild(blackSpinner);
        }

        const spinner = color === 'white' ? whiteSpinner : blackSpinner;
        const oppositeSpinner = color === 'white' ? blackSpinner : whiteSpinner;
        if (!spinner) return;

        // Hide opposite spinner
        if (oppositeSpinner) {
            oppositeSpinner.visible = false;
            if (oppositeSpinner.rotationTween) {
                oppositeSpinner.rotationTween.kill();
            }
        }

        // Position and show
        positionSpinner(spinner, color);
        spinner.visible = true;

        // Start rotation animation
        if (spinner.rotationTween) spinner.rotationTween.kill();
        spinner.rotation = 0;
        spinner.rotationTween = gsap.to(spinner, {
            rotation: Math.PI * 2,
            duration: ROTATION_SPEED,
            repeat: -1,
            ease: 'none',
            onUpdate: function() {
                // Counter-rotate text to keep it upright while hex spins
                if (spinner.countdownText) {
                    spinner.countdownText.rotation = -spinner.rotation;
                }
            }
        });

        // Set up countdown
        if (isDepthMode) {
            // Depth mode: show static depth value
            spinner.countdownText.text = 'D' + timeLimit;
        } else {
            // Time mode: countdown from timeLimit
            let countdown = timeLimit;
            spinner.countdownText.text = countdown;

            // Clear any existing interval
            if (color === 'white') {
                clearInterval(whiteCountdownInterval);
                whiteCountdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown >= 0 && spinner.countdownText) {
                        spinner.countdownText.text = countdown;
                    }
                    if (countdown < 0) {
                        clearInterval(whiteCountdownInterval);
                        whiteCountdownInterval = null;
                    }
                }, 1000);
            } else {
                clearInterval(blackCountdownInterval);
                blackCountdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown >= 0 && spinner.countdownText) {
                        spinner.countdownText.text = countdown;
                    }
                    if (countdown < 0) {
                        clearInterval(blackCountdownInterval);
                        blackCountdownInterval = null;
                    }
                }, 1000);
            }
        }
    };

    /**
     * Hide countdown spinner for a specific color
     */
    window.hideCountdownSpinner = function(color) {
        console.log(`🙈 Hiding ${color} countdown spinner`);

        const spinner = color === 'white' ? whiteSpinner : blackSpinner;
        if (spinner) {
            spinner.visible = false;
            if (spinner.rotationTween) {
                spinner.rotationTween.kill();
                spinner.rotationTween = null;
            }
            if (spinner.countdownText) {
                spinner.countdownText.rotation = 0;
            }
        }

        // Clear countdown interval
        if (color === 'white') {
            clearInterval(whiteCountdownInterval);
            whiteCountdownInterval = null;
        } else {
            clearInterval(blackCountdownInterval);
            blackCountdownInterval = null;
        }
    };

    /**
     * Hide all spinners
     */
    window.hideAllCountdownSpinners = function() {
        hideCountdownSpinner('white');
        hideCountdownSpinner('black');
    };

    /**
     * Handle window resize
     */
    window.addEventListener('resize', () => {
        if (!spinnerApp) return;

        spinnerApp.renderer.resize(window.innerWidth, 200);
        
        if (whiteSpinner && whiteSpinner.visible) {
            positionSpinner(whiteSpinner, 'white');
        }
        if (blackSpinner && blackSpinner.visible) {
            positionSpinner(blackSpinner, 'black');
        }
    });

    // Initialize on page load
    window.addEventListener('load', () => {
        console.log('🎬 Page loaded - initializing countdown spinners...');
        initSpinnerApp();
    });

    console.log('✅ Countdown spinner module loaded');
})();
