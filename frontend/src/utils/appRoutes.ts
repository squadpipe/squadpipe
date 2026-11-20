export interface ParsedAppRoute {
  view: string;
  entityId?: string;
}

export interface BrowserHistoryRouteState {
  view: string;
  entityId?: string;
  returnView?: string;
}

const STATIC_ROUTE_TO_VIEW: Record<string, string> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/pipeline': 'pipeline',
  '/requirements': 'pipeline',
  '/consultants': 'consultants',
  '/candidates': 'consultants',
  '/clients': 'clients',
  '/vendors': 'vendors',
  '/billable': 'billable',
  '/placements': 'billable',
  '/automations': 'automation',
  '/reminders': 'automation',
  '/application-forms': 'application_forms',
  '/application-forms/new': 'application_form_new',
  '/custom-fields': 'custom_fields',
  '/dropdown-lists': 'dropdown_lists',
  '/import-data': 'import_data',
  '/team-performance': 'team_performance',
  '/usage': 'usage',
  '/settings': 'settings_general',
  '/users': 'user_management',
};

const VIEW_TO_STATIC_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  pipeline: '/pipeline',
  consultants: '/consultants',
  clients: '/clients',
  vendors: '/vendors',
  billable: '/billable',
  automation: '/automations',
  application_forms: '/application-forms',
  application_form_new: '/application-forms/new',
  custom_fields: '/custom-fields',
  dropdown_lists: '/dropdown-lists',
  import_data: '/import-data',
  team_performance: '/team-performance',
  usage: '/usage',
  settings_general: '/settings',
  user_management: '/users',
};

const VIEW_TITLE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard Overview',
  pipeline: 'Opportunity Pipeline',
  requirement_detail: 'Requirement Details',
  consultants: 'Consultant Directory',
  consultant_detail: 'Consultant Profile',
  clients: 'Client Directory',
  client_detail: 'Client Details',
  vendors: 'Staffing Vendors',
  vendor_detail: 'Vendor Details',
  billable: 'Billable Consultants',
  placement_detail: 'Placement Details',
  automation: 'Smart Reminders',
  application_forms: 'Application Forms',
  application_form_new: 'New Application Form',
  application_form_edit: 'Edit Application Form',
  custom_fields: 'Custom Form Fields',
  dropdown_lists: 'Master Dropdown Lists',
  import_data: 'Import Candidates & Resumes',
  team_performance: 'Team Performance',
  usage: 'Workspace Usage & Storage',
  settings_general: 'General Settings',
  user_management: 'User Management',
};

function safeDecodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Parses a browser URL pathname into an internal workspace view and optional detail record ID.
 */
export function parseAppRoute(pathname: string): ParsedAppRoute {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';

  const detailPatterns: Array<[RegExp, string]> = [
    [/^\/requirements\/([^/]+)$/i, 'requirement_detail'],
    [/^\/(?:consultants|candidates)\/([^/]+)$/i, 'consultant_detail'],
    [/^\/clients\/([^/]+)$/i, 'client_detail'],
    [/^\/vendors\/([^/]+)$/i, 'vendor_detail'],
    [/^\/(?:placements|billable)\/([^/]+)$/i, 'placement_detail'],
    [/^\/application-forms\/([^/]+)\/edit$/i, 'application_form_edit'],
  ];

  for (const [pattern, view] of detailPatterns) {
    const match = cleanPath.match(pattern);
    if (match?.[1]) {
      return { view, entityId: safeDecodeSegment(match[1]) };
    }
  }

  return { view: STATIC_ROUTE_TO_VIEW[cleanPath.toLowerCase()] || 'dashboard' };
}

/**
 * Serializes an internal workspace view + optional record ID into a shareable browser pathname.
 */
export function buildAppPath(view: string, entityId?: string | null): string {
  const id = entityId ? encodeURIComponent(entityId) : '';
  switch (view) {
    case 'requirement_detail':
      return id ? `/requirements/${id}` : '/pipeline';
    case 'consultant_detail':
      return id ? `/consultants/${id}` : '/consultants';
    case 'client_detail':
      return id ? `/clients/${id}` : '/clients';
    case 'vendor_detail':
      return id ? `/vendors/${id}` : '/vendors';
    case 'placement_detail':
      return id ? `/placements/${id}` : '/billable';
    case 'application_form_edit':
      return id ? `/application-forms/${id}/edit` : '/application-forms';
    default:
      return VIEW_TO_STATIC_PATH[view] || '/dashboard';
  }
}

/**
 * Formats a concise browser tab title for the active view or record.
 */
export function buildDocumentTitle(view: string, recordLabel?: string): string {
  const prefix = recordLabel?.trim() || VIEW_TITLE_LABELS[view] || 'Dashboard Overview';
  return `${prefix} — SquadPipe`;
}
