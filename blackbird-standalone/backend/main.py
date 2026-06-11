import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from nanoid import generate as nanoid

import db
import agent as agent_mod
import providers as prov_mod

PROJECTS_ROOT = os.path.join(os.path.expanduser('~'), 'blackbird2030-projects')
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(PROJECTS_ROOT, exist_ok=True)
    await db.init_db()
    yield


app = FastAPI(title='Blackbird 2030', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

# WebSocket connection manager  {project_id: Set[WebSocket]}
_ws_conns: dict[str, Set[WebSocket]] = {}


async def broadcast(project_id: str, event_type: str, data: dict):
    sockets = list(_ws_conns.get(project_id, set()))
    payload = json.dumps({'type': event_type, **data})
    dead = []
    for ws in sockets:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_conns.get(project_id, set()).discard(ws)


# ── REST routes ──────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str = ''

class MessageCreate(BaseModel):
    content: str
    role: str = 'user'

class RunCreate(BaseModel):
    goal: str
    model: str = 'claude/claude-sonnet-4-6'
    search_provider: str = 'ddg'

class SettingsUpdate(BaseModel):
    settings: dict


@app.get('/api/providers')
async def list_providers():
    return {
        'providers': list(prov_mod.PROVIDERS.keys()),
        'models': prov_mod.PROVIDER_MODELS,
    }


@app.get('/api/projects')
async def list_projects():
    return await db.get_projects()


@app.post('/api/projects', status_code=201)
async def create_project(body: ProjectCreate):
    id = nanoid(size=10)
    path = os.path.join(PROJECTS_ROOT, id)
    os.makedirs(path, exist_ok=True)
    return await db.create_project(id, body.name, body.description, path)


@app.delete('/api/projects/{project_id}')
async def delete_project(project_id: str):
    await db.delete_project(project_id)
    return {'ok': True}


@app.get('/api/projects/{project_id}/messages')
async def get_messages(project_id: str):
    return await db.get_messages(project_id)


@app.post('/api/projects/{project_id}/messages', status_code=201)
async def post_message(project_id: str, body: MessageCreate):
    msg = await db.add_message(nanoid(size=10), project_id, body.role, body.content)
    return msg


@app.get('/api/projects/{project_id}/files')
async def list_files(project_id: str):
    """Walk the project directory and return relative file paths."""
    projects = await db.get_projects()
    project = next((p for p in projects if p['id'] == project_id), None)
    if not project:
        raise HTTPException(404, 'Project not found')
    root = project['path']
    if not os.path.isdir(root):
        return []
    files = []
    for dirpath, _, filenames in os.walk(root):
        for fname in filenames:
            abs_path = os.path.join(dirpath, fname)
            rel = os.path.relpath(abs_path, root)
            files.append({'path': rel, 'size': os.path.getsize(abs_path)})
    return sorted(files, key=lambda f: f['path'])


@app.get('/api/projects/{project_id}/files/content')
async def get_file_content(project_id: str, path: str):
    projects = await db.get_projects()
    project = next((p for p in projects if p['id'] == project_id), None)
    if not project:
        raise HTTPException(404)
    abs_path = os.path.realpath(os.path.join(project['path'], path.lstrip('/')))
    # Safety: ensure path stays within project dir
    if not abs_path.startswith(os.path.realpath(project['path'])):
        raise HTTPException(403, 'Path traversal not allowed')
    if not os.path.isfile(abs_path):
        raise HTTPException(404, 'File not found')
    with open(abs_path, 'r', encoding='utf-8', errors='replace') as f:
        return {'path': path, 'content': f.read()}


@app.post('/api/projects/{project_id}/run', status_code=202)
async def start_run(project_id: str, body: RunCreate):
    projects = await db.get_projects()
    project = next((p for p in projects if p['id'] == project_id), None)
    if not project:
        raise HTTPException(404, 'Project not found')

    run_id = nanoid(size=12)
    settings = await db.get_settings()

    await db.create_run(run_id, project_id, body.goal, body.model)

    async def emit(event_type, data):
        await broadcast(project_id, event_type, data)

    asyncio.create_task(agent_mod.run_agent(
        run_id=run_id,
        project_id=project_id,
        project_path=project['path'],
        goal=body.goal,
        model=body.model,
        search_provider=body.search_provider,
        settings=settings,
        emit=emit,
    ))

    return {'run_id': run_id, 'status': 'started'}


@app.post('/api/runs/{run_id}/stop')
async def stop_run(run_id: str):
    agent_mod.stop_run(run_id)
    return {'ok': True}


@app.get('/api/settings')
async def get_settings():
    s = await db.get_settings()
    # Mask key values
    return {k: ('*' * 8 if k.endswith('_key') and v else v) for k, v in s.items()}


@app.post('/api/settings')
async def save_settings(body: SettingsUpdate):
    # Don't overwrite masked values
    filtered = {k: v for k, v in body.settings.items() if v and not set(v) <= {'*'}}
    await db.set_settings(filtered)
    return {'ok': True}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket('/ws/{project_id}')
async def ws_endpoint(websocket: WebSocket, project_id: str):
    await websocket.accept()
    _ws_conns.setdefault(project_id, set()).add(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping
    except WebSocketDisconnect:
        _ws_conns.get(project_id, set()).discard(websocket)


# ── SPA fallback ──────────────────────────────────────────────────────────────

if os.path.isdir(FRONTEND_DIST):
    app.mount('/assets', StaticFiles(directory=os.path.join(FRONTEND_DIST, 'assets')), name='assets')

    @app.get('/{full_path:path}', include_in_schema=False)
    async def spa(full_path: str):
        index = os.path.join(FRONTEND_DIST, 'index.html')
        return FileResponse(index)


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=7799, reload=True)
