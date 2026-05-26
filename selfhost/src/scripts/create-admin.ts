import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { exec, pool, query } from "../db.js";

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = args[1] ?? process.env.ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    console.error("Usage: npm run create-admin -- <email> <password>");
    console.error("   or: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin");
    process.exit(2);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Invalid email");
    process.exit(2);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(2);
  }

  const hash = await bcrypt.hash(password, 12);
  const existing = await query<{ id: string }>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  let userId: string;
  if (existing[0]) {
    userId = existing[0].id;
    await exec("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
    console.log(`Reset password for existing user: ${email}`);
  } else {
    userId = uuid();
    await exec(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      [userId, email, hash],
    );
    console.log(`Created user: ${email}`);
  }

  await exec(
    `INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin')
     ON DUPLICATE KEY UPDATE role = role`,
    [uuid(), userId],
  );
  console.log(`Ensured admin role for ${email}`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
