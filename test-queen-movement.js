const WebSocket = require('ws');

// Test the specific queen movement that's causing issues
async function testQueenMovement() {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.on('open', async () => {
        console.log('🔗 Connected to UHP Bridge');
        
        // Build the exact game state up to the queen movement
        const gameString = 'Base;InProgress;White[5];wG1;bG1 wG1-;wS1 /wG1;bQ bG1-;wA1 \\wG1;bA1 bQ-;wQ -wG1;bA1 -wA1';
        
        console.log('📤 Setting up game state:', gameString);
        ws.send(JSON.stringify({type: 'command', data: `newgame ${gameString}`}));
        
        // Wait a moment
        setTimeout(() => {
            // Test different queen movement notations
            console.log('\n🧪 Testing queen movement variations:');
            
            // Test 1: Current problematic notation
            console.log('1️⃣ Testing: wQ bA1/');
            ws.send(JSON.stringify({type: 'command', data: 'validmoves'}));
            
        }, 100);
    });
    
    let responseCount = 0;
    ws.on('message', (data) => {
        const response = data.toString();
        console.log('📬 Engine response:', response);
        
        responseCount++;
        if (responseCount === 2) { // After getting valid moves
            console.log('\n2️⃣ Testing queen movement: wQ bA1/');
            ws.send(JSON.stringify({type: 'command', data: 'play wQ bA1/'}));
        } else if (responseCount === 3) {
            console.log('\n3️⃣ Testing alternative queen movement notations...');
            
            // Reset game and try different reference pieces
            const gameString = 'Base;InProgress;White[5];wG1;bG1 wG1-;wS1 /wG1;bQ bG1-;wA1 \\wG1;bA1 bQ-;wQ -wG1;bA1 -wA1';
            ws.send(JSON.stringify({type: 'command', data: `newgame ${gameString}`}));
            
            setTimeout(() => {
                console.log('Trying: wQ -wS1 (using white spider as reference)');
                ws.send(JSON.stringify({type: 'command', data: 'play wQ -wS1'}));
            }, 50);
        } else if (responseCount === 5) {
            // Try another alternative
            setTimeout(() => {
                const gameString = 'Base;InProgress;White[5];wG1;bG1 wG1-;wS1 /wG1;bQ bG1-;wA1 \\wG1;bA1 bQ-;wQ -wG1;bA1 -wA1';
                ws.send(JSON.stringify({type: 'command', data: `newgame ${gameString}`}));
                
                setTimeout(() => {
                    console.log('Trying: wQ \\wG1 (using white grasshopper as reference)');
                    ws.send(JSON.stringify({type: 'command', data: 'play wQ \\wG1'}));
                }, 50);
            }, 50);
        } else if (responseCount > 6) {
            ws.close();
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
}

testQueenMovement().catch(console.error);