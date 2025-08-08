import { DateTime, Duration } from "luxon";

export const SHIFT_DEFS = [
  { name: "1st", start: "06:00", end: "16:00" },
  { name: "2nd", start: "16:00", end: "02:00+1" } // +1 = next day
];

const tz = "America/Chicago";

export function roundToShiftStart(dt: DateTime): DateTime {
  for (const s of SHIFT_DEFS) {
    const start = DateTime.fromISO(`${dt.toISODate()}T${s.start}`, { zone: tz });
    const end = s.end.includes('+1') 
      ? DateTime.fromISO(`${dt.plus({ days: 1 }).toISODate()}T${s.end.replace('+1', '')}`, { zone: tz })
      : DateTime.fromISO(`${dt.toISODate()}T${s.end}`, { zone: tz });
    
    if (dt < start) return start;
    if (dt >= start && dt < end) return dt; // already inside shift
  }
  // after 2nd shift → jump to next day's 1st shift
  return DateTime.fromISO(`${dt.plus({ days: 1 }).toISODate()}T${SHIFT_DEFS[0].start}`, { zone: tz });
}

export function advancePastShiftEnd(dt: DateTime): DateTime {
  for (const s of SHIFT_DEFS) {
    const end = s.end.includes('+1')
      ? DateTime.fromISO(`${dt.plus({ days: 1 }).toISODate()}T${s.end.replace('+1', '')}`, { zone: tz })
      : DateTime.fromISO(`${dt.toISODate()}T${s.end}`, { zone: tz });
    
    if (dt < end) return end;
  }
  return roundToShiftStart(dt.plus({ days: 1 }));
}

export function getShiftNumber(dt: DateTime): number {
  for (let i = 0; i < SHIFT_DEFS.length; i++) {
    const s = SHIFT_DEFS[i];
    const start = DateTime.fromISO(`${dt.toISODate()}T${s.start}`, { zone: tz });
    const end = s.end.includes('+1')
      ? DateTime.fromISO(`${dt.plus({ days: 1 }).toISODate()}T${s.end.replace('+1', '')}`, { zone: tz })
      : DateTime.fromISO(`${dt.toISODate()}T${s.end}`, { zone: tz });
    
    if (dt >= start && dt < end) return i + 1;
  }
  return 1; // default to 1st shift
}