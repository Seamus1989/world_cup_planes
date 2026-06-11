export type SeedTeam = {
  name: string;
  code: string;
  flagEmoji: string;
  groupLetter: string;
  confederation: string;
  seedPot: number;
};

/**
 * 2026 FIFA World Cup — final draw (held 5 Dec 2025, Washington D.C.).
 * 48 teams, 12 groups (A–L). Playoff winners shown with their actual qualified names.
 * Sources: en.wikipedia.org/wiki/2026_FIFA_World_Cup_draw + fifa.com.
 */
export const SEED_TEAMS: SeedTeam[] = [
  // Group A
  { name: "Mexico", code: "MEX", flagEmoji: "🇲🇽", groupLetter: "A", confederation: "CONCACAF", seedPot: 1 },
  { name: "South Africa", code: "RSA", flagEmoji: "🇿🇦", groupLetter: "A", confederation: "CAF", seedPot: 3 },
  { name: "South Korea", code: "KOR", flagEmoji: "🇰🇷", groupLetter: "A", confederation: "AFC", seedPot: 2 },
  { name: "Czechia", code: "CZE", flagEmoji: "🇨🇿", groupLetter: "A", confederation: "UEFA", seedPot: 4 },
  // Group B
  { name: "Canada", code: "CAN", flagEmoji: "🇨🇦", groupLetter: "B", confederation: "CONCACAF", seedPot: 1 },
  { name: "Switzerland", code: "SUI", flagEmoji: "🇨🇭", groupLetter: "B", confederation: "UEFA", seedPot: 2 },
  { name: "Qatar", code: "QAT", flagEmoji: "🇶🇦", groupLetter: "B", confederation: "AFC", seedPot: 3 },
  { name: "Bosnia and Herzegovina", code: "BIH", flagEmoji: "🇧🇦", groupLetter: "B", confederation: "UEFA", seedPot: 4 },
  // Group C
  { name: "Brazil", code: "BRA", flagEmoji: "🇧🇷", groupLetter: "C", confederation: "CONMEBOL", seedPot: 1 },
  { name: "Morocco", code: "MAR", flagEmoji: "🇲🇦", groupLetter: "C", confederation: "CAF", seedPot: 2 },
  { name: "Scotland", code: "SCO", flagEmoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", groupLetter: "C", confederation: "UEFA", seedPot: 3 },
  { name: "Haiti", code: "HAI", flagEmoji: "🇭🇹", groupLetter: "C", confederation: "CONCACAF", seedPot: 4 },
  // Group D
  { name: "United States", code: "USA", flagEmoji: "🇺🇸", groupLetter: "D", confederation: "CONCACAF", seedPot: 1 },
  { name: "Australia", code: "AUS", flagEmoji: "🇦🇺", groupLetter: "D", confederation: "AFC", seedPot: 2 },
  { name: "Paraguay", code: "PAR", flagEmoji: "🇵🇾", groupLetter: "D", confederation: "CONMEBOL", seedPot: 3 },
  { name: "Turkey", code: "TUR", flagEmoji: "🇹🇷", groupLetter: "D", confederation: "UEFA", seedPot: 4 },
  // Group E
  { name: "Germany", code: "GER", flagEmoji: "🇩🇪", groupLetter: "E", confederation: "UEFA", seedPot: 1 },
  { name: "Ecuador", code: "ECU", flagEmoji: "🇪🇨", groupLetter: "E", confederation: "CONMEBOL", seedPot: 2 },
  { name: "Ivory Coast", code: "CIV", flagEmoji: "🇨🇮", groupLetter: "E", confederation: "CAF", seedPot: 3 },
  { name: "Curaçao", code: "CUW", flagEmoji: "🇨🇼", groupLetter: "E", confederation: "CONCACAF", seedPot: 4 },
  // Group F
  { name: "Netherlands", code: "NED", flagEmoji: "🇳🇱", groupLetter: "F", confederation: "UEFA", seedPot: 1 },
  { name: "Japan", code: "JPN", flagEmoji: "🇯🇵", groupLetter: "F", confederation: "AFC", seedPot: 2 },
  { name: "Tunisia", code: "TUN", flagEmoji: "🇹🇳", groupLetter: "F", confederation: "CAF", seedPot: 3 },
  { name: "Sweden", code: "SWE", flagEmoji: "🇸🇪", groupLetter: "F", confederation: "UEFA", seedPot: 4 },
  // Group G
  { name: "Belgium", code: "BEL", flagEmoji: "🇧🇪", groupLetter: "G", confederation: "UEFA", seedPot: 1 },
  { name: "Iran", code: "IRN", flagEmoji: "🇮🇷", groupLetter: "G", confederation: "AFC", seedPot: 2 },
  { name: "Egypt", code: "EGY", flagEmoji: "🇪🇬", groupLetter: "G", confederation: "CAF", seedPot: 3 },
  { name: "New Zealand", code: "NZL", flagEmoji: "🇳🇿", groupLetter: "G", confederation: "OFC", seedPot: 4 },
  // Group H
  { name: "Spain", code: "ESP", flagEmoji: "🇪🇸", groupLetter: "H", confederation: "UEFA", seedPot: 1 },
  { name: "Uruguay", code: "URU", flagEmoji: "🇺🇾", groupLetter: "H", confederation: "CONMEBOL", seedPot: 2 },
  { name: "Saudi Arabia", code: "KSA", flagEmoji: "🇸🇦", groupLetter: "H", confederation: "AFC", seedPot: 3 },
  { name: "Cape Verde", code: "CPV", flagEmoji: "🇨🇻", groupLetter: "H", confederation: "CAF", seedPot: 4 },
  // Group I
  { name: "France", code: "FRA", flagEmoji: "🇫🇷", groupLetter: "I", confederation: "UEFA", seedPot: 1 },
  { name: "Senegal", code: "SEN", flagEmoji: "🇸🇳", groupLetter: "I", confederation: "CAF", seedPot: 2 },
  { name: "Norway", code: "NOR", flagEmoji: "🇳🇴", groupLetter: "I", confederation: "UEFA", seedPot: 3 },
  { name: "Iraq", code: "IRQ", flagEmoji: "🇮🇶", groupLetter: "I", confederation: "AFC", seedPot: 4 },
  // Group J
  { name: "Argentina", code: "ARG", flagEmoji: "🇦🇷", groupLetter: "J", confederation: "CONMEBOL", seedPot: 1 },
  { name: "Austria", code: "AUT", flagEmoji: "🇦🇹", groupLetter: "J", confederation: "UEFA", seedPot: 2 },
  { name: "Algeria", code: "ALG", flagEmoji: "🇩🇿", groupLetter: "J", confederation: "CAF", seedPot: 3 },
  { name: "Jordan", code: "JOR", flagEmoji: "🇯🇴", groupLetter: "J", confederation: "AFC", seedPot: 4 },
  // Group K
  { name: "Portugal", code: "POR", flagEmoji: "🇵🇹", groupLetter: "K", confederation: "UEFA", seedPot: 1 },
  { name: "Colombia", code: "COL", flagEmoji: "🇨🇴", groupLetter: "K", confederation: "CONMEBOL", seedPot: 2 },
  { name: "Uzbekistan", code: "UZB", flagEmoji: "🇺🇿", groupLetter: "K", confederation: "AFC", seedPot: 3 },
  { name: "DR Congo", code: "COD", flagEmoji: "🇨🇩", groupLetter: "K", confederation: "CAF", seedPot: 4 },
  // Group L
  { name: "England", code: "ENG", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", groupLetter: "L", confederation: "UEFA", seedPot: 1 },
  { name: "Croatia", code: "CRO", flagEmoji: "🇭🇷", groupLetter: "L", confederation: "UEFA", seedPot: 2 },
  { name: "Panama", code: "PAN", flagEmoji: "🇵🇦", groupLetter: "L", confederation: "CONCACAF", seedPot: 3 },
  { name: "Ghana", code: "GHA", flagEmoji: "🇬🇭", groupLetter: "L", confederation: "CAF", seedPot: 4 },
];
