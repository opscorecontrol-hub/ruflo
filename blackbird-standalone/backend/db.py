import aiosqlite
import time
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'blackbird2030.db')

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  step_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
"""

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        for stmt in CREATE_SQL.strip().split(';'):
            stmt = stmt.strip()
            if stmt:
                await db.execute(stmt)
        await db.commit()

async def get_projects():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute('SELECT * FROM projects ORDER BY updated_at DESC') as cur:
            return [dict(r) for r in await cur.fetchall()]

async def create_project(id, name, description, path):
    now = int(time.time() * 1000)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            'INSERT INTO projects (id, name, description, path, created_at, updated_at) VALUES (?,?,?,?,?,?)',
            [id, name, description, path, now, now]
        )
        await db.commit()
    return {'id': id, 'name': name, 'description': description, 'path': path, 'created_at': now, 'updated_at': now}

async def delete_project(project_id):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('DELETE FROM messages WHERE project_id = ?', [project_id])
        await db.execute('DELETE FROM agent_runs WHERE project_id = ?', [project_id])
        await db.execute('DELETE FROM projects WHERE id = ?', [project_id])
        await db.commit()

async def get_messages(project_id):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            'SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC', [project_id]
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]

async def add_message(id, project_id, role, content):
    now = int(time.time() * 1000)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            'INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?,?,?,?,?)',
            [id, project_id, role, content, now]
        )
        # Update project updated_at
        await db.execute('UPDATE projects SET updated_at = ? WHERE id = ?', [now, project_id])
        await db.commit()
    return {'id': id, 'project_id': project_id, 'role': role, 'content': content, 'created_at': now}

async def get_settings():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute('SELECT key, value FROM settings') as cur:
            rows = await cur.fetchall()
            return {r['key']: r['value'] for r in rows}

async def set_settings(kv: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        for k, v in kv.items():
            await db.execute(
                'INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                [k, str(v)]
            )
        await db.commit()

async def create_run(id, project_id, goal, model):
    now = int(time.time() * 1000)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            'INSERT INTO agent_runs (id, project_id, goal, model, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
            [id, project_id, goal, model, 'running', now, now]
        )
        await db.commit()

async def update_run_status(run_id, status):
    now = int(time.time() * 1000)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('UPDATE agent_runs SET status=?, updated_at=? WHERE id=?', [status, now, run_id])
        await db.commit()

async def create_step(id, run_id, order, step_type, title):
    now = int(time.time() * 1000)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            'INSERT INTO agent_steps (id, run_id, step_order, step_type, title, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
            [id, run_id, order, step_type, title, 'pending', now, now]
        )
        await db.commit()

async def update_step(step_id, status, result=None):
    now = int(time.time() * 1000)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            'UPDATE agent_steps SET status=?, result=?, updated_at=? WHERE id=?',
            [status, json.dumps(result) if result is not None else None, now, step_id]
        )
        await db.commit()

async def get_run_steps(run_id):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            'SELECT * FROM agent_steps WHERE run_id = ? ORDER BY step_order ASC', [run_id]
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]
