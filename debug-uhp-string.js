/**
 * Test UHP game string for errors
 * Based on the console log from the user
 */

const gameString = "Base;InProgress;White[21];wG1;bG1 wG1\\;wS1 -wG1;bQ bG1\\;wS2 wG1/;bA1 bQ\\;wQ \\wG1;bA1 /wS1;wS2 bQ-;bA2 /bG1;wA1 wG1/;bA2 \\wQ;wA1 bQ\\;bS1 /bG1;wA2 wS2\\;bA3 bA1\\;wG1 \\bA1;bA2 wQ\\;wQ bA2/;bA3 wQ/;wG1 bA1\\;bG1 -wQ;wA2 bQ/;bS2 -bA1;wG2 wS2/;bA2 wQ\\;wG2 \\bQ;bS1 wA1\\;wA2 -bQ;bG2 bQ/;wS1 -bS2;bS1 bG2\\;wB1 /wA1;bS1 wQ-;wB1 /bQ;bG2 /wQ;wG3 wS2\\;bA3 wG3\\;wB2 wS2/;bS1 wB2-;wA3 /wA1";

console.log('🔍 Analyzing UHP game string for potential issues...\n');

// Split into moves
const parts = gameString.split(';');
const header = parts.slice(0, 3).join(';'); // Base;InProgress;White[21]
const moves = parts.slice(3);

console.log(`📝 Header: ${header}`);
console.log(`📝 Total moves: ${moves.length}`);
console.log('\n🔍 Checking for potential issues:\n');

// Check for piece consistency
const pieceMoves = {};
let issues = [];

moves.forEach((move, index) => {
    const moveNum = index + 1;
    
    // Extract piece ID from move
    let pieceMatch = move.match(/^([wb][QAGBS]\d*)/);
    if (pieceMatch) {
        const pieceId = pieceMatch[1];
        
        if (!pieceMoves[pieceId]) {
            pieceMoves[pieceId] = [];
        }
        pieceMoves[pieceId].push(`Move ${moveNum}: ${move}`);
        
        // Check for potential issues
        if (move.includes('bG2')) {
            console.log(`🔍 Move ${moveNum}: ${move} (bG2 activity)`);
        }
        
        // Look for malformed moves
        if (move.includes('\\\\') || move.includes('//')) {
            issues.push(`Move ${moveNum}: Double separators in ${move}`);
        }
        
        // Check for missing reference pieces
        const refMatch = move.match(/[wb][QAGBS]\d*[\\/-][wb][QAGBS]\d*/);
        if (!refMatch && move.includes(' ')) {
            const parts = move.split(' ');
            if (parts.length === 2 && !parts[1].match(/^[\\/-]/)) {
                console.log(`🔍 Move ${moveNum}: Possible reference issue in ${move}`);
            }
        }
    }
});

console.log('\n📊 Piece movement summary:');
Object.keys(pieceMoves).sort().forEach(piece => {
    console.log(`${piece}: ${pieceMoves[piece].length} moves`);
    if (piece === 'bG2') {
        console.log('  🎯 bG2 moves:', pieceMoves[piece]);
    }
});

if (issues.length > 0) {
    console.log('\n❌ Potential issues found:');
    issues.forEach(issue => console.log(`  ${issue}`));
} else {
    console.log('\n✅ No obvious UHP format issues detected');
}

console.log('\n💡 If engine keeps suggesting same move, it might be:');
console.log('  1. Engine internal bug with complex board states');
console.log('  2. Engine confused by piece movements and stacking');
console.log('  3. Engine not properly updating its internal position tracking');
console.log('  4. Engine hitting some edge case in move generation');