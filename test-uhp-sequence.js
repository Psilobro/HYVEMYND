// Test UHP string piece by piece with nokamute engine
const { spawn } = require('child_process');

async function testUHPSequence() {
    console.log('🤖 Testing UHP move sequence with nokamute...');
    
    const moves = [
        'Base;InProgress;White[1];wG1',
        'Base;InProgress;White[1];wG1;bG1 wG1-',
        'Base;InProgress;White[2];wG1;bG1 wG1-;wA1 wG1/',
        'Base;InProgress;White[2];wG1;bG1 wG1-;wA1 wG1/;bQ bG1-',
        'Base;InProgress;White[3];wG1;bG1 wG1-;wA1 wG1/;bQ bG1-;wS1 /wG1'
    ];
    
    for (let i = 0; i < moves.length; i++) {
        console.log(`\n🔍 Testing move ${i + 1}: ${moves[i]}`);
        
        await new Promise((resolve) => {
            const nokamute = spawn('./nokamute.exe', [], {
                cwd: 'c:\\Users\\Marlowe\\Desktop\\Hive\\HYVEMYND\\tools',
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let output = '';
            let errorOutput = '';
            
            nokamute.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            nokamute.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            nokamute.on('close', (code) => {
                console.log('Output:', output.trim());
                if (errorOutput) console.log('Errors:', errorOutput.trim());
                if (output.includes('invalidmove')) {
                    console.log('❌ INVALID MOVE DETECTED');
                } else if (output.includes('ok')) {
                    console.log('✅ Move accepted');
                }
                resolve();
            });
            
            // Send commands
            setTimeout(() => {
                nokamute.stdin.write(`newgame ${moves[i]}\n`);
            }, 50);
            
            setTimeout(() => {
                nokamute.stdin.write('validmoves\n');
            }, 100);
            
            setTimeout(() => {
                nokamute.stdin.write('quit\n');
            }, 150);
        });
    }
}

testUHPSequence().catch(console.error);