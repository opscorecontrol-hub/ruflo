import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { writeQueue, runQuery, getOne } from '../db/init.js';

export async function register(email, password, name) {
  const existing = getOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) throw new Error('Email already registered');

  const id = nanoid();
  const password_hash = await bcrypt.hash(password, 10);
  const created_at = Date.now();

  await writeQueue(() => {
    runQuery(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, email, password_hash, name || null, created_at]
    );
  });

  return { id, email, name: name || null };
}

export async function login(email, password) {
  const user = getOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');

  return user;
}

export function getById(id) {
  return getOne('SELECT id, email, name, created_at FROM users WHERE id = ?', [id]);
}
