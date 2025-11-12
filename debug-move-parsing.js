// Debug UHP Move Parsing - Analyze why "bG2 bA2-" is being suggested and rejected

const moveString = "bG2 bA2-";

console.log("🔍 DETAILED ANALYSIS OF UHP MOVE:", moveString);

// Parse the move components  
const parts = moveString.trim().split(' ');
const pieceKey = parts[0]; // "bG2" 
const destinationPart = parts[1]; // "bA2-"

console.log("📝 Move Components:");
console.log("  Moving piece:", pieceKey);
console.log("  Destination:", destinationPart);

// Parse piece identifier
const pieceMatch = pieceKey.match(/^([wb])([QAGBS])(\d*)$/);
if (pieceMatch) {
    const [, colorCode, pieceType, pieceNum] = pieceMatch;
    const color = colorCode === 'w' ? 'white' : 'black';
    const actualPieceNum = pieceNum || (pieceType === 'Q' ? '1' : '');
    
    console.log("🎯 Moving Piece Analysis:");
    console.log("  Color:", color);
    console.log("  Type:", pieceType);
    console.log("  Number:", actualPieceNum);
}

// Parse destination
let refMatch = destinationPart.match(/^([\\\/\-]?)([wb][QAGBS]\d*)([\\\/\-]?)$/);
let beforeSep = '', refPieceKey = '', afterSep = '', separator = '';

if (refMatch) {
    [, beforeSep, refPieceKey, afterSep] = refMatch;
    separator = beforeSep || afterSep;
    
    console.log("🎯 Destination Analysis:");
    console.log("  Before separator:", beforeSep || 'none');
    console.log("  Reference piece:", refPieceKey);
    console.log("  After separator:", afterSep || 'none');
    console.log("  Active separator:", separator);
    console.log("  Side of separator:", beforeSep ? 'left' : 'right');
} else {
    // Check for direct piece reference (beetle climbing)
    const directMatch = destinationPart.match(/^([wb][QAGBS]\d*)$/);
    if (directMatch) {
        refPieceKey = directMatch[1];
        separator = '';
        console.log("🎯 Beetle climbing notation detected:", refPieceKey);
    } else {
        console.log("❌ Could not parse destination format:", destinationPart);
    }
}

// Analyze what this move means in UHP
console.log("\n🧭 UHP MOVE INTERPRETATION:");
console.log(`Move "${moveString}" means:`);
console.log(`- Move piece bG2 (black grasshopper #2)`);
console.log(`- To a position relative to bA2 (black ant #2)`);
console.log(`- Using separator "${separator}" on the ${beforeSep ? 'left' : 'right'} side`);

// Direction mapping explanation
if (separator === '-' && !beforeSep) {
    console.log("📍 UHP Direction: piece- means 'piece goes NorthEast of reference'");
    console.log("   In hex coordinates: reference + (1, -1)");
} else if (separator === '-' && beforeSep) {
    console.log("📍 UHP Direction: -piece means 'piece goes SouthWest of reference'");
    console.log("   In hex coordinates: reference + (-1, 1)");
}

console.log("\n🤔 POTENTIAL ISSUES:");
console.log("1. Does bG2 (black grasshopper #2) exist on the board?");
console.log("2. Does bA2 (black ant #2) exist on the board as reference?");
console.log("3. Is the calculated destination position valid?");
console.log("4. Is grasshopper movement to that position legal according to game rules?");

console.log("\n🔧 DEBUGGING STEPS:");
console.log("1. Check if both pieces exist in current game state");
console.log("2. Verify UHP piece numbering matches actual piece placement order");
console.log("3. Calculate destination coordinates and check if position is legal");
console.log("4. Verify grasshopper movement rules allow this specific path");

console.log("\n💡 HYPOTHESIS:");
console.log("The engine is likely correct about the move notation.");
console.log("Our parsing or piece identification may be the issue.");
console.log("We should verify:");
console.log("- UHP piece numbering system (placement order vs internal numbering)");
console.log("- Coordinate system matching between UHP and HYVEMYND");
console.log("- Reference piece position lookup accuracy");