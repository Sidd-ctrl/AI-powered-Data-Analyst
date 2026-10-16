import os, asyncio, json
import httpx
from fastapi import HTTPException
async def complete(messages, structured=False):
    key=os.getenv('OPENROUTER_API_KEY')
    if not key: raise HTTPException(503, 'OpenRouter is not configured. Use a supported local analysis or add an API key.')
    payload={'model':os.getenv('OPENROUTER_MODEL','openai/gpt-4o-mini'), 'messages':messages, 'max_tokens':1200, 'temperature':0}
    if structured: payload['response_format']={'type':'json_object'}
    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in range(3):
            try:
                r=await client.post(os.getenv('OPENROUTER_BASE_URL','https://openrouter.ai/api/v1').rstrip('/')+'/chat/completions', headers={'Authorization':f'Bearer {key}'}, json=payload)
                if r.status_code in (429,500,502,503) and attempt<2:
                    await asyncio.sleep(2**attempt); continue
                if r.status_code>=400: raise HTTPException(502, f'AI provider unavailable (HTTP {r.status_code}). Check model, credentials or rate limits.')
                text=r.json()['choices'][0]['message']['content']
                return json.loads(text) if structured else text
            except (httpx.HTTPError, ValueError, KeyError, IndexError):
                if attempt==2: raise HTTPException(502,'AI provider timed out or returned an invalid response.')
                await asyncio.sleep(2**attempt)
