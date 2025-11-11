// Verify board state and legal placements
// Check what the actual board state should be vs UHP conversion

console.log('🔍 Analyzing board state progression:');

// Expected moves from console logs:
const moves = [
    { player: 'white', piece: 'G1', pos: [0, 0], move: 'wG1' },
    { player: 'black', piece: 'G1', pos: [1, 0], move: 'bG1 wG1-' },
    { player: 'white', piece: 'A1', pos: [0, -1], move: 'wA1 wG1/' },
    { player: 'black', piece: 'Q1', pos: [2, 0], move: 'bQ bG1-' },
    { player: 'white', piece: 'S1', pos: [-1, 1], move: 'wS1 /wG1' }
];

console.log('Expected board state after each move:');
moves.forEach((move, i) => {
    console.log(`${i + 1}. ${move.player} ${move.piece} at (${move.pos[0]}, ${move.pos[1]}) → UHP: ${move.move}`);
});

console.log('\n🔍 Adjacency check for move 5 (wS1 at (-1,1)):');
const finalBoard = [
    [0, 0, 'wG1'],
    [1, 0, 'bG1'],
    [0, -1, 'wA1'],
    [2, 0, 'bQ']
];

const spiderPos = [-1, 1];
console.log(`Spider position: (${spiderPos[0]}, ${spiderPos[1]})`);

// Check adjacency using axial coordinates
// Adjacent positions differ by exactly 1 in hex distance
finalBoard.forEach(([q, r, piece]) => {
    const distance = Math.abs(spiderPos[0] - q) + Math.abs(spiderPos[1] - r) - Math.abs((spiderPos[0] - q) - (spiderPos[1] - r)) / 2;
    const isAdjacent = distance === 1;
    console.log(`  Distance to ${piece} at (${q}, ${r}): ${distance.toFixed(1)} ${isAdjacent ? '✓ ADJACENT' : '✗ not adjacent'}`);
});

// The real question: what are the actual legal placement zones for white after move 4?
console.log('\n🎯 Legal placement zones for white after move 4:');
console.log('Existing pieces: wG1(0,0), bG1(1,0), wA1(0,-1), bQ(2,0)');
console.log('White pieces: wG1(0,0), wA1(0,-1)');
console.log('Legal zones must be: adjacent to white pieces, not adjacent to black pieces');

// Calculate expected legal zones
const whitePieces = [[0, 0], [0, -1]];
const blackPieces = [[1, 0], [2, 0]];

// Get all positions adjacent to white pieces
const adjacentToWhite = new Set();
whitePieces.forEach(([q, r]) => {
    // 6 adjacent positions in axial coordinates
    [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]].forEach(([dq, dr]) => {
        adjacentToWhite.add(`${q + dq},${r + dr}`);
    });
});

console.log('Positions adjacent to white pieces:', Array.from(adjacentToWhite));

// Remove positions that are occupied or adjacent to black pieces
const occupiedPositions = new Set(['0,0', '1,0', '0,-1', '2,0']);
const adjacentToBlack = new Set();
blackPieces.forEach(([q, r]) => {
    [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]].forEach(([dq, dr]) => {
        adjacentToBlack.add(`${q + dq},${r + dr}`);
    });
});

const legalZones = Array.from(adjacentToWhite).filter(pos => 
    !occupiedPositions.has(pos) && !adjacentToBlack.has(pos)
);

console.log('Legal placement zones for white:', legalZones);
console.log(`Is (-1,1) legal? ${legalZones.includes('-1,1') ? 'YES' : 'NO'}`);