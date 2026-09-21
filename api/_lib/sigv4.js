const SERVICE = 's3';
const REGION = 'auto';
const PAYLOAD_UNSIGNED = 'UNSIGNED-PAYLOAD';

const enc = new TextEncoder();

async function hmac(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
  return new Uint8Array(sig);
}

function toHex(bytes) {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

async function sha256Hex(data) {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
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

async function signingKey(secretKey, date, region) {
  const kDate = await hmac(enc.encode(`AWS4${secretKey}`), enc.encode(date));
  const kRegion = await hmac(kDate, enc.encode(region));
  const kService = await hmac(kRegion, enc.encode(SERVICE));
  return hmac(kService, enc.encode('aws4_request'));
}

/** Query-param presigned URL for method in {PUT, GET, DELETE}.
 *  extraQuery: additional query params (e.g. S3 response-* overrides) included in the signature. */
export async function presignedUrl(account, key, method, expiresIn = 3600, extraQuery = null) {
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
    ...(extraQuery ?? {}),
  };

  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const canonicalRequest =
    `${method}\n${path}\n${canonicalQuery}\n` +
    `host:${host}\n\nhost\n${PAYLOAD_UNSIGNED}`;

  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${date}/${REGION}/${SERVICE}/aws4_request\n` +
    (await sha256Hex(enc.encode(canonicalRequest)));
  const signature = toHex(await hmac(await signingKey(account.secretKey, date, REGION), enc.encode(stringToSign)));

  return `${account.endpoint}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function headerAuth(account, key, method, extraHeaders) {
  const now = new Date();
  const amzDate = isoDate(now);
  const date = shortDate(now);
  const host = new URL(account.endpoint).host;
  const path = uriEncodePath(`/${account.bucket}/${key}`);
  const emptySha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const headers = {
    host,
    'x-amz-content-sha256': emptySha,
    'x-amz-date': amzDate,
    ...extraHeaders,
  };

  const sortedNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedNames.map((k) => `${k}:${headers[k]}\n`).join('');
  const signedHeaders = sortedNames.join(';');
  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${emptySha}`;

  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${date}/${REGION}/${SERVICE}/aws4_request\n` +
    (await sha256Hex(enc.encode(canonicalRequest)));
  const signature = toHex(await hmac(await signingKey(account.secretKey, date, REGION), enc.encode(stringToSign)));

  return {
    url: `${account.endpoint}${path}`,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${account.accessKey}/${date}/${REGION}/${SERVICE}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/** Server-side copy (no data through the function). Resolves on success, throws on failure. */
export async function s3Copy(account, fromKey, toKey) {
  const source = `/${account.bucket}/${encodeURIComponent(fromKey).replace(/%2F/g, '/')}`;
  const signed = await headerAuth(account, toKey, 'PUT', {
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
  const url = await presignedUrl(account, key, 'DELETE', 60);
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    await res.text().catch(() => {});
    const err = new Error(`DELETE_FAILED:${res.status}`);
    err.code = 'DELETE_FAILED';
    err.status = res.status;
    throw err;
  }
}