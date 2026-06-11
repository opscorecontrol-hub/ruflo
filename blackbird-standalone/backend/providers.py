"""LLM provider abstraction — each provider exposes complete(messages, model) -> str."""
import os
import json


class ProviderError(Exception):
    pass


async def _anthropic_complete(messages, model, system=None, settings=None):
    try:
        import anthropic
    except ImportError:
        raise ProviderError("anthropic package not installed")
    key = (settings or {}).get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY', '')
    if not key:
        raise ProviderError("Anthropic API key not configured")
    client = anthropic.AsyncAnthropic(api_key=key)
    kwargs = dict(model=model, max_tokens=8096, messages=messages)
    if system:
        kwargs['system'] = system
    resp = await client.messages.create(**kwargs)
    return resp.content[0].text


async def _openai_complete(messages, model, system=None, settings=None, base_url=None):
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ProviderError("openai package not installed")
    key = (settings or {}).get('openai_api_key') or os.getenv('OPENAI_API_KEY', 'sk-placeholder')
    url = base_url or (settings or {}).get('openai_base_url') or None
    client = AsyncOpenAI(api_key=key, base_url=url) if url else AsyncOpenAI(api_key=key)
    msgs = ([{'role': 'system', 'content': system}] if system else []) + messages
    resp = await client.chat.completions.create(model=model, messages=msgs, max_tokens=8096)
    return resp.choices[0].message.content


async def _gemini_complete(messages, model, system=None, settings=None):
    try:
        import google.generativeai as genai
    except ImportError:
        raise ProviderError("google-generativeai package not installed")
    key = (settings or {}).get('google_api_key') or os.getenv('GOOGLE_API_KEY', '')
    if not key:
        raise ProviderError("Google API key not configured")
    genai.configure(api_key=key)
    gm = genai.GenerativeModel(
        model_name=model,
        system_instruction=system or 'You are a helpful AI software engineer.'
    )
    # Convert messages to Gemini format
    hist = []
    for m in messages[:-1]:
        hist.append({'role': 'user' if m['role'] == 'user' else 'model', 'parts': [m['content']]})
    last = messages[-1]['content'] if messages else ''
    chat = gm.start_chat(history=hist)
    resp = await chat.send_message_async(last)
    return resp.text


async def _mistral_complete(messages, model, system=None, settings=None):
    try:
        from mistralai import Mistral
    except ImportError:
        raise ProviderError("mistralai package not installed")
    key = (settings or {}).get('mistral_api_key') or os.getenv('MISTRAL_API_KEY', '')
    if not key:
        raise ProviderError("Mistral API key not configured")
    client = Mistral(api_key=key)
    msgs = ([{'role': 'system', 'content': system}] if system else []) + messages
    resp = await client.chat.complete_async(model=model, messages=msgs)
    return resp.choices[0].message.content


async def _groq_complete(messages, model, system=None, settings=None):
    try:
        from groq import AsyncGroq
    except ImportError:
        raise ProviderError("groq package not installed")
    key = (settings or {}).get('groq_api_key') or os.getenv('GROQ_API_KEY', '')
    if not key:
        raise ProviderError("Groq API key not configured")
    client = AsyncGroq(api_key=key)
    msgs = ([{'role': 'system', 'content': system}] if system else []) + messages
    resp = await client.chat.completions.create(model=model, messages=msgs, max_tokens=8096)
    return resp.choices[0].message.content


async def _ollama_complete(messages, model, system=None, settings=None):
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ProviderError("openai package not installed (used as Ollama client)")
    base_url = (settings or {}).get('ollama_endpoint') or os.getenv('OLLAMA_ENDPOINT', 'http://localhost:11434/v1')
    client = AsyncOpenAI(api_key='ollama', base_url=base_url)
    msgs = ([{'role': 'system', 'content': system}] if system else []) + messages
    resp = await client.chat.completions.create(model=model, messages=msgs)
    return resp.choices[0].message.content


# Provider routing table  {provider_name: (fn, default_model)}
PROVIDERS = {
    'claude':   (_anthropic_complete, 'claude-sonnet-4-6'),
    'openai':   (_openai_complete,    'gpt-4o-mini'),
    'gemini':   (_gemini_complete,    'gemini-1.5-flash'),
    'mistral':  (_mistral_complete,   'mistral-small-latest'),
    'groq':     (_groq_complete,      'llama-3.3-70b-versatile'),
    'ollama':   (_ollama_complete,    'llama3.2'),
}

PROVIDER_MODELS = {
    'claude':  ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
    'openai':  ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    'gemini':  ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    'mistral': ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
    'groq':    ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    'ollama':  ['llama3.2', 'codellama', 'deepseek-coder', 'mistral', 'phi3'],
}


def parse_model_string(model_str: str) -> tuple[str, str]:
    """'claude/claude-opus-4' → ('claude', 'claude-opus-4')"""
    if '/' in model_str:
        parts = model_str.split('/', 1)
        return parts[0], parts[1]
    # Try to infer provider from model name
    if 'claude' in model_str.lower():
        return 'claude', model_str
    if 'gpt' in model_str.lower() or 'o1' in model_str.lower():
        return 'openai', model_str
    if 'gemini' in model_str.lower():
        return 'gemini', model_str
    if 'mistral' in model_str.lower() or 'mixtral' in model_str.lower():
        return 'mistral', model_str
    if 'llama' in model_str.lower() or 'groq' in model_str.lower():
        return 'groq', model_str
    return 'ollama', model_str


async def complete(messages: list, model_str: str, system: str = None, settings: dict = None) -> str:
    provider_name, model_name = parse_model_string(model_str)
    if provider_name not in PROVIDERS:
        raise ProviderError(f"Unknown provider: {provider_name}")
    fn, _ = PROVIDERS[provider_name]
    return await fn(messages, model_name, system=system, settings=settings)
