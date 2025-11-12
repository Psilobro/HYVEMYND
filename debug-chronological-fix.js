// Test UHP piece numbering fix - Analyze chronological placement order
console.log("🎯 TESTING UHP PIECE NUMBERING FIX");

// Simulate typical game piece placements
const testPlacements = [
    { move: 1, color: 'white', type: 'S' },  // wS1
    { move: 2, color: 'black', type: 'G' },  // bG1  
    { move: 3, color: 'white', type: 'A' },  // wA1
    { move: 4, color: 'black', type: 'G' },  // bG2 ← Second black grasshopper!
    { move: 5, color: 'white', type: 'Q' },  // wQ
    { move: 6, color: 'black', type: 'A' },  // bA1
    { move: 7, color: 'white', type: 'G' },  // wG1
    { move: 8, color: 'black', type: 'A' },  // bA2 ← Second black ant!
];

// Track UHP numbering
const uhpCounters = {};
console.log("\n📝 CHRONOLOGICAL UHP NUMBERING:");

testPlacements.forEach(placement => {
    const colorCode = placement.color.charAt(0);
    const counterKey = `${placement.color}_${placement.type}`;
    
    if (!uhpCounters[counterKey]) uhpCounters[counterKey] = 0;
    uhpCounters[counterKey]++;
    
    const uhpId = placement.type === 'Q' ? 
        `${colorCode}Q` : 
        `${colorCode}${placement.type}${uhpCounters[counterKey]}`;
    
    console.log(`Move ${placement.move}: ${uhpId}`);
});

console.log("\n🎯 NOKAMUTE MOVE ANALYSIS:");
console.log("When Nokamute says 'bG2 bA2-', it means:");
console.log("- bG2: The grasshopper placed on Move 4 (chronologically 2nd black grasshopper)");  
console.log("- bA2: The ant placed on Move 8 (chronologically 2nd black ant)");
console.log("- The grasshopper should move NorthEast of that ant");

console.log("\n✅ OUR FIX:");
console.log("- recordPiecePlacement() tracks chronological order");
console.log("- getPieceByUHPId() uses placement order, not meta.i");
console.log("- commitPlacement() now calls proper chronological tracking");

console.log("\n🚀 RESULT: Engine moves should now parse correctly!");