// Debug script to test the current UHP spider movement issue
// Run this in browser console when the bug occurs

function debugCurrentUHPState() {
    console.log('=== UHP DEBUG STATE ===');
    
    // Check current board state
    console.log('Current board pieces:');
    window.cells.forEach((cell, key) => {
        if (cell.stack && cell.stack.length > 0) {
            cell.stack.forEach((piece, i) => {
                const color = piece.color || piece.meta?.color;
                const key_type = piece.key || piece.meta?.key;
                console.log(`  ${key}: ${color} ${key_type} (stack pos ${i})`);
            });
        }
    });
    
    // Check tray state
    console.log('\nTray pieces:');
    window.tray.forEach(piece => {
        const color = piece.color || piece.meta?.color;
        const key_type = piece.key || piece.meta?.key;
        const placed = piece.placed || piece.meta?.placed;
        const pos = placed ? `(${piece.q || piece.meta?.q}, ${piece.r || piece.meta?.r})` : 'unplaced';
        console.log(`  ${color} ${key_type}: placed=${placed} at ${pos}`);
    });
    
    // Get UHP client and generate string
    const uhpClient = window.uhpClient;
    if (uhpClient) {
        try {
            const gameString = uhpClient.exportGameString();
            console.log('\nGenerated UHP string:');
            console.log(gameString);
            
            // Parse the moves
            const moves = gameString.split(';').slice(3); // Skip Base;InProgress;Turn
            console.log('\nParsed moves:');
            moves.forEach((move, i) => {
                console.log(`  ${i + 1}: ${move}`);
            });
        } catch (error) {
            console.error('Error generating UHP string:', error);
        }
    }
    
    // Check move history
    console.log('\nUI Move History:');
    if (window.moveHistory) {
        window.moveHistory.forEach((move, i) => {
            console.log(`  ${i + 1}: ${move}`);
        });
    }
}

// Run the debug
debugCurrentUHPState();