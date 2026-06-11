"""Web search + scraping for the research step."""
import asyncio
import httpx
from bs4 import BeautifulSoup


async def ddg_search(query: str, max_results: int = 5) -> list[dict]:
    """DuckDuckGo search — no API key required."""
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    'title': r.get('title', ''),
                    'url': r.get('href', ''),
                    'snippet': r.get('body', ''),
                })
        return results
    except Exception as e:
        return [{'title': 'Search unavailable', 'url': '', 'snippet': str(e)}]


async def bing_search(query: str, api_key: str, max_results: int = 5) -> list[dict]:
    """Bing Web Search API."""
    url = 'https://api.bing.microsoft.com/v7.0/search'
    headers = {'Ocp-Apim-Subscription-Key': api_key}
    params = {'q': query, 'count': max_results, 'textFormat': 'Raw'}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()
        results = []
        for item in data.get('webPages', {}).get('value', []):
            results.append({
                'title': item.get('name', ''),
                'url': item.get('url', ''),
                'snippet': item.get('snippet', ''),
            })
        return results


async def scrape_url(url: str, max_chars: int = 4000) -> str:
    """Fetch and extract main text from a URL."""
    if not url:
        return ''
    try:
        async with httpx.AsyncClient(
            timeout=8,
            follow_redirects=True,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; Blackbird2030/1.0)'}
        ) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, 'html.parser')
            # Remove script/style/nav
            for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                tag.decompose()
            text = soup.get_text(separator='\n', strip=True)
            # Collapse blank lines
            lines = [l for l in text.splitlines() if l.strip()]
            return '\n'.join(lines)[:max_chars]
    except Exception:
        return ''


async def search_and_scrape(
    query: str,
    provider: str = 'ddg',
    api_key: str = '',
    num_results: int = 3,
    scrape_top: int = 2,
) -> list[dict]:
    """Run search then scrape the top N results. Returns enriched result list."""
    if provider == 'bing' and api_key:
        results = await bing_search(query, api_key, max_results=num_results)
    else:
        results = await ddg_search(query, max_results=num_results)

    # Scrape top N in parallel
    urls = [r['url'] for r in results[:scrape_top] if r['url']]
    contents = await asyncio.gather(*[scrape_url(url) for url in urls])

    for i, content in enumerate(contents):
        results[i]['content'] = content

    return results
