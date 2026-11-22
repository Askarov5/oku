import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getEnv } from "./env";

let client: S3Client | null = null;

export const getR2Client = (): S3Client => {
  if (client) {
    return client;
  }
  const env = getEnv();
  client = new S3Client({
    region: "auto",
    endpoint: env.r2.endpoint,
    forcePathStyle: env.r2.forcePathStyle,
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
  });
  return client;
};

export const publicObjectUrl = (key: string): string => {
  const base = getEnv().r2.publicBaseUrl.replace(/\/$/, "");
  return `${base}/${key}`;
};

export const uploadObject = async (input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<string> => {
  const env = getEnv();
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
  return publicObjectUrl(input.key);
};
