import { releaseExpiredPendingCheckouts } from "../src/services/checkout";

async function main() {
  const released = await releaseExpiredPendingCheckouts();
  console.log("released", released.length, released);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
