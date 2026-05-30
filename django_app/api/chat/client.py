import requests
from django.conf import settings


class DeepSeekError(Exception):
    pass


def chat_completion(messages, tools=None, tool_choice='auto', timeout=45):
    if not settings.DEEPSEEK_API_KEY:
        raise DeepSeekError('DeepSeek API key is not configured.')

    payload = {
        'model': settings.DEEPSEEK_MODEL,
        'messages': messages,
        'temperature': 0.2,
    }
    if tools:
        payload['tools'] = tools
        payload['tool_choice'] = tool_choice

    response = requests.post(
        settings.DEEPSEEK_API_URL,
        headers={
            'Authorization': f'Bearer {settings.DEEPSEEK_API_KEY}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=timeout,
    )
    if response.status_code >= 400:
        raise DeepSeekError(response.text[:500] or f'DeepSeek returned {response.status_code}.')

    data = response.json()
    try:
        return data['choices'][0]['message']
    except (KeyError, IndexError, TypeError) as exc:
        raise DeepSeekError('DeepSeek returned an unexpected response.') from exc
