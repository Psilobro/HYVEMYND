/**
 * HYVEMYND Tray Operations System
 * Real-time tray positioning and scaling for multi-screen compatibility
 */

(function() {
    'use strict';

    let traySettings = {
        white: {
            scale: 100,
            x: 0,
            y: 0
        },
        black: {
            scale: 100,
            x: 0,
            y: 0
        }
    };
    
    let linkTrays = false; // Link trays for symmetrical movement

    // Initialize Tray Ops system
    function initTrayOps() {
        console.log('🔧 Initializing Tray Operations system...');
        
        // Load saved settings from localStorage
        loadTraySettings();
        
        // Set up event listeners
        setupEventListeners();
        
        // Delayed application for mobile browser compatibility
        setTimeout(() => {
            applyTraySettings();
            console.log('🔄 Applied initial tray settings after delay');
        }, 100);
        
        // Also apply after full page load for mobile
        if (document.readyState === 'complete') {
            setTimeout(() => {
                applyTraySettings();
                console.log('🔄 Applied tray settings after page complete');
            }, 500);
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    applyTraySettings();
                    console.log('🔄 Applied tray settings after window load');
                }, 500);
            });
        }
        
        console.log('✅ Tray Operations system initialized');
    }

    // Load settings from localStorage
    function loadTraySettings() {
        const savedData = localStorage.getItem('hyvemynd-tray-settings');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                if (data.settings) {
                    traySettings = data.settings;
                } else {
                    // Legacy format compatibility
                    traySettings = data;
                }
                linkTrays = data.linkTrays || false;
                
                // Update UI
                const linkCheckbox = document.getElementById('link-trays-checkbox');
                if (linkCheckbox) linkCheckbox.checked = linkTrays;
                
                console.log('📂 Loaded tray settings:', { traySettings, linkTrays });
            } catch (error) {
                console.warn('⚠️ Failed to load tray settings, using defaults');
            }
        }
    }

    // Save settings to localStorage
    function saveTraySettings() {
        const dataToSave = {
            settings: traySettings,
            linkTrays: linkTrays
        };
        localStorage.setItem('hyvemynd-tray-settings', JSON.stringify(dataToSave));
        console.log('💾 Saved tray settings:', dataToSave);
    }

    // Set up all event listeners
    function setupEventListeners() {
        // Modal toggle
        const trayOpsToggle = document.getElementById('tray-ops-button');
        const trayOpsModal = document.getElementById('tray-ops-modal');
        const closeTrayOps = document.getElementById('close-tray-ops');

        if (trayOpsToggle) {
            trayOpsToggle.addEventListener('click', () => {
                trayOpsModal.style.display = 'flex';
                updateSliderValues();
            });
        }

        if (closeTrayOps) {
            closeTrayOps.addEventListener('click', () => {
                trayOpsModal.style.display = 'none';
                saveTraySettings();
            });
        }

        // Close modal when clicking outside
        if (trayOpsModal) {
            trayOpsModal.addEventListener('click', (e) => {
                if (e.target === trayOpsModal) {
                    trayOpsModal.style.display = 'none';
                    saveTraySettings();
                }
            });
        }

        // White tray sliders
        setupSlider('white-tray-scale', 'white', 'scale', '%');
        setupSlider('white-tray-x', 'white', 'x', 'px');
        setupSlider('white-tray-y', 'white', 'y', 'px');

        // Black tray sliders
        setupSlider('black-tray-scale', 'black', 'scale', '%');
        setupSlider('black-tray-x', 'black', 'x', 'px');
        setupSlider('black-tray-y', 'black', 'y', 'px');
        
        // Link Trays toggle
        setupLinkTraysToggle();
    }

    // Set up Link Trays toggle
    function setupLinkTraysToggle() {
        const linkCheckbox = document.getElementById('link-trays-checkbox');
        if (!linkCheckbox) {
            console.warn('⚠️ Link trays checkbox not found');
            return;
        }
        
        linkCheckbox.addEventListener('change', (e) => {
            linkTrays = e.target.checked;
            console.log(`🔗 Link trays: ${linkTrays ? 'ON' : 'OFF'}`);
            saveTraySettings();
        });
    }

    // Set up individual slider with real-time updates and linking - enhanced for mobile
    function setupSlider(sliderId, tray, property, unit) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(`${tray}-${property}-value`);

        if (!slider || !valueDisplay) {
            console.warn(`⚠️ Slider elements not found: ${sliderId}`);
            return;
        }
        
        let isUpdating = false; // Prevent circular updates

        // Handle multiple event types for better mobile support
        const handleSliderChange = (e) => {
            if (isUpdating) return;
            
            const value = parseInt(e.target.value);
            const oldValue = traySettings[tray][property];
            traySettings[tray][property] = value;
            
            // Update display immediately
            valueDisplay.textContent = `${value}${unit}`;
            
            // Handle linking if enabled
            if (linkTrays && !isUpdating) {
                isUpdating = true;
                const otherTray = tray === 'white' ? 'black' : 'white';
                
                if (property === 'x') {
                    // Horizontal: opposite direction for symmetry
                    const delta = value - oldValue;
                    const newOtherValue = traySettings[otherTray][property] - delta;
                    traySettings[otherTray][property] = newOtherValue;
                    updateLinkedSlider(otherTray, property, newOtherValue, unit);
                } else {
                    // Scale and Y: same direction
                    traySettings[otherTray][property] = value;
                    updateLinkedSlider(otherTray, property, value, unit);
                }
                
                setTimeout(() => { isUpdating = false; }, 10);
            }
            
            // Force immediate DOM update for mobile
            requestAnimationFrame(() => {
                applyTraySettings();
            });
        };

        // Multiple event listeners for better mobile compatibility
        slider.addEventListener('input', handleSliderChange);
        slider.addEventListener('change', (e) => {
            handleSliderChange(e);
            saveTraySettings(); // Save when user finishes
        });
        
        // Additional mobile-specific events
        slider.addEventListener('touchmove', handleSliderChange, { passive: true });
        slider.addEventListener('touchend', () => saveTraySettings());
    }
    
    // Update linked slider UI
    function updateLinkedSlider(tray, property, value, unit) {
        const sliderId = `${tray}-tray-${property}`;
        const valueId = `${tray}-${property}-value`;
        
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);
        
        if (slider) slider.value = value;
        if (valueDisplay) valueDisplay.textContent = `${value}${unit}`;
    }

    // Update slider values in UI
    function updateSliderValues() {
        // White tray
        updateSliderValue('white-tray-scale', 'white-scale-value', traySettings.white.scale, '%');
        updateSliderValue('white-tray-x', 'white-x-value', traySettings.white.x, 'px');
        updateSliderValue('white-tray-y', 'white-y-value', traySettings.white.y, 'px');

        // Black tray
        updateSliderValue('black-tray-scale', 'black-scale-value', traySettings.black.scale, '%');
        updateSliderValue('black-tray-x', 'black-x-value', traySettings.black.x, 'px');
        updateSliderValue('black-tray-y', 'black-y-value', traySettings.black.y, 'px');
    }

    // Update individual slider value
    function updateSliderValue(sliderId, valueId, value, unit) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);
        
        if (slider) slider.value = value;
        if (valueDisplay) valueDisplay.textContent = `${value}${unit}`;
    }

    // Apply tray settings to the actual tray elements
    function applyTraySettings() {
        applyTrayTransform('white-tray', traySettings.white);
        applyTrayTransform('black-tray', traySettings.black);
    }

    // Apply transform to specific tray - enhanced for mobile compatibility
    function applyTrayTransform(trayId, settings) {
        const trayElement = document.getElementById(trayId);
        if (!trayElement) {
            console.warn(`⚠️ Tray element not found: ${trayId}`);
            return;
        }

        const scalePercent = settings.scale / 100;
        const transform = `translate(${settings.x}px, ${settings.y}px) scale(${scalePercent})`;
        
        // Enhanced mobile support with multiple approaches
        trayElement.style.transform = transform;
        trayElement.style.webkitTransform = transform; // Safari/iOS
        trayElement.style.mozTransform = transform;    // Firefox
        trayElement.style.msTransform = transform;     // IE/Edge
        trayElement.style.transformOrigin = 'center center';
        trayElement.style.webkitTransformOrigin = 'center center';
        trayElement.style.willChange = 'transform';
        
        // Force multiple reflows for stubborn mobile browsers
        trayElement.offsetHeight;
        trayElement.getBoundingClientRect();
        
        // Additional approach: directly modify canvas if it's a PIXI container
        const canvas = trayElement.querySelector('canvas');
        if (canvas) {
            canvas.style.transform = transform;
            canvas.style.webkitTransform = transform;
            canvas.offsetHeight; // Force canvas reflow
        }
        
        // Comprehensive mobile debug logging
        console.log(`🎯 Applied transform to ${trayId}:`, transform);
        console.log(`📍 Tray element:`, trayElement);
        console.log(`📍 Canvas element:`, canvas);
        console.log(`📍 Final computed style:`, getComputedStyle(trayElement).transform);
        console.log(`📍 Tray bounds:`, trayElement.getBoundingClientRect());
    }

    // Reset tray to default settings
    function resetTray(trayColor) {
        traySettings[trayColor] = {
            scale: 100,
            x: 0,
            y: 0
        };
        
        updateSliderValues();
        applyTraySettings();
        saveTraySettings();
        
        console.log(`🔄 Reset ${trayColor} tray to defaults`);
    }

    // Mobile debugging function
    function debugMobileTrays() {
        console.log('🔍 Mobile Tray Debug Info:');
        console.log('User Agent:', navigator.userAgent);
        console.log('Touch support:', 'ontouchstart' in window);
        console.log('Current settings:', traySettings);
        
        ['white-tray', 'black-tray'].forEach(trayId => {
            const element = document.getElementById(trayId);
            if (element) {
                console.log(`${trayId}:`, {
                    element: element,
                    transform: getComputedStyle(element).transform,
                    bounds: element.getBoundingClientRect(),
                    children: element.children.length,
                    canvas: element.querySelector('canvas')
                });
            } else {
                console.log(`${trayId}: NOT FOUND`);
            }
        });
    }

    // Public API
    window.TrayOps = {
        init: initTrayOps,
        reset: resetTray,
        debug: debugMobileTrays,
        getSettings: () => ({ ...traySettings }),
        setSettings: (newSettings) => {
            traySettings = { ...traySettings, ...newSettings };
            updateSliderValues();
            applyTraySettings();
            saveTraySettings();
        }
    };

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTrayOps);
    } else {
        initTrayOps();
    }

})();