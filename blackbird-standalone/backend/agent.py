"""Core agent loop: plan → research → code → save files."""
import asyncio
import json
import logging
import os
import re
import time
from typing import Callable, Awaitable
from nanoid import generate as nanoid

import db
import providers
import search as search_mod

logger = logging.getLogger(__name__)

PLAN_SYSTEM = """You are an expert AI software engineer.
Given a project goal, create a concise step-by-step plan.
Return ONLY a valid JSON array. No markdown fences, no explanation outside the array.
Each step object must have exactly these keys:
  "id": short slug string (e.g. "step-1")
  "type": one of "research" | "code" | "analyze"
  "title": brief title (max 60 chars)
  "description": what to do in this step (1-2 sentences)
  "search_query": if type is "research", the search query; else null
"""

RESEARCH_SYSTEM = """You are an expert software engineer synthesising web research.
Given search results, extract only the information relevant to the task.
Be concise. Focus on code patterns, APIs, best practices, and version-specific notes.
"""

CODE_SYSTEM = """You are an expert software engineer who writes clean, working code.
Return ONLY valid JSON (no markdown fences). The JSON must have:
  "explanation": string — one paragraph explaining what you built
  "files": array of {"path": "relative/file/path", "content": "file contents as string"}
All file paths are relative to the project root. Write complete, runnable files.
"""

SUMMARY_SYSTEM = """You are a helpful AI assistant.
Summarise what was just built in 2-3 sentences. Be friendly and specific about what files were created.
"""

_running: dict[str, bool] = {}  # run_id -> True while running


def stop_run(run_id: str):
    _running[run_id] = False


async def run_agent(
    run_id: str,
    project_id: str,
    project_path: str,
    goal: str,
    model: str,
    search_provider: str,
    settings: dict,
    emit: Callable[[str, dict], Awaitable[None]],
):
    _running[run_id] = True
    os.makedirs(project_path, exist_ok=True)

    async def status(msg: str):
        await emit('status', {'message': msg, 'run_id': run_id})

    try:
        # ── 1. Plan ─────────────────────────────────────────────────────
        await status('Thinking about your goal…')
        plan = await _make_plan(goal, model, settings)
        await emit('plan', {'steps': plan, 'run_id': run_id})

        # Persist steps
        for i, step in enumerate(plan):
            sid = f"{run_id}-s{i}"
            step['_db_id'] = sid
            await db.create_step(sid, run_id, i, step['type'], step['title'])

        # ── 2. Execute steps ────────────────────────────────────────────
        research_context: list[str] = []
        created_files: list[dict] = []

        for i, step in enumerate(plan):
            if not _running.get(run_id):
                await emit('stopped', {'run_id': run_id})
                await db.update_run_status(run_id, 'stopped')
                return

            sid = step['_db_id']
            await db.update_step(sid, 'running')
            await emit('step_status', {'id': sid, 'step_id': step['id'], 'status': 'running', 'title': step['title']})

            try:
                if step['type'] == 'research':
                    result = await _do_research(step, search_provider, settings, model, goal)
                    research_context.append(f"## {step['title']}\n{result}")
                    await db.update_step(sid, 'done', {'summary': result[:500]})
                    await emit('step_status', {'id': sid, 'step_id': step['id'], 'status': 'done', 'result': result[:300]})

                elif step['type'] in ('code', 'analyze'):
                    files = await _do_code(step, goal, model, settings, research_context, created_files)
                    await _save_files(files, project_path)
                    created_files.extend(files)
                    for f in files:
                        await emit('file', {'path': f['path'], 'content': f['content'][:2000], 'operation': 'create'})
                    await db.update_step(sid, 'done', {'files': [f['path'] for f in files]})
                    await emit('step_status', {
                        'id': sid, 'step_id': step['id'], 'status': 'done',
                        'result': f"Created: {', '.join(f['path'] for f in files)}" if files else 'Done'
                    })

            except Exception as e:
                logger.error("run %s step %s error: %s", run_id, sid, e)
                await db.update_step(sid, 'error', {'error': str(e)})
                await emit('step_status', {'id': sid, 'step_id': step['id'], 'status': 'error', 'result': str(e)})
                # Non-fatal — continue with remaining steps

        # ── 3. Summary ──────────────────────────────────────────────────
        await status('Wrapping up…')
        summary = await _make_summary(goal, created_files, model, settings)
        await db.update_run_status(run_id, 'done')
        await emit('done', {
            'run_id': run_id,
            'summary': summary,
            'files': [f['path'] for f in created_files],
        })

    except providers.ProviderError as e:
        logger.error("run %s provider error: %s", run_id, e)
        await db.update_run_status(run_id, 'error')
        await emit('error', {'message': f"Provider error: {e}", 'run_id': run_id})
    except Exception as e:
        logger.exception("run %s unexpected error", run_id)
        await db.update_run_status(run_id, 'error')
        await emit('error', {'message': str(e), 'run_id': run_id})
    finally:
        _running.pop(run_id, None)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _make_plan(goal: str, model: str, settings: dict) -> list[dict]:
    messages = [{'role': 'user', 'content': f"Project goal: {goal}\n\nCreate a detailed plan."}]
    raw = await providers.complete(messages, model, system=PLAN_SYSTEM, settings=settings)
    return _parse_json_array(raw)


async def _do_research(step: dict, search_provider: str, settings: dict, model: str, goal: str) -> str:
    query = step.get('search_query') or f"{goal} {step['title']}"
    api_key = ''
    if search_provider == 'bing':
        api_key = settings.get('bing_api_key', '')
    results = await search_mod.search_and_scrape(query, provider=search_provider, api_key=api_key)

    # Summarise with LLM
    context = f"Task: {step['description']}\n\nSearch results:\n"
    for r in results:
        context += f"\n### {r['title']}\nURL: {r['url']}\nSnippet: {r['snippet']}\n"
        if r.get('content'):
            context += f"Content:\n{r['content'][:1500]}\n"

    messages = [{'role': 'user', 'content': context}]
    return await providers.complete(messages, model, system=RESEARCH_SYSTEM, settings=settings)


async def _do_code(
    step: dict,
    goal: str,
    model: str,
    settings: dict,
    research_context: list[str],
    created_files: list[dict],
) -> list[dict]:
    research_str = '\n\n'.join(research_context) if research_context else 'No research available.'
    files_str = '\n'.join(f"- {f['path']}" for f in created_files) or 'None yet.'

    prompt = f"""Project goal: {goal}

Current task: {step['title']}
Task description: {step['description']}

Research context:
{research_str}

Files already created:
{files_str}

Write the code for this task. Return valid JSON only."""

    messages = [{'role': 'user', 'content': prompt}]
    raw = await providers.complete(messages, model, system=CODE_SYSTEM, settings=settings)
    parsed = _parse_json_object(raw)
    return parsed.get('files', [])


async def _make_summary(goal: str, files: list[dict], model: str, settings: dict) -> str:
    files_list = '\n'.join(f"- {f['path']}" for f in files) or '(no files created)'
    messages = [{
        'role': 'user',
        'content': f"Goal was: {goal}\nFiles created:\n{files_list}\nSummarise what was built."
    }]
    return await providers.complete(messages, model, system=SUMMARY_SYSTEM, settings=settings)


async def _save_files(files: list[dict], project_path: str):
    for f in files:
        rel = f['path'].lstrip('/')
        abs_path = os.path.join(project_path, rel)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, 'w', encoding='utf-8') as fh:
            fh.write(f['content'])


def _parse_json_array(text: str) -> list:
    text = text.strip()
    # Strip markdown fences
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    # Find first [ ... ]
    start = text.find('[')
    end = text.rfind(']')
    if start == -1 or end == -1:
        raise ValueError(f"Could not find JSON array in:\n{text[:300]}")
    try:
        return json.loads(text[start:end+1])
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON parse error: {e}\nText: {text[start:end+1][:300]}")


def _parse_json_object(text: str) -> dict:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        return {'explanation': text, 'files': []}
    try:
        return json.loads(text[start:end+1])
    except json.JSONDecodeError:
        return {'explanation': text, 'files': []}
