import type { CustomSelectOption } from '../components/shared/CustomSelect';

const LEGACY_TIMEZONE_MAP: Record<string, string> = {
  'America/New_York (EST/EDT)': 'America/New_York',
  'America/Chicago (CST/CDT)': 'America/Chicago',
  'America/Denver (MST/MDT)': 'America/Denver',
  'America/Los_Angeles (PST/PDT)': 'America/Los_Angeles',
};

const FALLBACK_IANA_TIMEZONES: readonly string[] = [
  'UTC',
  // North & Central America
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Tijuana',
  'America/Phoenix',
  'America/Denver',
  'America/Edmonton',
  'America/Chicago',
  'America/Winnipeg',
  'America/Mexico_City',
  'America/Monterrey',
  'America/Guatemala',
  'America/Costa_Rica',
  'America/New_York',
  'America/Toronto',
  'America/Detroit',
  'America/Indiana/Indianapolis',
  'America/Bogota',
  'America/Lima',
  'America/Panama',
  'America/Havana',
  'America/Jamaica',
  'America/Halifax',
  'America/Puerto_Rico',
  'America/Caracas',
  'America/Santiago',
  'America/St_Johns',
  // South America
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Montevideo',
  'America/Asuncion',
  'America/La_Paz',
  // Europe & Atlantic
  'Atlantic/Reykjavik',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Budapest',
  'Europe/Athens',
  'Europe/Bucharest',
  'Europe/Helsinki',
  'Europe/Sofia',
  'Europe/Kyiv',
  'Europe/Istanbul',
  'Europe/Moscow',
  // Africa
  'Africa/Casablanca',
  'Africa/Lagos',
  'Africa/Algiers',
  'Africa/Tunis',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Nairobi',
  'Africa/Addis_Ababa',
  // Middle East
  'Asia/Jerusalem',
  'Asia/Amman',
  'Asia/Beirut',
  'Asia/Riyadh',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Asia/Dubai',
  'Asia/Muscat',
  'Asia/Tehran',
  // South & Central Asia
  'Asia/Karachi',
  'Asia/Tashkent',
  'Asia/Kolkata',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Almaty',
  // East & Southeast Asia
  'Asia/Yangon',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Jakarta',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Seoul',
  'Asia/Tokyo',
  // Australia & Pacific
  'Australia/Perth',
  'Australia/Darwin',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Hobart',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Guam',
];

const TIMEZONE_ALIAS_KEYWORDS: Record<string, string> = {
  UTC: 'coordinated universal time gmt zulu +00:00',
  'America/New_York': 'est edt eastern time usa us nyc boston miami atlanta philadelphia',
  'America/Chicago': 'cst cdt central time usa us dallas houston austin minneapolis',
  'America/Denver': 'mst mdt mountain time usa us colorado salt lake',
  'America/Phoenix': 'mst arizona no dst usa us',
  'America/Los_Angeles': 'pst pdt pacific time usa us california san francisco seattle silicon valley',
  'America/Anchorage': 'akst akdt alaska usa us',
  'Pacific/Honolulu': 'hst hawaii usa us',
  'America/Toronto': 'est edt canada ontario ottawa montreal',
  'America/Vancouver': 'pst pdt canada british columbia',
  'America/Mexico_City': 'cst mexico latam',
  'America/Sao_Paulo': 'brt brazil rio',
  'Europe/London': 'gmt bst uk united kingdom britain england',
  'Europe/Dublin': 'gmt ist ireland',
  'Europe/Paris': 'cet cest france',
  'Europe/Berlin': 'cet cest germany munich frankfurt',
  'Europe/Amsterdam': 'cet cest netherlands holland',
  'Europe/Zurich': 'cet cest switzerland geneva',
  'Europe/Madrid': 'cet cest spain barcelona',
  'Europe/Rome': 'cet cest italy milan',
  'Europe/Stockholm': 'cet cest sweden nordics',
  'Europe/Warsaw': 'cet cest poland',
  'Europe/Athens': 'eet eest greece',
  'Europe/Istanbul': 'trt turkey',
  'Asia/Dubai': 'gst uae united arab emirates abu dhabi gulf',
  'Asia/Riyadh': 'ast saudi arabia ksa',
  'Asia/Qatar': 'ast doha',
  'Asia/Jerusalem': 'ist idt israel tel aviv',
  'Africa/Johannesburg': 'sast south africa cape town',
  'Africa/Lagos': 'wat nigeria west africa',
  'Africa/Nairobi': 'eat kenya east africa',
  'Asia/Kolkata': 'ist india mumbai delhi new delhi bengaluru bangalore hyderabad chennai pune calcutta',
  'Asia/Calcutta': 'ist india kolkata mumbai delhi bengaluru',
  'Asia/Karachi': 'pkt pakistan lahore islamabad',
  'Asia/Dhaka': 'bst bangladesh',
  'Asia/Colombo': 'slst sri lanka',
  'Asia/Kathmandu': 'npt nepal',
  'Asia/Singapore': 'sgt singapore apac asean',
  'Asia/Kuala_Lumpur': 'myt malaysia',
  'Asia/Bangkok': 'ict thailand',
  'Asia/Jakarta': 'wib indonesia',
  'Asia/Manila': 'pht philippines',
  'Asia/Hong_Kong': 'hkt hong kong',
  'Asia/Shanghai': 'cst china beijing shenzhen',
  'Asia/Taipei': 'cst taiwan',
  'Asia/Seoul': 'kst korea south korea',
  'Asia/Tokyo': 'jst japan',
  'Australia/Sydney': 'aest aedt australia nsw canberra',
  'Australia/Melbourne': 'aest aedt australia victoria',
  'Australia/Brisbane': 'aest australia queensland',
  'Australia/Perth': 'awst australia western',
  'Pacific/Auckland': 'nzst nzdt new zealand wellington',
};

interface TimezoneEntry {
  iana: string;
  offsetLabel: string;
  offsetMinutes: number;
  shortAbbr: string;
  longName: string;
  option: CustomSelectOption;
}

function parseOffsetToMinutes(rawOffset: string): number {
  if (!rawOffset || rawOffset === 'GMT' || rawOffset === 'UTC') return 0;
  const match = rawOffset.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10) || 0;
  const mins = parseInt(match[3] || '0', 10) || 0;
  return sign * (hours * 60 + mins);
}

function formatOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'UTC+00:00';
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const mins = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${mins}`;
}

function getTimezonePart(
  tz: string,
  timeZoneName: 'shortOffset' | 'short' | 'long',
  date: Date
): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName,
    }).formatToParts(date);
    return parts.find((p) => p.type === 'timeZoneName')?.value?.trim() || '';
  } catch {
    return '';
  }
}

function buildTimezoneEntry(tz: string, refDate: Date): TimezoneEntry | null {
  try {
    // Validate timezone support in the active JS runtime
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(refDate);
  } catch {
    return null;
  }

  const rawOffset = tz === 'UTC' ? 'GMT' : getTimezonePart(tz, 'shortOffset', refDate);
  const offsetMinutes = tz === 'UTC' ? 0 : parseOffsetToMinutes(rawOffset);
  const offsetLabel = tz === 'UTC' ? 'UTC+00:00' : formatOffsetLabel(offsetMinutes);
  const rawShort = getTimezonePart(tz, 'short', refDate);
  const isRedundantOffset = !rawShort || /^(GMT|UTC)[+-]/i.test(rawShort);
  const shortAbbr = tz === 'UTC' ? 'UTC' : isRedundantOffset ? '' : rawShort;
  const longName =
    tz === 'UTC'
      ? 'Coordinated Universal Time'
      : getTimezonePart(tz, 'long', refDate) || tz.replace(/_/g, ' ');

  const displayZone = tz === 'UTC' ? 'UTC' : tz.replace(/_/g, ' ');
  const label =
    tz === 'UTC'
      ? '(UTC+00:00) UTC — Coordinated Universal Time'
      : shortAbbr
      ? `(${offsetLabel}) ${displayZone} · ${shortAbbr}`
      : `(${offsetLabel}) ${displayZone}`;

  const extraAliases = TIMEZONE_ALIAS_KEYWORDS[tz] || '';
  const keywords = [
    tz,
    displayZone,
    displayZone.replace(/\//g, ' '),
    offsetLabel,
    offsetLabel.replace('UTC', 'GMT'),
    shortAbbr,
    longName,
    extraAliases,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    iana: tz,
    offsetLabel,
    offsetMinutes,
    shortAbbr,
    longName,
    option: {
      value: tz,
      label,
      description: tz === 'UTC' ? 'Universal Standard Time (GMT / Zulu)' : longName,
      keywords,
    },
  };
}

let cachedEntries: TimezoneEntry[] | null = null;
let cachedEntryMap: Map<string, TimezoneEntry> | null = null;

function ensureTimezoneCatalog(): {
  entries: TimezoneEntry[];
  map: Map<string, TimezoneEntry>;
} {
  if (cachedEntries && cachedEntryMap) {
    return { entries: cachedEntries, map: cachedEntryMap };
  }

  const refDate = new Date();
  const supported =
    typeof Intl !== 'undefined' &&
    typeof (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
      .supportedValuesOf === 'function'
      ? (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf(
          'timeZone'
        )
      : [];

  const uniqueIds = new Set<string>(['UTC', ...FALLBACK_IANA_TIMEZONES, ...supported]);
  const entries: TimezoneEntry[] = [];
  const map = new Map<string, TimezoneEntry>();

  for (const id of uniqueIds) {
    const entry = buildTimezoneEntry(id, refDate);
    if (!entry) continue;
    entries.push(entry);
    map.set(entry.iana, entry);
  }

  entries.sort((a, b) => {
    if (a.iana === 'UTC') return -1;
    if (b.iana === 'UTC') return 1;
    if (a.offsetMinutes !== b.offsetMinutes) {
      return a.offsetMinutes - b.offsetMinutes;
    }
    return a.iana.localeCompare(b.iana);
  });

  cachedEntries = entries;
  cachedEntryMap = map;
  return { entries, map };
}

/**
 * Normalizes legacy verbose timezone strings from earlier versions into canonical IANA identifiers.
 */
export function normalizeTimezoneValue(value?: string | null): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'America/Chicago';
  if (LEGACY_TIMEZONE_MAP[trimmed]) return LEGACY_TIMEZONE_MAP[trimmed];

  const { map } = ensureTimezoneCatalog();
  if (map.has(trimmed)) return trimmed;

  // Handle strings stored as "Region/City (XXX)" by probing the leading token
  const leading = trimmed.split(/\s+/)[0];
  if (leading && map.has(leading)) return leading;

  return trimmed;
}

/**
 * Returns the full global searchable timezone list, preserving any custom/legacy value if not in IANA catalog.
 */
export function getTimezoneSelectOptions(currentValue?: string | null): CustomSelectOption[] {
  const { entries, map } = ensureTimezoneCatalog();
  const baseOptions = entries.map((e) => e.option);
  const trimmed = String(currentValue ?? '').trim();
  if (trimmed && !map.has(trimmed)) {
    return [
      {
        value: trimmed,
        label: trimmed,
        description: 'Previously saved timezone',
      },
      ...baseOptions,
    ];
  }
  return baseOptions;
}

/**
 * Formats a date/clock preview in the selected workspace timezone and date format pattern.
 */
export function formatTimezonePreview(
  timezone?: string | null,
  dateFormat: string = 'MM/DD/YYYY',
  now: Date = new Date()
): {
  iana: string;
  offsetLabel: string;
  shortAbbr: string;
  longName: string;
  liveTime: string;
  formattedDate: string;
} {
  const normalized = normalizeTimezoneValue(timezone);
  const { map } = ensureTimezoneCatalog();
  const matched = map.get(normalized);
  const validZone = matched ? matched.iana : 'UTC';

  let liveTime = '';
  let formattedDate = '';
  try {
    liveTime = new Intl.DateTimeFormat('en-US', {
      timeZone: validZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(now);

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: validZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const yyyy = parts.find((p) => p.type === 'year')?.value || '2026';
    const mm = parts.find((p) => p.type === 'month')?.value || '01';
    const dd = parts.find((p) => p.type === 'day')?.value || '01';

    if (dateFormat === 'DD/MM/YYYY') {
      formattedDate = `${dd}/${mm}/${yyyy}`;
    } else if (dateFormat === 'YYYY-MM-DD') {
      formattedDate = `${yyyy}-${mm}-${dd}`;
    } else {
      formattedDate = `${mm}/${dd}/${yyyy}`;
    }
  } catch {
    liveTime = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    formattedDate = now.toISOString().slice(0, 10);
  }

  return {
    iana: normalized,
    offsetLabel: matched?.offsetLabel || 'UTC',
    shortAbbr: matched?.shortAbbr || matched?.offsetLabel || 'UTC',
    longName: matched?.longName || normalized,
    liveTime,
    formattedDate,
  };
}

/**
 * Detects the active browser IANA timezone with a safe fallback.
 */
export function detectBrowserTimezone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved) {
      return normalizeTimezoneValue(resolved);
    }
  } catch {
    // Ignore Intl errors in restricted environments
  }
  return 'America/Chicago';
}
