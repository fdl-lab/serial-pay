import { NextResponse } from "next/server";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertAdmin(req: Request) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ADMIN_API_SECRET unset" }, { status: 503 });
  }
  const got = req.headers.get("x-admin-secret") || "";
  if (got !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const denied = assertAdmin(req);
  if (denied) return denied;

  const bucket = process.env.S3_BUCKET || "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "";
  const endpoint = process.env.S3_ENDPOINT || "";
  const region = process.env.S3_REGION || "ap-northeast-1";
  const publicBase = process.env.S3_PUBLIC_BASE_URL || "";

  const configured = Boolean(bucket && accessKeyId && secretAccessKey);
  const info = {
    configured,
    bucketLen: bucket.length,
    keyLen: accessKeyId.length,
    secretLen: secretAccessKey.length,
    region,
    hasEndpoint: Boolean(endpoint),
    endpointHost: (() => {
      try {
        return endpoint ? new URL(endpoint).host : null;
      } catch {
        return "invalid";
      }
    })(),
    hasPublicBase: Boolean(publicBase),
    vercel: Boolean(process.env.VERCEL),
  };

  if (!configured) {
    return NextResponse.json({ ok: false, step: "config", ...info });
  }

  const key = `disputes/_health/${Date.now()}.txt`;
  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from("ok"),
        ContentType: "text/plain",
      }),
    );
    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await got.Body?.transformToString();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
    return NextResponse.json({
      ok: body === "ok",
      step: "roundtrip",
      ...info,
    });
  } catch (e) {
    const err = e as { name?: string; message?: string; Code?: string };
    return NextResponse.json(
      {
        ok: false,
        step: "s3",
        errorName: err.name || err.Code || "Error",
        errorMessage: (err.message || "").slice(0, 200),
        ...info,
      },
      { status: 500 },
    );
  }
}
