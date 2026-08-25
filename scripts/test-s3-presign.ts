import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function main() {
  console.log({
    hasBucket: !!process.env.S3_BUCKET,
    hasEndpoint: !!process.env.S3_ENDPOINT,
    hasKey: !!process.env.S3_ACCESS_KEY_ID,
    hasPublic: !!process.env.S3_PUBLIC_BASE_URL,
  });
  if (!process.env.S3_BUCKET) {
    console.log("NO_BUCKET");
    return;
  }
  const client = new S3Client({
    region: process.env.S3_REGION || "ap-northeast-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: "disputes/test/test.mov",
    ContentType: "video/quicktime",
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  console.log({
    uploadHost: new URL(uploadUrl).host,
    pathStart: new URL(uploadUrl).pathname.slice(0, 60),
  });

  // CORS-like probe: OPTIONS won't work from node; try PUT tiny body
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/quicktime" },
    body: Buffer.from("test"),
  });
  console.log({ putStatus: put.status, putText: (await put.text()).slice(0, 200) });
}

main().catch((e) => console.error("ERR", e));
