// Debug script to recreate the board state at move 28
// and analyze the grasshopper move from (-2,-1) to (-4,1)

console.log("🔍 Recreating board state at move 28");

// Board state after move 27 (before the problematic grasshopper move):
const boardState = {
  "(0,0)": ["white_spider", "black_beetle"],  // Move 1, 9
  "(1,0)": ["black_spider", "black_beetle"],  // Move 2, 11 
  "(-1,1)": [],  // Move 3 (spider moved away in move 23)
  "(2,0)": ["black_queen", "black_beetle"],   // Move 4, 13
  "(0,-1)": ["white_beetle", "white_ant"],    // Move 5, 15
  "(3,0)": ["white_ant", "white_ant"],        // Move 6, 8, 10, 25
  "(-1,0)": ["black_grasshopper"],            // Move 7, 21
  "(-2,2)": ["black_grasshopper"],            // Move 8, 24
  "(3,-1)": ["white_ant"],                    // Move 12, 16, 27
  "(-3,2)": ["white_ant"],                    // Move 14
  "(1,-2)": ["white_spider"],                 // Move 16
  "(-2,1)": ["black_queen"],                  // Move 17
  "(-2,0)": ["white_ant"],                    // Move 18
  "(-1,2)": [],                               // Move 19 (grasshopper moved away in move 21)
  "(-2,-1)": ["black_grasshopper"],           // Move 20, 26 - This is the piece that moved illegally
  "(-3,1)": ["white_ant"],                    // Move 22
  "(2,1)": ["black_spider"],                  // Move 23
  "(-5,1)": ["white_ant"]                     // Move 29 (came from move 27)
};

console.log("Board state before move 28:", boardState);

// The grasshopper at (-2,-1) tried to move to (-4,1)
// Let's check what pieces it should have jumped over

const grasshopperPos = [-2, -1];
const targetPos = [-4, 1];

console.log(`🦗 Grasshopper attempting to move from (${grasshopperPos}) to (${targetPos})`);

// Calculate direction vector
const dq = targetPos[0] - grasshopperPos[0]; // -4 - (-2) = -2
const dr = targetPos[1] - grasshopperPos[1]; // 1 - (-1) = 2

console.log(`Direction vector: (${dq}, ${dr})`);

// Normalize to unit direction (this should be one of the 6 hex directions)
const gcd = Math.abs(dq) > Math.abs(dr) ? Math.abs(dq) : Math.abs(dr);
const unitDq = dq / gcd;
const unitDr = dr / gcd;

console.log(`Unit direction: (${unitDq}, ${unitDr}), GCD: ${gcd}`);

// Valid hex directions are: (1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)
const validDirections = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
];

const isValidDirection = validDirections.some(dir => dir[0] === unitDq && dir[1] === unitDr);
console.log(`Is valid hex direction: ${isValidDirection}`);

if (!isValidDirection) {
  console.log("❌ PROBLEM: This is not a valid hexagonal direction!");
  console.log("This means the grasshopper is trying to move diagonally, which is impossible in hex coordinates");
}

// Let's trace the path step by step
console.log("\n🔍 Tracing path step by step:");
let currentQ = grasshopperPos[0];
let currentR = grasshopperPos[1];
let step = 0;

while (step < 10) { // Safety limit
  currentQ += unitDq;
  currentR += unitDr;
  step++;
  
  const posKey = `(${currentQ},${currentR})`;
  const hasOccupant = boardState[posKey] && boardState[posKey].length > 0;
  
  console.log(`Step ${step}: (${currentQ},${currentR}) - ${hasOccupant ? 'OCCUPIED' : 'EMPTY'}`);
  
  if (currentQ === targetPos[0] && currentR === targetPos[1]) {
    console.log(`Reached target in ${step} steps`);
    break;
  }
  
  if (!hasOccupant && step > 1) {
    console.log(`First empty cell found at step ${step}`);
    break;
  }
}