const WebSocket = require('ws');

// Test the fixed queen movement notation
async function testFixedQueenMovement() {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.on('open', async () => {
        console.log('🔗 Connected to UHP Bridge');
        console.log('🧪 Testing fixed queen movement notation generation...\n');
        
        // Simulate our movement notation generation
        const bestRef = { uhpId: 'bA1', q: -1, r: -1 };
        const deltaQ = -1, deltaR = 1;
        
        console.log(`Reference: ${bestRef.uhpId} at (${bestRef.q}, ${bestRef.r})`);
        console.log(`Delta: (${deltaQ}, ${deltaR})`);
        console.log(`bestRef.q + bestRef.r = ${bestRef.q + bestRef.r} = ${bestRef.q + bestRef.r}`);
        console.log(`(${bestRef.q + bestRef.r}) % 2 = ${(bestRef.q + bestRef.r) % 2}`);
        
        // Apply the fixed logic
        const useAfter = (bestRef.q + bestRef.r) % 2 === 1;
        console.log(`useAfter = ${useAfter}`);
        
        let moveNotation;
        if (useAfter) {
            moveNotation = `wQ ${bestRef.uhpId}/`; // AFTER: ref/
        } else {
            moveNotation = `wQ /${bestRef.uhpId}`; // BEFORE: /ref
        }
        
        console.log(`Generated notation: ${moveNotation}`);
        console.log(`Expected: wQ /bA1\n`);
        
        // Test it with the engine
        const gameString = 'Base;InProgress;White[5];wG1;bG1 wG1-;wS1 /wG1;bQ bG1-;wA1 \\wG1;bA1 bQ-;wQ -wG1;bA1 -wA1';
        
        console.log('📤 Setting up game state:', gameString);
        ws.send(JSON.stringify({type: 'command', data: `newgame ${gameString}`}));
        
        setTimeout(() => {
            console.log(`\n🧪 Testing our generated notation: ${moveNotation}`);
            ws.send(JSON.stringify({type: 'command', data: `play ${moveNotation}`}));
        }, 100);
    });
    
    let responseCount = 0;
    ws.on('message', (data) => {
        const response = data.toString();
        console.log('📬 Engine response:', response);
        
        responseCount++;
        if (responseCount > 3) {
            ws.close();
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
}

testFixedQueenMovement().catch(console.error);