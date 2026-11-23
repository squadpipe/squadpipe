import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type CvStorageProvider = 'local' | 's3' | 'cloudflare';

export interface UploadedCvFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size?: number;
}

export interface StoredCvMetadata {
  provider: CvStorageProvider;
  objectKey: string;
  storageUri: string;
  originalFileName: string;
  resumeFormat: string;
  contentType: string;
  sizeBytes: number;
}

export interface DownloadedCvResult {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  provider: CvStorageProvider;
  objectKey: string;
}

export interface S3CompatibleConfig {
  provider: 's3' | 'cloudflare';
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  endpointUrl: string;
  forcePathStyle: boolean;
  keyPrefix?: string;
}

export interface SignedRequestSpec {
  url: string;
  method: 'GET' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
}

export interface VerifiedDeleteResult {
  deleted: boolean;
  alreadyMissing: boolean;
  provider: CvStorageProvider;
  objectKey: string;
  error?: string;
}

const MAX_CV_BYTES = 15 * 1024 * 1024;

const EXT_TO_FORMAT: Record<string, string> = {
  '.pdf': 'PDF',
  '.docx': 'DOCX',
  '.doc': 'DOC',
  '.txt': 'TXT',
  '.rtf': 'RTF',
};

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain; charset=utf-8',
  '.rtf': 'application/rtf',
};

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
  'application/rtf': '.rtf',
  'text/rtf': '.rtf',
};

/**
 * Resolves the active CV storage provider from CV_STORAGE_PROVIDER (or an explicit override).
 */
export function resolveCvStorageProvider(override?: string): CvStorageProvider {
  const raw = (override ?? process.env.CV_STORAGE_PROVIDER ?? 'local').trim().toLowerCase();
  if (!raw || raw === 'local' || raw === 'disk' || raw === 'filesystem') {
    return 'local';
  }
  if (raw === 's3' || raw === 'aws' || raw === 'aws-s3') {
    return 's3';
  }
  if (raw === 'cloudflare' || raw === 'r2' || raw === 'cloudflare-r2') {
    return 'cloudflare';
  }
  throw new Error(
    `Unsupported CV_STORAGE_PROVIDER "${raw}". Expected one of: local, s3, cloudflare.`
  );
}

/**
 * Sanitizes a tenant identifier into a safe single path segment for storage isolation.
 */
export function sanitizeTenantSegment(tenantId?: string): string {
  const cleaned = String(tenantId || 'default-tenant')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  return cleaned || 'default-tenant';
}

export function resolveCvExtension(originalName: string, mimetype?: string): string {
  const extFromName = path.extname(originalName || '').toLowerCase();
  if (extFromName && EXT_TO_FORMAT[extFromName]) {
    return extFromName;
  }
  const cleanMime = String(mimetype || '').split(';')[0].trim().toLowerCase();
  if (cleanMime && MIME_TO_EXT[cleanMime]) {
    return MIME_TO_EXT[cleanMime];
  }
  throw new Error(
    `Unsupported CV file type "${extFromName || cleanMime || 'unknown'}". Allowed formats: PDF, DOC, DOCX, TXT, RTF.`
  );
}

function sanitizeBaseFileName(originalName: string, ext: string): string {
  const rawBase = path.basename(originalName || 'resume', ext || undefined);
  const cleaned = rawBase
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 80);
  return cleaned || 'resume';
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeObjectPath(objectKey: string): string {
  return objectKey
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeRfc3986(segment))
    .join('/');
}

function normalizePrefix(prefix?: string): string {
  return String(prefix || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

/**
 * Builds a tenant-isolated, timestamped, guaranteed-unique storage object key for a CV file.
 */
export function buildUniqueCvObjectKey(
  tenantId: string | undefined,
  originalFileName: string,
  mimetype?: string,
  now: Date = new Date()
): { objectKey: string; ext: string; resumeFormat: string; contentType: string } {
  const ext = resolveCvExtension(originalFileName, mimetype);
  const safeTenant = sanitizeTenantSegment(tenantId);
  const safeBase = sanitizeBaseFileName(originalFileName, ext);
  const timestampMs = now.getTime();
  const isoStamp = now.toISOString().replace(/[:.]/g, '-');
  const randomHex = crypto.randomBytes(6).toString('hex');

  return {
    objectKey: `tenants/${safeTenant}/cvs/${timestampMs}_${isoStamp}_${randSafe(randomHex)}_${safeBase}${ext}`,
    ext,
    resumeFormat: EXT_TO_FORMAT[ext] || 'PDF',
    contentType: EXT_TO_CONTENT_TYPE[ext] || 'application/octet-stream',
  };
}

function randSafe(hex: string): string {
  return hex.toLowerCase();
}

/**
 * Parses canonical storage URIs (`local://...`, `s3://bucket/key`, `r2://bucket/key`).
 */
export function parseCvStorageUri(
  uri?: string | null
): { provider: CvStorageProvider; bucket?: string; objectKey: string } | null {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();

  if (trimmed.startsWith('local://')) {
    const objectKey = trimmed.slice('local://'.length).replace(/^\/+/, '');
    return objectKey ? { provider: 'local', objectKey } : null;
  }

  if (trimmed.startsWith('s3://') || trimmed.startsWith('r2://')) {
    const provider: CvStorageProvider = trimmed.startsWith('r2://') ? 'cloudflare' : 's3';
    const rest = trimmed.slice(5).replace(/^\/+/, '');
    const slashIdx = rest.indexOf('/');
    if (slashIdx <= 0 || slashIdx === rest.length - 1) return null;
    return {
      provider,
      bucket: rest.slice(0, slashIdx),
      objectKey: rest.slice(slashIdx + 1),
    };
  }

  return null;
}

/**
 * Returns the resolved local disk directory for CV storage.
 */
export function getLocalCvBaseDir(): string {
  const configured = process.env.CV_LOCAL_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), 'uploads', 'cv');
}

function resolveSafeLocalPath(baseDir: string, objectKey: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, objectKey);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Invalid local CV storage path');
  }
  return resolvedTarget;
}

/**
 * Loads S3 or Cloudflare R2 configuration from environment variables.
 */
export function getS3CompatibleConfig(
  provider: 's3' | 'cloudflare',
  bucketOverride?: string
): S3CompatibleConfig {
  if (provider === 'cloudflare') {
    const bucket = (
      bucketOverride ||
      process.env.CLOUDFLARE_R2_BUCKET ||
      process.env.R2_BUCKET ||
      ''
    ).trim();
    const accountId = (
      process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
      process.env.R2_ACCOUNT_ID ||
      ''
    ).trim();
    const accessKeyId = (
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      process.env.R2_ACCESS_KEY_ID ||
      ''
    ).trim();
    const secretAccessKey = (
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_ACCESS_KEY ||
      ''
    ).trim();
    const jurisdiction = (
      process.env.CLOUDFLARE_R2_JURISDICTION ||
      process.env.R2_JURISDICTION ||
      ''
    )
      .trim()
      .toLowerCase();
    const defaultAccountEndpoint = accountId
      ? jurisdiction === 'eu' ||
        jurisdiction === 'us' ||
        jurisdiction === 'fedramp' ||
        jurisdiction === 'fedramp-high'
        ? `https://${accountId}.${jurisdiction}.r2.cloudflarestorage.com`
        : `https://${accountId}.r2.cloudflarestorage.com`
      : '';
    const endpointRaw = (
      process.env.CLOUDFLARE_R2_ENDPOINT ||
      process.env.R2_ENDPOINT ||
      defaultAccountEndpoint
    ).trim();

    if (!bucket || !accessKeyId || !secretAccessKey || !endpointRaw) {
      throw new Error(
        'Cloudflare R2 storage requires CLOUDFLARE_R2_BUCKET, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, and CLOUDFLARE_R2_ACCOUNT_ID (or CLOUDFLARE_R2_ENDPOINT).'
      );
    }

    return {
      provider: 'cloudflare',
      bucket,
      region: (process.env.CLOUDFLARE_R2_REGION || 'auto').trim(),
      accessKeyId,
      secretAccessKey,
      endpointUrl: endpointRaw.replace(/\/+$/, ''),
      forcePathStyle: true,
      keyPrefix: normalizePrefix(process.env.CLOUDFLARE_R2_PREFIX),
    };
  }

  const bucket = (bucketOverride || process.env.AWS_S3_BUCKET || process.env.CV_S3_BUCKET || '').trim();
  const region = (process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-1').trim();
  const accessKeyId = (
    process.env.AWS_S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    ''
  ).trim();
  const secretAccessKey = (
    process.env.AWS_S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    ''
  ).trim();
  const sessionToken = (process.env.AWS_SESSION_TOKEN || '').trim() || undefined;
  const endpointRaw = (process.env.AWS_S3_ENDPOINT || '').trim();
  const forcePathStyleRaw = (process.env.AWS_S3_FORCE_PATH_STYLE || '').trim().toLowerCase();
  const forcePathStyle =
    forcePathStyleRaw === 'true'
      ? true
      : forcePathStyleRaw === 'false'
        ? false
        : Boolean(endpointRaw);

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS S3 storage requires AWS_S3_BUCKET, AWS_ACCESS_KEY_ID (or AWS_S3_ACCESS_KEY_ID), and AWS_SECRET_ACCESS_KEY (or AWS_S3_SECRET_ACCESS_KEY).'
    );
  }

  const defaultEndpoint = forcePathStyle
    ? `https://s3.${region}.amazonaws.com`
    : `https://${bucket}.s3.${region}.amazonaws.com`;

  return {
    provider: 's3',
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    endpointUrl: (endpointRaw || defaultEndpoint).replace(/\/+$/, ''),
    forcePathStyle,
    keyPrefix: normalizePrefix(process.env.AWS_S3_PREFIX),
  };
}

function buildS3ObjectUrl(config: S3CompatibleConfig, objectKey: string): string {
  const encodedKey = encodeObjectPath(objectKey);
  if (config.forcePathStyle) {
    return `${config.endpointUrl}/${encodeRfc3986(config.bucket)}/${encodedKey}`;
  }
  return `${config.endpointUrl}/${encodedKey}`;
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * Signs an S3 / Cloudflare R2 HTTP request using AWS Signature Version 4.
 */
export function buildSignedS3Request(params: {
  config: S3CompatibleConfig;
  method: 'GET' | 'PUT' | 'DELETE';
  objectKey: string;
  body?: Buffer;
  contentType?: string;
  now?: Date;
}): SignedRequestSpec {
  const { config, method, objectKey, body, contentType, now = new Date() } = params;
  const targetUrl = new URL(buildS3ObjectUrl(config, objectKey));

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body ?? Buffer.alloc(0));

  const headersToSign: Record<string, string> = {
    host: targetUrl.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  if (contentType && method === 'PUT') {
    headersToSign['content-type'] = contentType;
  }
  if (config.sessionToken) {
    headersToSign['x-amz-security-token'] = config.sessionToken;
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((key) => `${key}:${headersToSign[key].trim()}\n`)
    .join('');
  const signedHeaders = sortedHeaderKeys.join(';');

  const canonicalQuery = Array.from(targetUrl.searchParams.entries())
    .sort(([aKey, aVal], [bKey, bVal]) =>
      aKey === bKey ? aVal.localeCompare(bVal) : aKey.localeCompare(bKey)
    )
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&');

  const canonicalRequest = [
    method,
    targetUrl.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, config.region);
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders: Record<string, string> = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: authorization,
  };
  if (contentType && method === 'PUT') {
    requestHeaders['Content-Type'] = contentType;
  }
  if (config.sessionToken) {
    requestHeaders['x-amz-security-token'] = config.sessionToken;
  }

  return {
    url: targetUrl.toString(),
    method,
    headers: requestHeaders,
  };
}

function validateUploadedFile(file: UploadedCvFile): void {
  if (!file || !file.originalname) {
    throw new Error('A valid CV file is required');
  }
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('Uploaded CV file is empty');
  }
  if (file.buffer.length > MAX_CV_BYTES) {
    throw new Error('CV file exceeds the 15 MB upload limit');
  }
}

function deriveDownloadMeta(objectKey: string, fallbackName?: string): {
  fileName: string;
  contentType: string;
} {
  const base = path.basename(objectKey);
  const ext = path.extname(fallbackName || base).toLowerCase();
  return {
    fileName: fallbackName || base || 'resume.pdf',
    contentType: EXT_TO_CONTENT_TYPE[ext] || 'application/octet-stream',
  };
}

class CvStorageService {
  /**
   * Uploads a CV file to the configured env provider (`local`, `s3`, or `cloudflare`)
   * under a tenant-isolated, timestamped unique object key.
   */
  async uploadCv(
    file: UploadedCvFile,
    tenantId?: string,
    providerOverride?: string
  ): Promise<StoredCvMetadata> {
    validateUploadedFile(file);

    const provider = resolveCvStorageProvider(providerOverride);
    const { objectKey: rawKey, resumeFormat, contentType } = buildUniqueCvObjectKey(
      tenantId,
      file.originalname,
      file.mimetype
    );

    if (provider === 'local') {
      const baseDir = getLocalCvBaseDir();
      const targetPath = resolveSafeLocalPath(baseDir, rawKey);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, file.buffer);

      return {
        provider: 'local',
        objectKey: rawKey,
        storageUri: `local://${rawKey}`,
        originalFileName: file.originalname,
        resumeFormat,
        contentType,
        sizeBytes: file.buffer.length,
      };
    }

    const config = getS3CompatibleConfig(provider);
    const fullObjectKey = config.keyPrefix ? `${config.keyPrefix}/${rawKey}` : rawKey;
    const signed = buildSignedS3Request({
      config,
      method: 'PUT',
      objectKey: fullObjectKey,
      body: file.buffer,
      contentType,
    });

    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: new Uint8Array(file.buffer),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Failed to upload CV to ${provider.toUpperCase()} storage (${response.status}): ${errorText.slice(0, 240) || response.statusText}`
      );
    }

    const scheme = provider === 'cloudflare' ? 'r2' : 's3';
    return {
      provider,
      objectKey: fullObjectKey,
      storageUri: `${scheme}://${config.bucket}/${fullObjectKey}`,
      originalFileName: file.originalname,
      resumeFormat,
      contentType,
      sizeBytes: file.buffer.length,
    };
  }

  /**
   * Downloads a previously stored CV binary using its canonical storage URI.
   */
  async downloadCv(
    storageUri: string,
    preferredFileName?: string
  ): Promise<DownloadedCvResult> {
    const parsed = parseCvStorageUri(storageUri);
    if (!parsed) {
      throw new Error('No stored CV file is attached to this consultant');
    }

    const meta = deriveDownloadMeta(parsed.objectKey, preferredFileName);

    if (parsed.provider === 'local') {
      const targetPath = resolveSafeLocalPath(getLocalCvBaseDir(), parsed.objectKey);
      const buffer = await fs.readFile(targetPath);
      return {
        buffer,
        contentType: meta.contentType,
        fileName: meta.fileName,
        provider: 'local',
        objectKey: parsed.objectKey,
      };
    }

    const config = getS3CompatibleConfig(parsed.provider, parsed.bucket);
    const signed = buildSignedS3Request({
      config,
      method: 'GET',
      objectKey: parsed.objectKey,
    });

    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Failed to retrieve CV from ${parsed.provider.toUpperCase()} storage (${response.status}): ${errorText.slice(0, 240) || response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') || meta.contentType,
      fileName: meta.fileName,
      provider: parsed.provider,
      objectKey: parsed.objectKey,
    };
  }

  /**
   * Returns on-disk byte size for a `local://` CV object, or `null` for remote / missing objects.
   */
  async getLocalObjectByteSize(storageUri?: string | null): Promise<number | null> {
    const parsed = parseCvStorageUri(storageUri);
    if (!parsed || parsed.provider !== 'local') return null;

    try {
      const targetPath = resolveSafeLocalPath(getLocalCvBaseDir(), parsed.objectKey);
      const stat = await fs.stat(targetPath);
      return stat.isFile() ? stat.size : null;
    } catch {
      return null;
    }
  }

  /**
   * Deletes a stored CV and returns explicit verification status so erasure flows
   * never silently leave orphaned files behind in R2/S3 or local storage.
   */
  async deleteCvVerified(storageUri?: string | null): Promise<VerifiedDeleteResult> {
    const parsed = parseCvStorageUri(storageUri);
    if (!parsed) {
      return {
        deleted: true,
        alreadyMissing: true,
        provider: 'local',
        objectKey: '',
      };
    }

    try {
      if (parsed.provider === 'local') {
        const targetPath = resolveSafeLocalPath(getLocalCvBaseDir(), parsed.objectKey);
        try {
          await fs.unlink(targetPath);
          return {
            deleted: true,
            alreadyMissing: false,
            provider: 'local',
            objectKey: parsed.objectKey,
          };
        } catch (err: any) {
          if (err?.code === 'ENOENT') {
            return {
              deleted: true,
              alreadyMissing: true,
              provider: 'local',
              objectKey: parsed.objectKey,
            };
          }
          return {
            deleted: false,
            alreadyMissing: false,
            provider: 'local',
            objectKey: parsed.objectKey,
            error: err?.message || 'Failed to unlink local CV file',
          };
        }
      }

      const config = getS3CompatibleConfig(parsed.provider, parsed.bucket);
      const signed = buildSignedS3Request({
        config,
        method: 'DELETE',
        objectKey: parsed.objectKey,
      });

      const response = await fetch(signed.url, {
        method: signed.method,
        headers: signed.headers,
      });

      if (response.ok || response.status === 404) {
        return {
          deleted: true,
          alreadyMissing: response.status === 404,
          provider: parsed.provider,
          objectKey: parsed.objectKey,
        };
      }

      const errorText = await response.text().catch(() => '');
      return {
        deleted: false,
        alreadyMissing: false,
        provider: parsed.provider,
        objectKey: parsed.objectKey,
        error: `Failed to delete CV from ${parsed.provider.toUpperCase()} storage (${response.status}): ${errorText.slice(0, 240) || response.statusText}`,
      };
    } catch (err: any) {
      return {
        deleted: false,
        alreadyMissing: false,
        provider: parsed.provider,
        objectKey: parsed.objectKey,
        error: err?.message || `Failed to delete CV from ${parsed.provider.toUpperCase()} storage`,
      };
    }
  }

  /**
   * Cleanup of a stored CV file when replaced or deleted.
   * Pass `{ throwOnError: true }` when the caller requires strict failure propagation.
   */
  async deleteCv(
    storageUri?: string | null,
    options?: { throwOnError?: boolean }
  ): Promise<VerifiedDeleteResult> {
    const result = await this.deleteCvVerified(storageUri);
    if (!result.deleted && options?.throwOnError) {
      throw new Error(result.error || 'Failed to delete stored CV file');
    }
    return result;
  }
}

export const cvStorageService = new CvStorageService();
