/**
 * Real FIFA World Cup 2026 schedule (11 Jun – 19 Jul 2026).
 * Source: Sky Sports day-by-day UK kick-off breakdown, cross-checked vs Yahoo (ET).
 *
 * Times below are UK wall-clock (BST = UTC+1 in Jun/Jul); kickoffUtc() converts to the
 * UTC instant by subtracting 1h, so the board (Europe/London) shows the real UK time.
 */

/** UK wall-clock (BST) → UTC Date. Date.UTC normalises the -1h across midnight. */
export function kickoffUtc(date: string, uk: string): Date {
  const [mm, dd] = date.split("-").map(Number);
  const [hh, mi] = uk.split(":").map(Number);
  return new Date(Date.UTC(2026, mm! - 1, dd!, hh! - 1, mi!));
}

/** [group, homeCode, awayCode, "MM-DD", "HH:MM" (UK), city] — chronological, 72 matches. */
export const GROUP_SCHEDULE: [string, string, string, string, string, string][] = [
  // Matchday 1
  ["A", "MEX", "RSA", "06-11", "20:00", "Mexico City"],
  ["A", "KOR", "CZE", "06-12", "03:00", "Zapopan"],
  ["B", "CAN", "BIH", "06-12", "20:00", "Toronto"],
  ["D", "USA", "PAR", "06-13", "02:00", "Los Angeles"],
  ["B", "QAT", "SUI", "06-13", "20:00", "Santa Clara"],
  ["C", "BRA", "MAR", "06-13", "23:00", "New Jersey"],
  ["C", "HAI", "SCO", "06-14", "02:00", "Foxborough"],
  ["D", "AUS", "TUR", "06-14", "05:00", "Vancouver"],
  ["E", "GER", "CUW", "06-14", "18:00", "Houston"],
  ["F", "NED", "JPN", "06-14", "21:00", "Arlington"],
  ["E", "CIV", "ECU", "06-15", "00:00", "Philadelphia"],
  ["F", "SWE", "TUN", "06-15", "03:00", "Guadalupe"],
  ["H", "ESP", "CPV", "06-15", "17:00", "Atlanta"],
  ["G", "BEL", "EGY", "06-15", "20:00", "Seattle"],
  ["H", "KSA", "URU", "06-15", "23:00", "Miami"],
  ["G", "IRN", "NZL", "06-16", "02:00", "Los Angeles"],
  ["I", "FRA", "SEN", "06-16", "20:00", "New Jersey"],
  ["I", "IRQ", "NOR", "06-16", "23:00", "Foxborough"],
  ["J", "ARG", "ALG", "06-17", "02:00", "Kansas City"],
  ["J", "AUT", "JOR", "06-17", "05:00", "Santa Clara"],
  ["K", "POR", "COD", "06-17", "18:00", "Houston"],
  ["L", "ENG", "CRO", "06-17", "21:00", "Arlington"],
  ["L", "GHA", "PAN", "06-18", "00:00", "Toronto"],
  ["K", "UZB", "COL", "06-18", "03:00", "Mexico City"],
  // Matchday 2
  ["A", "CZE", "RSA", "06-18", "17:00", "Atlanta"],
  ["B", "SUI", "BIH", "06-18", "20:00", "Los Angeles"],
  ["B", "CAN", "QAT", "06-18", "23:00", "Vancouver"],
  ["A", "MEX", "KOR", "06-19", "02:00", "Zapopan"],
  ["D", "USA", "AUS", "06-19", "20:00", "Seattle"],
  ["C", "SCO", "MAR", "06-19", "23:00", "Foxborough"],
  ["C", "BRA", "HAI", "06-20", "01:30", "Philadelphia"],
  ["D", "TUR", "PAR", "06-20", "04:00", "Santa Clara"],
  ["F", "NED", "SWE", "06-20", "18:00", "Houston"],
  ["E", "GER", "CIV", "06-20", "21:00", "Toronto"],
  ["E", "ECU", "CUW", "06-21", "01:00", "Kansas City"],
  ["F", "TUN", "JPN", "06-21", "05:00", "Guadalupe"],
  ["H", "ESP", "KSA", "06-21", "17:00", "Atlanta"],
  ["G", "BEL", "IRN", "06-21", "20:00", "Los Angeles"],
  ["H", "URU", "CPV", "06-21", "23:00", "Miami"],
  ["G", "NZL", "EGY", "06-22", "02:00", "Vancouver"],
  ["J", "ARG", "AUT", "06-22", "18:00", "Arlington"],
  ["I", "FRA", "IRQ", "06-22", "22:00", "Philadelphia"],
  ["I", "NOR", "SEN", "06-23", "01:00", "Toronto"],
  ["J", "JOR", "ALG", "06-23", "04:00", "Santa Clara"],
  ["K", "POR", "UZB", "06-23", "18:00", "Houston"],
  ["L", "ENG", "GHA", "06-23", "21:00", "Foxborough"],
  ["L", "PAN", "CRO", "06-24", "00:00", "Foxborough"],
  ["K", "COL", "COD", "06-24", "03:00", "Zapopan"],
  // Matchday 3 (final group games kick off in pairs)
  ["B", "SUI", "CAN", "06-24", "20:00", "Vancouver"],
  ["B", "BIH", "QAT", "06-24", "20:00", "Seattle"],
  ["C", "MAR", "HAI", "06-24", "23:00", "Atlanta"],
  ["C", "SCO", "BRA", "06-24", "23:00", "Miami"],
  ["A", "RSA", "KOR", "06-25", "02:00", "Guadalupe"],
  ["A", "CZE", "MEX", "06-25", "02:00", "Mexico City"],
  ["E", "CUW", "CIV", "06-25", "21:00", "Philadelphia"],
  ["E", "ECU", "GER", "06-25", "21:00", "New Jersey"],
  ["F", "TUN", "NED", "06-26", "00:00", "Kansas City"],
  ["F", "JPN", "SWE", "06-26", "00:00", "Arlington"],
  ["D", "TUR", "USA", "06-26", "03:00", "Los Angeles"],
  ["D", "PAR", "AUS", "06-26", "03:00", "Santa Clara"],
  ["I", "NOR", "FRA", "06-26", "20:00", "Foxborough"],
  ["I", "SEN", "IRQ", "06-26", "20:00", "Toronto"],
  ["H", "CPV", "KSA", "06-27", "01:00", "Houston"],
  ["H", "URU", "ESP", "06-27", "01:00", "Zapopan"],
  ["G", "NZL", "BEL", "06-27", "04:00", "Vancouver"],
  ["G", "EGY", "IRN", "06-27", "04:00", "Seattle"],
  ["L", "PAN", "ENG", "06-27", "22:00", "New Jersey"],
  ["L", "CRO", "GHA", "06-27", "22:00", "Philadelphia"],
  ["K", "COL", "POR", "06-28", "00:30", "Miami"],
  ["K", "COD", "UZB", "06-28", "00:30", "Atlanta"],
  ["J", "ALG", "AUT", "06-28", "03:00", "Kansas City"],
  ["J", "JOR", "ARG", "06-28", "03:00", "Arlington"],
];

/** [stage, bracketIndex, "MM-DD", "HH:MM" (UK), city] — 32 matches, R32 → Final. */
export const KNOCKOUT_SCHEDULE: [string, number, string, string, string][] = [
  // Round of 32 (match 73–88)
  ["R32", 1, "06-28", "20:00", "Los Angeles"],
  ["R32", 2, "06-29", "18:00", "Houston"],
  ["R32", 3, "06-29", "21:30", "Foxborough"],
  ["R32", 4, "06-30", "02:00", "Guadalupe"],
  ["R32", 5, "06-30", "18:00", "Arlington"],
  ["R32", 6, "06-30", "22:00", "New Jersey"],
  ["R32", 7, "07-01", "02:00", "Mexico City"],
  ["R32", 8, "07-01", "17:00", "Atlanta"],
  ["R32", 9, "07-01", "21:00", "Seattle"],
  ["R32", 10, "07-02", "01:00", "Santa Clara"],
  ["R32", 11, "07-02", "20:00", "Los Angeles"],
  ["R32", 12, "07-03", "00:00", "Toronto"],
  ["R32", 13, "07-03", "04:00", "Vancouver"],
  ["R32", 14, "07-03", "19:00", "Arlington"],
  ["R32", 15, "07-03", "23:00", "Miami"],
  ["R32", 16, "07-04", "02:30", "Kansas City"],
  // Round of 16 (match 89–96)
  ["R16", 1, "07-04", "18:00", "Houston"],
  ["R16", 2, "07-04", "22:00", "Philadelphia"],
  ["R16", 3, "07-05", "21:00", "New Jersey"],
  ["R16", 4, "07-06", "01:00", "Mexico City"],
  ["R16", 5, "07-06", "20:00", "Arlington"],
  ["R16", 6, "07-07", "01:00", "Seattle"],
  ["R16", 7, "07-07", "17:00", "Atlanta"],
  ["R16", 8, "07-07", "21:00", "Vancouver"],
  // Quarter-finals (match 97–100)
  ["QF", 1, "07-09", "21:00", "Foxborough"],
  ["QF", 2, "07-10", "20:00", "Los Angeles"],
  ["QF", 3, "07-11", "22:00", "Miami"],
  ["QF", 4, "07-12", "02:00", "Kansas City"],
  // Semi-finals (match 101–102)
  ["SF", 1, "07-14", "20:00", "Arlington"],
  ["SF", 2, "07-15", "20:00", "Atlanta"],
  // Third place (103) + Final (104)
  ["THIRD", 1, "07-18", "22:00", "Miami"],
  ["FINAL", 1, "07-19", "20:00", "New Jersey"],
];
