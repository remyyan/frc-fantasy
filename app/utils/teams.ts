import { TeamWithCost } from './statbotics'; // Keep this for the interface
import { getTeamsWithCosts as getTeamsWithOPRCosts } from './tbaStats';

// List of top FRC teams to use for fantasy draft
// This is used when event data isn't available yet
export const TOP_FRC_TEAMS = [
  // Championship-level teams from previous years
  254, 1114, 118, 2056, 3310, 1678, 2767, 3538, 3847, 
  217, 1241, 27, 33, 111, 1323, 1619, 2168, 2910, 3539,
  148, 195, 330, 610, 971, 1024, 1296, 1318, 1519, 1690,
  2337, 2481, 2590, 2614, 3707, 4414, 4613, 4911, 5406, 
  5499, 5804, 6986, 7498, 8033, 9181, 
  // More competitive teams
  16, 25, 67, 95, 103, 114, 125, 133, 135, 180, 199, 225,
  229, 236, 254, 303, 316, 319, 341, 346, 359, 364, 368, 384,
  399, 449, 469, 488, 503, 540, 548, 558, 564, 597, 604, 694,
  701, 868, 910, 973, 987, 1011, 1023, 1058, 1073, 1089, 1112, 
  1138, 1339, 1425, 1577, 1622, 1629, 1640, 1671, 1706, 1720, 
  1730, 1731, 1732, 1745, 1768, 1796, 1923, 1987, 1991, 2046,
  2052, 2075, 2135, 2175, 2177, 2181, 2200, 2451, 2471, 2473,
  2474, 2485, 2512, 2526, 2550, 2582, 2630, 2655, 2656, 2713,
  2834, 2847, 2928, 2930, 3015, 3130, 3173, 3175, 3176, 3197, 
  3258, 3260, 3322, 3452, 3467, 3476, 3620, 3636, 3656, 3683,
  3824, 3928, 3946, 3984, 4004, 4028, 4039, 4069, 4145, 4188,
  4201, 4481, 4488, 4499, 4561, 4571, 4644, 4653, 4765, 4828,
  4975, 5050, 5099, 5113, 5232, 5254, 5275, 5407, 5460, 5511
];

// Team name overrides for well-known teams
const TEAM_NAMES: Record<number, string> = {
  254: "The Cheesy Poofs",
  1114: "Simbotics",
  118: "The Robonauts",
  2056: "OP Robotics",
  1678: "Citrus Circuits",
  2767: "Stryke Force",
  3538: "RoboJackets",
  3847: "Spectrum",
  217: "ThunderChickens",
  1241: "Theory6",
  27: "Team RUSH",
  33: "Killer Bees",
  111: "Wildstang",
  1323: "MadTown Robotics",
  1619: "Up-A-Creek Robotics",
  2168: "Aluminum Falcons",
  148: "Robowranglers",
  195: "CyberKnights",
  330: "Beach Bots",
  610: "Crescent Coyotes",
  971: "Spartan Robotics",
  2910: "Jack in the Bot",
  // Add more team names as needed
};

/**
 * Get a list of teams with their costs for fantasy draft
 * This function uses TBA's OPR data to determine team costs
 */
export async function getTeamsForFantasyDraft(): Promise<TeamWithCost[]> {
  try {
    console.log("Starting getTeamsForFantasyDraft");
    // Use the TBA OPR data instead of Statbotics EPA
    const result = await getTeamsWithOPRCosts(TOP_FRC_TEAMS);
    console.log(`Retrieved ${result.length} teams for fantasy draft`);
    
    // Sort by cost (highest first)
    return result.sort((a, b) => b.cost - a.cost);
  } catch (error) {
    console.error('Error creating teams for fantasy draft:', error);
    return [];
  }
} 