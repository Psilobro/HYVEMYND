const WebSocket = require('ws');

// Test what the engine thinks about the queen movement
async function analyzeQueenMovement() {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.on('open', async () => {
        console.log('🔗 Connected to UHP Bridge');
        
        // Set up the game state correctly first
        const gameString = 'Base;InProgress;White[5];wG1;bG1 wG1-;wS1 /wG1;bQ bG1-;wA1 \\wG1;bA1 bQ-;wQ -wG1;bA1 -wA1';
        
        console.log('📤 Setting up game state:', gameString);
        ws.send(JSON.stringify({type: 'command', data: `newgame ${gameString}`}));
        
        setTimeout(() => {
            // Let's try the engine's suggested notation
            console.log('\n🧪 Testing engine-suggested queen movements:');
            console.log('1️⃣ Testing: wQ /bA1');
            ws.send(JSON.stringify({type: 'command', data: 'play wQ /bA1'}));
        }, 100);
    });
    
    let responseCount = 0;
    ws.on('message', (data) => {
        const response = data.toString();
        console.log('📬 Engine response:', response);
        
        responseCount++;
        if (responseCount === 3) { // After testing wQ /bA1
            console.log('\n✅ Success! Now let\'s see the resulting game state:');
            ws.send(JSON.stringify({type: 'command', data: 'showboard'}));
        } else if (responseCount === 5) {
            console.log('\n2️⃣ Let\'s also test: wQ /wQ (the other valid option)');
            
            // Reset and try the other option
            const gameString = 'Base;InProgress;White[5];wG1;bG1 wG1-;wS1 /wG1;bQ bG1-;wA1 \\wG1;bA1 bQ-;wQ -wG1;bA1 -wA1';
            ws.send(JSON.stringify({type: 'command', data: `newgame ${gameString}`}));
            
            setTimeout(() => {
                ws.send(JSON.stringify({type: 'command', data: 'play wQ /wQ'}));
            }, 50);
        } else if (responseCount > 7) {
            ws.close();
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
}

analyzeQueenMovement().catch(console.error);