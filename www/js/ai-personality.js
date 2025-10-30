// Hive AI Personality Profiles Module
// Adjusts depth, iterations, aggression/defense weights for Sunny, Buzzwell, Beedric
// Reference: Hive Tactics.txt

const personalities = {
    Sunny: { depth: 2, iterations: 100, aggression: 0.3, defense: 0.7 },
    Buzzwell: { depth: 4, iterations: 500, aggression: 0.5, defense: 0.5 },
    Beedric: { depth: 6, iterations: 3000, aggression: 0.7, defense: 0.3 }
};

function getPersonality(name) {
    return personalities[name] || personalities["Buzzwell"];
}

module.exports = {
    getPersonality,
    personalities
};
