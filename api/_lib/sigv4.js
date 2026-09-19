import { createHmac, createHash } from 'node:crypto';

const SERVICE = 's3';
const REGION = 'auto';
const PAYLOAD_UNSIGNED = 'UNSIGNED-PAYLOAD';

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function isoDate(now = new Date()) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function shortDate(now = new Date()) {
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

function uriEncodePath(key) {
  return key
    .split('/')
    .map((seg) => encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/');
}

function signingKey(secretKey, date, region) {
  const kDate = hmac(`AWS4${secretKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

/** Build a query-param presigned URL for method in {PUT, GET, DELETE}. */
export function presignedUrl(account, key, method, expiresIn = 3600) {
  const now = new Date();
  const amzDate = isoDate(now);
  const date = shortDate(now);
  const host = new URL(account.endpoint).host;
  const path = uriEncodePath(`/${account.bucket}/${key}`);

  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${account.accessKey}/${date}/${REGION}/${SERVICE}/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };

  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const canonicalRequest =
    `${method}\n${path}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${PAYLOAD_UNSIGNED}`;

  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${date}/${REGION}/${SERVICE}/aws4_request\n${sha256Hex(canonicalRequest)}`;
  const signature = hmac(signingKey(account.secretKey, date, REGION), stringToSign).toString('hex');

  return `${account.endpoint}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function headerAuth(account, key, method, extraHeaders, body) {
  const now = new Date();
  const amzDate = isoDate(now);
  const date = shortDate(now);
  const host = new URL(account.endpoint).host;
  const path = uriEncodePath(`/${account.bucket}/${key}`);
  const payloadHash = body !== undefined ? sha256Hex(body) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...extraHeaders,
  };

  const sortedNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedNames.map((k) => `${k}:${headers[k]}\n`).join('');
  const signedHeaders = sortedNames.join(';');
  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${date}/${REGION}/${SERVICE}/aws4_request\n${sha256Hex(canonicalRequest)}`;
  const signature = hmac(signingKey(account.secretKey, date, REGION), stringToSign).toString('hex');

  return {
    url: `${account.endpoint}${path}`,
    headers: {
      ...headers,
      'x-amz-content-sha256': payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${account.accessKey}/${date}/${REGION}/${SERVICE}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/** Server-side copy (no data through the function). Resolves on success, throws on failure. */
export async function s3Copy(account, fromKey, toKey) {
  const source = `/${account.bucket}/${encodeURIComponent(fromKey).replace(/%2F/g, '/')}`;
  const signed = headerAuth(account, toKey, 'PUT', {
    'x-amz-copy-source': source,
  });
  const res = await fetch(signed.url, { method: 'PUT', headers: signed.headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`COPY_FAILED:${res.status}`);
    err.code = 'COPY_FAILED';
    err.status = res.status;
    err.detail = text.slice(0, 300);
    throw err;
  }
}

export async function s3Delete(account, key) {
  const url = presignedUrl(account, key, 'DELETE', null, 60);
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    await res.text().catch(() => {});
    const err = new Error(`DELETE_FAILED:${res.status}`);
    err.code = 'DELETE_FAILED';
    err.status = res.status;
    throw err;
  }
}