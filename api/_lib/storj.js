import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

function clientFor(account) {
  return new S3Client({
    region: 'auto',
    endpoint: account.endpoint,
    credentials: {
      accessKeyId: account.accessKey,
      secretAccessKey: account.secretKey,
    },
    maxAttempts: 1,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export function objectKey(id, kind) {
  return `${KEY_PREFIX}${kind === 'poster' ? `pending/${id}/poster` : `pending/${id}/media`}`;
}

export function approvedKey(pendingKey) {
  return pendingKey.replace('pending/', 'approved/');
}

export async function presignPut(account, key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: account.bucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  return getSignedUrl(clientFor(account), command, { expiresIn });
}

export async function presignGet(account, key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: account.bucket, Key: key });
  return getSignedUrl(clientFor(account), command, { expiresIn });
}

export async function copyObject(account, fromKey, toKey) {
  await clientFor(account).send(
    new CopyObjectCommand({
      Bucket: account.bucket,
      Key: toKey,
      CopySource: `${account.bucket}/${fromKey}`,
    }),
  );
}

export async function deleteObjects(account, keys) {
  for (const key of keys) {
    if (!key) continue;
    try {
      await clientFor(account).send(
        new DeleteObjectCommand({ Bucket: account.bucket, Key: key }),
      );
    } catch {
      // best-effort cleanup
    }
  }
}