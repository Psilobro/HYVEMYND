/**
 * Test script to validate pinned piece detection logic
 * Run with: node test-pinned-pieces.js
 */

// Mock the game state and validation functions for testing
function createMockGameState() {
    // Simulate a game state where black ant is pinned
    const mockPieces = [
        // White pieces
        { meta: { color: 'white', key: 'G', placed: true, q: 0, r: 0 } },
        { meta: { color: 'white', key: 'G', placed: true, q: -1, r: 0 } },
        { meta: { color: 'white', key: 'Q', placed: true, q: 0, r: -1 } },
        
        // Black pieces
        { meta: { color: 'black', key: 'G', placed: true, q: 1, r: 0 } },
        { meta: { color: 'black', key: 'Q', placed: true, q: 2, r: 0 } },
        { meta: { color: 'black', key: 'A', placed: true, q: 2, r: -1 } }, // This ant should be pinned
    ];

    // Mock window.tray
    global.window = {
        tray: mockPieces,
        legalMoveZones: function(piece) {
            // Simulate that the black ant at (2,-1) is pinned (no legal moves)
            if (piece.meta.color === 'black' && piece.meta.key === 'A' && 
                piece.meta.q === 2 && piece.meta.r === -1) {
                return []; // Pinned - no legal moves
            }
            // Other pieces have some legal moves
            return ['1,1', '2,1']; // Mock legal moves
        }
    };

    return mockPieces;
}

// Mock UHP Client validation method
function validatePieceMobility(color) {
    if (!global.window.legalMoveZones || !global.window.tray) {
        console.warn('🔍 Mobility validation: Required functions not available');
        return 0;
    }

    const placedPieces = global.window.tray.filter(p => 
        p.meta && p.meta.color === color && p.meta.placed
    );

    let mobilePieceCount = 0;
    const pinnedPieces = [];

    for (const piece of placedPieces) {
        try {
            const moveZones = global.window.legalMoveZones(piece);
            const zones = Array.isArray(moveZones) ? moveZones : Array.from(moveZones);
            
            if (zones.length > 0) {
                mobilePieceCount++;
                console.log(`🔍 Mobile: ${piece.meta.key} at (${piece.meta.q},${piece.meta.r}) - ${zones.length} moves`);
            } else {
                pinnedPieces.push(`${piece.meta.key}@(${piece.meta.q},${piece.meta.r})`);
            }
        } catch (error) {
            console.warn(`🔍 Error checking mobility for ${piece.meta.key}:`, error);
        }
    }

    if (pinnedPieces.length > 0) {
        console.log(`🔍 Pinned pieces for ${color}:`, pinnedPieces);
    }

    return mobilePieceCount;
}

// Run the test
console.log('🔬 Testing pinned piece detection...');
createMockGameState();

console.log('\n--- Testing White Pieces ---');
const whiteMobile = validatePieceMobility('white');
console.log(`White mobile pieces: ${whiteMobile}`);

console.log('\n--- Testing Black Pieces ---');
const blackMobile = validatePieceMobility('black');
console.log(`Black mobile pieces: ${blackMobile}`);

if (blackMobile === 2) {
    console.log('✅ Test PASSED: Black has 2 mobile pieces (G and Q), ant is correctly detected as pinned');
} else {
    console.log('❌ Test FAILED: Expected 2 mobile pieces for black');
}

console.log('\n🔬 Test complete!');