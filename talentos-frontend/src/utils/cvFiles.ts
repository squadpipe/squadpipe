import { apiClient } from '../config/api.config';

export const ALLOWED_CV_ACCEPT = '.pdf,.doc,.docx,.txt,.rtf';
export const MAX_CV_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_CV_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.rtf'];

/**
 * Validates extension and file size for a selected CV file.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateCvFileSelection(file: File): string | null {
  const lower = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_CV_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasAllowedExt) {
    return 'Unsupported file format. Please upload a PDF, DOC, DOCX, TXT, or RTF file.';
  }
  if (file.size <= 0) {
    return 'The selected CV file appears to be empty.';
  }
  if (file.size > MAX_CV_FILE_BYTES) {
    return 'CV file exceeds the 15 MB upload limit.';
  }
  return null;
}

/**
 * Builds a multipart/form-data payload containing candidate fields and the CV file.
 */
export function buildCandidateFormData(
  fields: Record<string, any>,
  cvFile: File
): FormData {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  });
  formData.append('file', cvFile, cvFile.name);
  return formData;
}

function parseFilenameFromDisposition(
  headerValue: string | undefined,
  fallbackName: string
): string {
  if (!headerValue) return fallbackName;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // Fallback to standard filename attribute below
    }
  }

  const asciiMatch = headerValue.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1].trim();
  }

  return fallbackName;
}

/**
 * Downloads the original stored CV file for a candidate via the authenticated API.
 */
export async function downloadOriginalCandidateCv(
  candidateId: string,
  fallbackFileName: string = 'candidate_cv.pdf'
): Promise<string> {
  const response = await apiClient.get(`/candidates/${candidateId}/cv`, {
    responseType: 'blob',
  });

  const resolvedName = parseFilenameFromDisposition(
    response.headers?.['content-disposition'],
    fallbackFileName
  );
  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = resolvedName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  return resolvedName;
}
