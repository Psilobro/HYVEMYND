// UHP Format Research
// Based on terminal logs, I think the issue is:
// We're sending: Base;InProgress;Black[2];wG1;bG1;wG2 (piece list)
// But UHP expects: Base;InProgress;Black[2];wG1;bG1 wG1/;wG2 bG1\ (move list with positions)

// From the engine responses, I see positional notation:
// bG1 wG1/ = place bG1 to the bottom-right of wG1
// bS1 \wG1 = place bS1 to the top-left of wG1

// So the correct format should be:
// Base;InProgress;Black[2];wG1;bG1 wG1/;wG2 bG1\

// Let me implement this conversion...