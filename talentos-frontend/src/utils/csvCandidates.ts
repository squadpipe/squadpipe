export interface CsvCandidateRowInput {
  fullName: string;
  email: string;
  phone?: string;
  workAuth?: string;
  education?: string;
  currentTitle?: string;
  skillset?: string;
  hourlyRateDisplay?: string;
  relocation?: string;
  assignedRecruiter?: string;
}

export const SAMPLE_CSV_HEADERS = [
  'Candidate_Name',
  'Designation_Title',
  'Visa_Status',
  'Email_Address',
  'Phone_Cell',
  'Rate_Expectation',
  'Relocation_Pref',
  'Primary_Skillset',
  'Education',
  'Desk_Owner',
] as const;

export const escapeCsvField = (val: string): string => {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/**
 * Parses a single RFC-4180 CSV line while preserving commas inside quoted fields.
 */
export const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
};

/**
 * Parses raw candidate CSV content into structured API row payloads.
 * Requires at least one header line and non-empty Name + Email columns per row.
 */
export const parseCandidateCsvText = (csvText: string): CsvCandidateRowInput[] => {
  const normalized = String(csvText || '').replace(/^\uFEFF/, '');
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines
    .slice(1)
    .map((line) => {
      const parts = parseCsvLine(line);
      const row: Partial<CsvCandidateRowInput> = {};

      headers.forEach((h, i) => {
        const val = (parts[i] || '').trim();
        if (h.includes('desk') || h.includes('recruiter') || h.includes('owner')) {
          row.assignedRecruiter = val;
        } else if (h.includes('name')) {
          row.fullName = val;
        } else if (h.includes('title') || h.includes('role') || h.includes('designation')) {
          row.currentTitle = val;
        } else if (h.includes('email')) {
          row.email = val;
        } else if (h.includes('phone') || h.includes('cell') || h.includes('mobile')) {
          row.phone = val;
        } else if (h.includes('visa') || h.includes('auth')) {
          row.workAuth = val;
        } else if (h.includes('rate')) {
          row.hourlyRateDisplay = val;
        } else if (h.includes('skill')) {
          row.skillset = val;
        } else if (h.includes('relo')) {
          row.relocation = val;
        } else if (h.includes('edu') || h.includes('degree')) {
          row.education = val;
        }
      });

      return row as CsvCandidateRowInput;
    })
    .filter((r) => Boolean(r.fullName && r.email));
};

/**
 * Generates and downloads a formatted 3-candidate CSV template file.
 * Returns the downloaded filename.
 */
export const downloadSampleCandidatesCsv = (brandSlug: string, currencySymbol: string): string => {
  const sampleCsvRows = [
    {
      fullName: 'Aarav Mehta',
      currentTitle: 'Senior Java Microservices Architect',
      workAuth: 'US Citizen',
      email: 'aarav.mehta@example.com',
      phone: '+1 (512) 555-0142',
      hourlyRateDisplay: `${currencySymbol}95/hr (C2C)`,
      relocation: 'Yes',
      skillset: 'Java, Spring Boot, Kafka, AWS, PostgreSQL',
      education: 'MS Computer Science',
      assignedRecruiter: 'Recruitment Desk',
    },
    {
      fullName: 'Priya Nair',
      currentTitle: 'Staff Data & Databricks Engineer',
      workAuth: 'Green Card',
      email: 'priya.nair@example.com',
      phone: '+1 (469) 555-0188',
      hourlyRateDisplay: `${currencySymbol}88/hr (W2)`,
      relocation: 'Yes',
      skillset: 'Python, PySpark, Databricks, Snowflake, SQL',
      education: 'B.Tech Data Science',
      assignedRecruiter: 'Recruitment Desk',
    },
    {
      fullName: 'Daniel Brooks',
      currentTitle: 'Lead DevOps & Kubernetes Engineer',
      workAuth: 'US Citizen',
      email: 'daniel.brooks@example.com',
      phone: '+1 (312) 555-0165',
      hourlyRateDisplay: `${currencySymbol}105/hr (C2C)`,
      relocation: 'No',
      skillset: 'Kubernetes, Terraform, AWS, Docker, CI/CD',
      education: 'BS Information Systems',
      assignedRecruiter: 'Recruitment Desk',
    },
  ];

  const rowLines = sampleCsvRows.map((r) =>
    [
      r.fullName,
      r.currentTitle,
      r.workAuth,
      r.email,
      r.phone,
      r.hourlyRateDisplay,
      r.relocation,
      r.skillset,
      r.education,
      r.assignedRecruiter,
    ]
      .map(escapeCsvField)
      .join(',')
  );

  const csvContent = [SAMPLE_CSV_HEADERS.join(','), ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const sampleCsvFilename = `${brandSlug}_Sample_Candidates_Template.csv`;
  link.href = url;
  link.download = sampleCsvFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return sampleCsvFilename;
};
