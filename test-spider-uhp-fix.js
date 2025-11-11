// Test script for UHP spider movement fix
// This tests the specific scenario that was causing the infinite loop

function testSpiderMovementFix() {
    console.log('=== Testing UHP Spider Movement Fix ===');
    
    // Simulate the problematic scenario:
    // Spider at (3,0) moving to (1,-1) 
    // with black ant at (-1,-1) and other pieces around
    
    const playedPieces = [
        {uhpId: 'wG1', q: 0, r: 0},     // white grasshopper
        {uhpId: 'bG1', q: 1, r: 0},    // black grasshopper  
        {uhpId: 'wS1', q: -1, r: 1},   // white spider (original pos)
        {uhpId: 'bQ', q: 2, r: 0},     // black queen
        {uhpId: 'wA1', q: 0, r: -1},   // white ant
        {uhpId: 'bA1', q: -1, r: -1},  // black ant
        {uhpId: 'wQ', q: -2, r: 0},    // white queen
        {uhpId: 'bS1', q: 3, r: 0}     // black spider at (3,0)
    ];
    
    // Test moving black spider from (3,0) to (1,-1)
    const fromPos = {q: 3, r: 0};
    const toPos = {q: 1, r: -1};
    
    console.log(`Testing move: bS1 from (${fromPos.q}, ${fromPos.r}) to (${toPos.q}, ${toPos.r})`);
    
    // Check distances to all pieces
    console.log('Distances from destination (1,-1) to all pieces:');
    playedPieces.forEach(piece => {
        const dq = piece.q - toPos.q;
        const dr = piece.r - toPos.r;
        const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
        console.log(`  ${piece.uhpId} at (${piece.q}, ${piece.r}): distance ${distance} ${distance === 1 ? '✓ ADJACENT' : ''}`);
    });
    
    // Find adjacent pieces (distance 1)
    const adjacentPieces = playedPieces.filter(piece => {
        if (piece.uhpId === 'bS1') return false; // Skip moving piece
        const dq = piece.q - toPos.q;
        const dr = piece.r - toPos.r;  
        const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
        return distance === 1;
    });
    
    console.log(`\nAdjacent pieces to destination (${toPos.q}, ${toPos.r}):`);
    adjacentPieces.forEach(piece => {
        const deltaQ = toPos.q - piece.q;
        const deltaR = toPos.r - piece.r;
        console.log(`  ${piece.uhpId} at (${piece.q}, ${piece.r}) - delta: (${deltaQ}, ${deltaR})`);
    });
    
    // The black ant at (-1,-1) has distance 2, so it should NOT be used as reference
    // We need a piece adjacent to (1,-1)
    
    // Expected: No adjacent pieces = UHP notation impossible for this move!
    if (adjacentPieces.length === 0) {
        console.log('\n❌ PROBLEM: No adjacent pieces to destination. This move cannot be represented in UHP notation!');
        console.log('🔧 SOLUTION: This suggests either:');
        console.log('   1. The spider path is invalid (spider must move exactly 3 spaces)');
        console.log('   2. There are pieces missing from the board state');
        console.log('   3. The destination calculation is wrong');
    } else {
        console.log('\n✓ Adjacent reference pieces found - UHP notation should work');
    }
}

testSpiderMovementFix();