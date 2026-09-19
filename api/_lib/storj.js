import { presignedUrl, s3Copy, s3Delete } from './sigv4.js';

const DEFAULT_ENDPOINT = 'https://gateway.storjshare.io';
export const KEY_PREFIX = '300kedits/';

export class NoStorageConfiguredError extends Error {
  constructor() {
    super('STORJ_NOT_CONFIGURED');
  }
}

export function readAccounts() {
  const accounts = [];
  for (let i = 1; i <= 4; i++) {
    const accessKey = process.env[`STORJ${i}_ACCESS_KEY`] ?? '';
    const secretKey = process.env[`STORJ${i}_SECRET_KEY`] ?? '';
    const bucket = (process.env[`STORJ${i}_BUCKET`] ?? '').trim();
    if (!accessKey || !secretKey || !bucket) continue;
    accounts.push({
      index: i,
      accessKey,
      secretKey,
      endpoint: process.env[`STORJ${i}_ENDPOINT`] ?? DEFAULT_ENDPOINT,
      bucket,
    });
  }
  return accounts;
}

export function getAccount(index) {
  if (!Number.isFinite(Number(index))) return null;
  const account = readAccounts().find((a) => a.index === Number(index));
  return account ?? null;
}

export function randomAccount() {
  const accounts = readAccounts();
  if (accounts.length === 0) return null;
  return accounts[Math.floor(Math.random() * accounts.length)];
}

export function objectKey(id, kind) {
  return `${KEY_PREFIX}${kind === 'poster' ? `pending/${id}/poster` : `pending/${id}/media`}`;
}

export function approvedKey(pendingKey) {
  return pendingKey.replace('pending/', 'approved/');
}

export function presignPut(account, key, contentType, expiresIn = 3600) {
  return presignedUrl(account, key, 'PUT', expiresIn);
}

export function presignGet(account, key, expiresIn = 3600) {
  return presignedUrl(account, key, 'GET', expiresIn);
}

export async function copyObject(account, fromKey, toKey) {
  await s3Copy(account, fromKey, toKey);
}

export async function deleteObjects(account, keys) {
  for (const key of keys) {
    if (!key) continue;
    try {
      await s3Delete(account, key);
    } catch {
      // best-effort cleanup
    }
  }
}