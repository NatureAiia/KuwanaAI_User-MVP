/**
 * One-time interactive login — run manually, not part of the scan pipeline:
 *
 *   npx tsx scripts/social-scan/telegram-login.ts
 *
 * Logs in as your own Telegram account (phone number + the code Telegram
 * sends you, same as opening the app on a new device) and prints a session
 * string. Paste that into .env as TELEGRAM_SESSION — after that, the
 * scanner in telegram.ts runs unattended and never needs this again.
 *
 * Requires TELEGRAM_API_ID and TELEGRAM_API_HASH already set in .env
 * (see telegram.ts's printSetupInstructions for how to get those, free,
 * from https://my.telegram.org).
 */
import "dotenv/config";
import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions";
import readline from "node:readline/promises";

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

async function main() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  if (!apiId || !apiHash) {
    console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first — see telegram.ts for how.");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 3 });

  await client.start({
    phoneNumber: async () => prompt("Phone number (with country code, e.g. +263...): "),
    password: async () => prompt("2FA password (leave blank if none): "),
    phoneCode: async () => prompt("Code Telegram just sent you: "),
    onError: (err) => console.error(err),
  });

  console.log("\nLogged in. Add this to .env as TELEGRAM_SESSION:\n");
  console.log(client.session.save());
  console.log("\nThis string is equivalent to a login session for your account — keep .env private.");

  await client.disconnect();
}

main();
