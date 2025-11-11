// Quick test script to understand UHP direction mappings
// Run this with: node test-uhp-directions.js

const WebSocket = require('ws');

class UHPTester {
    constructor() {
        this.ws = null;
    }

    async connect() {
        return new Promise((resolve) => {
            this.ws = new WebSocket('ws://localhost:8080');
            this.ws.on('open', () => {
                console.log('Connected to UHP bridge');
                resolve();
            });
        });
    }

    async startEngine() {
        return new Promise((resolve) => {
            console.log('Starting engine...');
            
            let responseCount = 0;
            const timeout = setTimeout(() => {
                console.log('Engine start timeout - proceeding anyway');
                resolve({type: 'timeout'});
            }, 5000);
            
            const handler = (data) => {
                const response = JSON.parse(data.toString());
                responseCount++;
                console.log(`Engine response ${responseCount}: ${response.type} - ${response.message || ''}`);
                
                if (response.type === 'engine-ready') {
                    clearTimeout(timeout);
                    this.ws.off('message', handler);
                    resolve(response);
                } else if (responseCount >= 3) {
                    // Got some responses, assume engine might be ready
                    clearTimeout(timeout);
                    this.ws.off('message', handler);
                    resolve(response);
                }
            };
            
            this.ws.on('message', handler);
            
            this.ws.send(JSON.stringify({
                type: 'start-engine',
                engine: 'nokamute'
            }));
        });
    }

    async testGameString(gameString) {
        return new Promise((resolve) => {
            console.log(`\nTesting: ${gameString}`);
            
            const timeout = setTimeout(() => {
                console.log('❌ TIMEOUT - no response');
                resolve('TIMEOUT');
            }, 3000);
            
            this.ws.once('message', (data) => {
                clearTimeout(timeout);
                const response = data.toString();
                console.log(`Response: ${response}`);
                resolve(response);
            });
            
            // Send as JSON command to bridge
            this.ws.send(JSON.stringify({
                type: 'command',
                data: `newgame ${gameString}`
            }));
        });
    }

    async runTests() {
        await this.connect();
        await this.startEngine();
        
        // Wait longer for engine to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test the moves that we know work vs fail
        console.log('=== TESTING UHP DIRECTION MAPPINGS ===');
        
        // This worked (engine suggested it)
        await this.testGameString('Base;InProgress;Black[1];wG1;bS1 /wG1');
        
        // This failed (we generated it)  
        await this.testGameString('Base;InProgress;Black[2];wG1;bS1 wG1-;wA1 wG1/');
        
        // Let's test individual pieces at different positions
        console.log('\n=== TESTING INDIVIDUAL POSITIONS ===');
        
        // Test all 6 possible positions around wG1 with both BEFORE and AFTER
        const positions = [
            'bS1 \\wG1',   // BEFORE up-left
            'bS1 wG1\\',   // AFTER up-left  
            'bS1 /wG1',    // BEFORE down-left
            'bS1 wG1/',    // AFTER down-left
            'bS1 -wG1',    // BEFORE left
            'bS1 wG1-',    // AFTER left (right of grasshopper)
        ];
        
        for (const pos of positions) {
            await this.testGameString(`Base;InProgress;Black[1];wG1;${pos}`);
        }
        
        console.log('\nTest complete!');
        this.ws.close();
    }
}

const tester = new UHPTester();
tester.runTests().catch(console.error);