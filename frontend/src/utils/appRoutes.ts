export interface ParsedAppRoute {
  view: string;
  entityId?: string;
  query?: Record<string, string>;
}

export interface BrowserHistoryRouteState {
  view: string;
  entityId?: string;
  returnView?: string;
  returnReqId?: string;
  query?: Record<string, string>;
}

const STATIC_ROUTE_TO_VIEW: Record<string, string> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/pipeline': 'pipeline',
  '/requirements': 'pipeline',
  '/requirements/new': 'requirement_new',
  '/requirements/from-email': 'requirement_from_email',
  '/consultants': 'consultants',
  '/consultants/new': 'consultant_new',
  '/candidates': 'consultants',
  '/candidates/new': 'consultant_new',
  '/clients': 'clients',
  '/vendors': 'vendors',
  '/billable': 'billable',
  '/billable/new': 'placement_new',
  '/placements': 'billable',
  '/placements/new': 'placement_new',
  '/automations': 'automation',
  '/reminders': 'automation',
  '/application-forms': 'application_forms',
  '/application-forms/new': 'application_form_new',
  '/custom-fields': 'custom_fields',
  '/dropdown-lists': 'dropdown_lists',
  '/import-data': 'import_data',
  '/import-data/resume': 'import_resume',
  '/import-data/csv': 'import_csv',
  '/team-performance': 'team_performance',
  '/usage': 'usage',
  '/settings': 'settings_general',
  '/users': 'user_management',
};

const VIEW_TO_STATIC_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  pipeline: '/pipeline',
  requirement_new: '/requirements/new',
  requirement_from_email: '/requirements/from-email',
  consultants: '/consultants',
  consultant_new: '/consultants/new',
  clients: '/clients',
  vendors: '/vendors',
  billable: '/billable',
  placement_new: '/placements/new',
  automation: '/automations',
  application_forms: '/application-forms',
  application_form_new: '/application-forms/new',
  custom_fields: '/custom-fields',
  dropdown_lists: '/dropdown-lists',
  import_data: '/import-data',
  import_resume: '/import-data/resume',
  import_csv: '/import-data/csv',
  team_performance: '/team-performance',
  usage: '/usage',
  settings_general: '/settings',
  user_management: '/users',
};

const VIEW_TITLE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  pipeline: 'Pipeline',
  requirement_new: 'New Job Requirement',
  requirement_edit: 'Edit Requirement',
  requirement_form_preview: 'Application Form Preview',
  requirement_from_email: 'Create Job from Email',
  requirement_detail: 'Requirement Details',
  consultants: 'Consultants',
  consultant_new: 'Add Consultant',
  consultant_edit: 'Edit Consultant Profile',
  consultant_detail: 'Consultant Profile',
  clients: 'Clients',
  client_detail: 'Client Details',
  client_edit: 'Edit Client Account',
  vendors: 'Vendors',
  vendor_detail: 'Vendor Details',
  vendor_edit: 'Edit Partner Vendor',
  billable: 'Billable Consultants',
  placement_new: 'New Billable Placement',
  placement_detail: 'Placement Details',
  automation: 'Smart Reminders',
  application_forms: 'Application Forms',
  application_form_new: 'New Application Form',
  application_form_edit: 'Edit Application Form',
  custom_fields: 'Custom Form Fields',
  dropdown_lists: 'Master Dropdown Lists',
  import_data: 'Import Data',
  import_resume: 'Upload Resumes',
  import_csv: 'Import from Spreadsheet',
  team_performance: 'Team Performance',
  usage: 'Usage & Storage',
  settings_general: 'General Settings',
  user_management: 'Team Members',
};

function safeDecodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function parseQueryString(search?: string): Record<string, string> | undefined {
  if (!search) return undefined;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Parses a browser URL pathname and optional query string into an internal workspace view and optional detail record ID.
 */
export function parseAppRoute(pathname: string, search?: string): ParsedAppRoute {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const query = parseQueryString(
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : ''
  );

  // Match explicit static sub-routes (e.g. /requirements/from-email, /placements/new) before :id patterns
  const staticView = STATIC_ROUTE_TO_VIEW[cleanPath.toLowerCase()];
  if (staticView) {
    return query ? { view: staticView, query } : { view: staticView };
  }

  const detailPatterns: Array<[RegExp, string]> = [
    [/^\/requirements\/([^/]+)\/form-preview$/i, 'requirement_form_preview'],
    [/^\/requirements\/([^/]+)\/edit$/i, 'requirement_edit'],
    [/^\/requirements\/([^/]+)$/i, 'requirement_detail'],
    [/^\/(?:consultants|candidates)\/([^/]+)\/edit$/i, 'consultant_edit'],
    [/^\/(?:consultants|candidates)\/([^/]+)$/i, 'consultant_detail'],
    [/^\/clients\/([^/]+)\/edit$/i, 'client_edit'],
    [/^\/clients\/([^/]+)$/i, 'client_detail'],
    [/^\/vendors\/([^/]+)\/edit$/i, 'vendor_edit'],
    [/^\/vendors\/([^/]+)$/i, 'vendor_detail'],
    [/^\/(?:placements|billable)\/([^/]+)$/i, 'placement_detail'],
    [/^\/application-forms\/([^/]+)\/edit$/i, 'application_form_edit'],
  ];

  for (const [pattern, view] of detailPatterns) {
    const match = cleanPath.match(pattern);
    if (match?.[1]) {
      const entityId = safeDecodeSegment(match[1]);
      return query ? { view, entityId, query } : { view, entityId };
    }
  }

  return query ? { view: 'dashboard', query } : { view: 'dashboard' };
}

/**
 * Serializes an internal workspace view + optional record ID and query params into a shareable browser URL path.
 */
export function buildAppPath(
  view: string,
  entityId?: string | null,
  query?: Record<string, string | undefined | null>
): string {
  const id = entityId ? encodeURIComponent(entityId) : '';
  let basePath: string;
  switch (view) {
    case 'requirement_edit':
      basePath = id ? `/requirements/${id}/edit` : '/pipeline';
      break;
    case 'requirement_form_preview':
      basePath = id ? `/requirements/${id}/form-preview` : '/pipeline';
      break;
    case 'requirement_detail':
      basePath = id ? `/requirements/${id}` : '/pipeline';
      break;
    case 'consultant_edit':
      basePath = id ? `/consultants/${id}/edit` : '/consultants';
      break;
    case 'consultant_detail':
      basePath = id ? `/consultants/${id}` : '/consultants';
      break;
    case 'client_edit':
      basePath = id ? `/clients/${id}/edit` : '/clients';
      break;
    case 'client_detail':
      basePath = id ? `/clients/${id}` : '/clients';
      break;
    case 'vendor_edit':
      basePath = id ? `/vendors/${id}/edit` : '/vendors';
      break;
    case 'vendor_detail':
      basePath = id ? `/vendors/${id}` : '/vendors';
      break;
    case 'placement_detail':
      basePath = id ? `/placements/${id}` : '/billable';
      break;
    case 'application_form_edit':
      basePath = id ? `/application-forms/${id}/edit` : '/application-forms';
      break;
    default:
      basePath = VIEW_TO_STATIC_PATH[view] || '/dashboard';
      break;
  }

  if (!query) return basePath;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value && value.trim()) {
      params.set(key, value.trim());
    }
  });
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Formats a concise browser tab title for the active view or record.
 */
export function buildDocumentTitle(view: string, recordLabel?: string): string {
  const prefix = recordLabel?.trim() || VIEW_TITLE_LABELS[view] || 'Dashboard Overview';
  return `${prefix} — SquadPipe`;
}
