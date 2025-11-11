// Quick test to see if there are any syntax errors or undefined variables
console.log('Testing UHP client for undefined variable errors...');

// Simulate the problematic UHP parsing scenario
const testUHPMove = "bA1 /wA1";
console.log('Testing UHP move:', testUHPMove);

// This should help identify if there are any remaining placedPiece references
console.log('Test complete - check for any ReferenceErrors above');