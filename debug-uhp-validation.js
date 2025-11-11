// Debug UHP validation - analyze the rejected game state
const readline = require('readline');
const { spawn } = require('child_process');

// The game state that's being rejected
const gameString = "Base;InProgress;White[3];wG1;bG1 wG1-;wA1 wG1/;bQ bG1-;wS1 /wG1";

console.log('🔍 Analyzing UHP game state rejection:');
console.log('Game string:', gameString);
console.log('');

// Parse the moves manually
const parts = gameString.split(';');
console.log('Game format:', parts[0]);
console.log('Game state:', parts[1]); 
console.log('Turn info:', parts[2]);
console.log('Moves:', parts.slice(3));
console.log('');

// Analyze each move
const moves = parts.slice(3);
console.log('Move analysis:');
moves.forEach((move, i) => {
    console.log(`Move ${i + 1}: ${move}`);
    
    // Parse move components
    if (move.includes(' ')) {
        const [piece, position] = move.split(' ');
        console.log(`  Piece: ${piece}`);
        console.log(`  Position: ${position}`);
        
        // Check for directional notation
        if (position.includes('/') || position.includes('-') || position.includes('\\')) {
            console.log(`  Direction type: ${position.includes('/') ? 'forward-slash' : position.includes('-') ? 'dash' : 'backslash'}`);
        }
    } else {
        console.log(`  First piece: ${move}`);
    }
    console.log('');
});

// Test with nokamute engine
async function testWithEngine() {
    console.log('🤖 Testing with nokamute engine...');
    
    const nokamute = spawn('./nokamute.exe', [], {
        cwd: 'c:\\Users\\Marlowe\\Desktop\\Hive\\HYVEMYND\\tools',
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    
    nokamute.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Engine output:', data.toString().trim());
    });
    
    nokamute.stderr.on('data', (data) => {
        console.error('Engine error:', data.toString().trim());
    });
    
    // Send commands
    setTimeout(() => {
        console.log('📤 Sending newgame command...');
        nokamute.stdin.write(`newgame ${gameString}\n`);
    }, 100);
    
    setTimeout(() => {
        console.log('📤 Sending validmoves command...');
        nokamute.stdin.write('validmoves\n');
    }, 200);
    
    setTimeout(() => {
        nokamute.stdin.write('quit\n');
    }, 300);
    
    nokamute.on('close', (code) => {
        console.log(`\nEngine exited with code ${code}`);
        console.log('Full output:', output);
    });
}

// Run the test
testWithEngine().catch(console.error);