const WebSocket = require('ws');

// Test the specific problematic queen movement
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
    console.log('🔗 Connected to UHP Bridge');
    
    // Send the exact game state that's failing
    const gameState = 'Base;InProgress;Black[5];wG1;bG1 wG1-;wS1 /wG1;bQ bG1-;wA1 \\wG1;bA1 bQ-;wQ -wG1;bA1 -wA1;wQ bA1/';
    
    console.log('📤 Testing game state:', gameState);
    ws.send(JSON.stringify({
        type: 'command',
        data: `newgame ${gameState}`
    }));
});

ws.on('message', function message(data) {
    try {
        const response = JSON.parse(data);
        console.log('📬 Engine response:', response);
        
        if (response.length > 0 && response[0].includes('invalidmove')) {
            console.log('❌ Engine rejected the game state');
            console.log('🔍 Let\'s test a simpler case to isolate the issue...');
            
            // Test just the moves before the queen movement
            const simplerState = 'Base;InProgress;White[5];wG1;bG1 wG1-;wS1 /wG1;bQ bG1-;wA1 \\wG1;bA1 bQ-;wQ -wG1;bA1 -wA1';
            console.log('📤 Testing simpler state:', simplerState);
            ws.send(JSON.stringify({
                type: 'command', 
                data: `newgame ${simplerState}`
            }));
        } else if (response.length > 0 && response[0] === 'ok') {
            console.log('✅ Game state accepted');
            // Now ask for a move
            ws.send(JSON.stringify({
                type: 'command',
                data: 'bestmove time 00:00:01'
            }));
        } else if (response.length > 0 && !response[0].includes('invalidmove')) {
            console.log('🎯 Engine suggests:', response[0]);
            ws.close();
        }
    } catch (e) {
        console.log('📬 Raw response:', data.toString());
    }
});

ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
    console.log('🔌 Connection closed');
});