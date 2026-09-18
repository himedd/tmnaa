import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { logger } from "./logger";

/**
 * Storj storage layer (S3-compatible). Up to 4 accounts configured in .env.
 * Uploads pick a random account first; on any error the next account is tried
 * immediately (failover). Reads always use the account recorded with the row.
 */

export interface StorjAccount {
  index: number;
  name: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
  bucket: string;
}

const FALLBACK_BUCKET = (process.env["STORJ_BUCKET"] ?? "").trim();

function readAccount(index: number): StorjAccount | null {
  const prefix = `STORJ${index}_`;
  const accessKey = process.env[`${prefix}ACCESS_KEY`] ?? "";
  const secretKey = process.env[`${prefix}SECRET_KEY`] ?? "";
  const endpoint = process.env[`${prefix}ENDPOINT`] ?? "";
  const bucket = (process.env[`${prefix}BUCKET`] ?? "").trim();
  if (!accessKey || !secretKey || !endpoint) return null;
  return {
    index,
    name: `storj-${index}`,
    accessKey,
    secretKey,
    endpoint,
    bucket: bucket || FALLBACK_BUCKET,
  };
}

export function listAccounts(): StorjAccount[] {
  const accounts: StorjAccount[] = [];
  for (let i = 1; i <= 4; i++) {
    const account = readAccount(i);
    if (account) accounts.push(account);
  }
  return accounts;
}

export function getAccount(index: number): StorjAccount | null {
  if (index < 1 || index > 4) return null;
  const account = readAccount(index);
  if (!account || !account.bucket) return null;
  return account;
}

let clients = new Map<number, S3Client>();

function clientFor(account: StorjAccount): S3Client {
  let client = clients.get(account.index);
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: account.endpoint,
      credentials: {
        accessKeyId: account.accessKey,
        secretAccessKey: account.secretKey,
      },
      maxAttempts: 1,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    clients.set(account.index, client);
  }
  return client;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface StoredObject {
  provider: number;
  bucket: string;
  key: string;
}

const KEY_PREFIX = "300kedits/";

export async function uploadMedia(
  buffer: Buffer,
  mime: string,
  objectKey: string,
): Promise<StoredObject> {
  const accounts = listAccounts().filter((a) => a.bucket);
  if (accounts.length === 0) {
    throw new Error("STORJ_NOT_CONFIGURED");
  }
  const key = `${KEY_PREFIX}${objectKey}`;
  const order = shuffle(accounts);
  const failures: string[] = [];
  for (const account of order) {
    try {
      const command = new PutObjectCommand({
        Bucket: account.bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
      });
      await clientFor(account).send(command);
      logger.info(
        { provider: account.index, bucket: account.bucket, key, bytes: buffer.length },
        "media uploaded to storj",
      );
      return { provider: account.index, bucket: account.bucket, key };
    } catch (err) {
      failures.push(`${account.name}: ${(err as Error).message}`);
      logger.warn({ err, account: account.name }, "storj upload attempt failed");
    }
  }
  throw new Error(`STORJ_UPLOAD_FAILED [${failures.join(" | ")}]`);
}

export interface MediaObject {
  stream: Readable | Blob;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
}

export async function downloadMedia(
  stored: StoredObject,
  rangeHeader?: string,
): Promise<MediaObject | null> {
  const account = getAccount(stored.provider);
  if (!account || !stored.bucket || !stored.key) {
    logger.warn({ stored }, "storj account/bucket unavailable for read");
    return null;
  }
  try {
    const input: Record<string, unknown> = {
      Bucket: stored.bucket,
      Key: stored.key,
    };
    if (rangeHeader) input.Range = rangeHeader;
    const res = await clientFor(account).send(
      new GetObjectCommand(input as never),
    );
    return {
      stream: res.Body as Readable | Blob,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
      contentRange: res.ContentRange,
      acceptRanges: res.AcceptRanges,
    };
  } catch (err) {
    logger.warn(
      { err, provider: stored.provider, key: stored.key },
      "storj read failed",
    );
    return null;
  }
}

export async function deleteMedia(stored: {
  provider: number | null;
  bucket: string | null;
  key: string | null;
}): Promise<void> {
  if (!stored.provider || !stored.bucket || !stored.key) return;
  const account = getAccount(stored.provider);
  if (!account) return;
  try {
    await clientFor(account).send(
      new DeleteObjectCommand({ Bucket: stored.bucket, Key: stored.key }),
    );
    logger.info(
      { provider: stored.provider, key: stored.key },
      "media deleted from storj",
    );
  } catch (err) {
    logger.warn({ err }, "storj delete failed (ignored)");
  }
}