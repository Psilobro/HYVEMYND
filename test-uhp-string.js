// Test UHP string directly with engine
// Run this while UHP bridge is running: node test-uhp-string.js

const WebSocket = require('ws');

async function testUHPString() {
    const ws = new WebSocket('ws://localhost:8080');
    
    await new Promise(resolve => {
        ws.on('open', resolve);
    });
    
    console.log('Connected to UHP bridge');
    
    // Start engine
    console.log('Starting engine...');
    ws.send(JSON.stringify({
        type: 'start-engine',
        engine: 'nokamute'
    }));
    
    // Wait for engine to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test the exact string that's failing
    const gameString = 'Base;InProgress;Black[3];wG1;bS1 wG1-;wA1 wG1/;bQ bS1-;wS1 /wG1';
    
    console.log(`\\nTesting game string: ${gameString}`);
    
    const response = await new Promise(resolve => {
        const timeout = setTimeout(() => resolve('TIMEOUT'), 3000);
        
        ws.once('message', (data) => {
            clearTimeout(timeout);
            resolve(data.toString());
        });
        
        ws.send(JSON.stringify({
            type: 'command',
            data: `newgame ${gameString}`
        }));
    });
    
    console.log(`Response: ${response}`);
    
    // Test simpler working examples
    console.log('\\n=== Testing known working examples ===');
    
    const workingExamples = [
        'Base;InProgress;Black[1];wG1',
        'Base;InProgress;White[2];wG1;bS1 wG1-',
        'Base;InProgress;Black[2];wG1;bS1 wG1-;wA1 -wG1'
    ];
    
    for (const example of workingExamples) {
        console.log(`\\nTesting: ${example}`);
        const response = await new Promise(resolve => {
            const timeout = setTimeout(() => resolve('TIMEOUT'), 2000);
            
            ws.once('message', (data) => {
                clearTimeout(timeout);
                resolve(data.toString());
            });
            
            ws.send(JSON.stringify({
                type: 'command', 
                data: `newgame ${example}`
            }));
        });
        console.log(`Response: ${response}`);
    }
    
    ws.close();
}

testUHPString().catch(console.error);