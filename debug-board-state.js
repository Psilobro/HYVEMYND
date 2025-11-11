// Quick test to verify board state validity
// Run with: node debug-board-state.js

const pieces = [
    { name: 'wG1', q: 0, r: 0 },
    { name: 'bS1', q: 1, r: 0 }, 
    { name: 'wA1', q: 0, r: -1 },
    { name: 'bQ', q: 2, r: 0 },
    { name: 'wS1', q: -1, r: 1 }
];

// Check if all pieces are connected
function getNeighbors(q, r) {
    return [
        [q + 1, r],     // East
        [q + 1, r - 1], // Northeast  
        [q, r - 1],     // Northwest
        [q - 1, r],     // West
        [q - 1, r + 1], // Southwest
        [q, r + 1]      // Southeast
    ];
}

function isConnected(pieces) {
    if (pieces.length <= 1) return true;
    
    const positions = new Set(pieces.map(p => `${p.q},${p.r}`));
    const visited = new Set();
    const queue = [pieces[0]]; // Start from first piece
    visited.add(`${pieces[0].q},${pieces[0].r}`);
    
    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = getNeighbors(current.q, current.r);
        
        for (const [nq, nr] of neighbors) {
            const neighborKey = `${nq},${nr}`;
            if (positions.has(neighborKey) && !visited.has(neighborKey)) {
                visited.add(neighborKey);
                const neighborPiece = pieces.find(p => p.q === nq && p.r === nr);
                queue.push(neighborPiece);
            }
        }
    }
    
    return visited.size === pieces.length;
}

console.log('=== BOARD STATE ANALYSIS ===');
console.log('Pieces:');
pieces.forEach(p => {
    console.log(`  ${p.name} at (${p.q}, ${p.r})`);
});

console.log('\nConnectivity check:');
console.log('Is hive connected?', isConnected(pieces));

console.log('\nAdjacency check:');
pieces.forEach(piece => {
    const neighbors = getNeighbors(piece.q, piece.r);
    const adjacent = neighbors.filter(([nq, nr]) => 
        pieces.some(p => p.q === nq && p.r === nr && p !== piece)
    );
    console.log(`${piece.name} has ${adjacent.length} adjacent pieces:`, 
        adjacent.map(([q,r]) => pieces.find(p => p.q === q && p.r === r)?.name).join(', '));
});

// Check placement order validity
console.log('\n=== UHP SEQUENCE ANALYSIS ===');
console.log('Expected UHP: Base;InProgress;Black[3];wG1;bS1 wG1-;wA1 wG1/;bQ bS1-;wS1 /wG1');

// Check each placement step by step
const placements = [
    { move: 'wG1', desc: 'First piece at origin' },
    { move: 'bS1 wG1-', desc: 'Black spider to right of white grasshopper' },
    { move: 'wA1 wG1/', desc: 'White ant to north of white grasshopper' },
    { move: 'bQ bS1-', desc: 'Black queen to right of black spider' },
    { move: 'wS1 /wG1', desc: 'White spider to bottom-left of white grasshopper' }
];

console.log('Placement sequence:');
placements.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.move} - ${p.desc}`);
});