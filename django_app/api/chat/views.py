import json
import re

from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.chat.client import DeepSeekError, chat_completion
from api.chat.schemas import TOOL_SCHEMAS, parse_tool_arguments
from api.chat.tools import TOOL_FUNCTIONS


SYSTEM_PROMPT = """You are CoralFuture's scientific data assistant.
Always answer in English with a formal, scientific, evidence-based tone.
Be concise and information-dense. Avoid filler, casual phrasing, marketing language, emojis, jokes, and unsupported interpretation.
Use Markdown consistently for structure, especially tables when comparing multiple records.
Never answer factual questions about CoralFuture data from memory or general knowledge.
Every factual claim about projects, colonies, ED5, ED50, ED95, countries, species, observations, locations, publications, bleaching surveys, bleaching severity, bleaching trends by year, or database statistics must be grounded in database tool output from this request.
For bleaching questions, use get_bleaching_overview, get_project_bleaching_analysis, get_project_bleaching_by_name, and/or search_bleaching_by_country.
When the user names a project and asks about bleaching, ALWAYS call get_project_bleaching_by_name or get_project_bleaching_analysis — never conclude that bleaching data are missing based only on get_project_summary.
get_project_summary includes bleachingSurveysNearProject, but always prefer get_project_bleaching_analysis for bleaching-only questions.
Bleaching surveys are stored in BleachingDataBase (GeoJSON), not in project/colony ORM tables. Regional colony labels (e.g. Persian Arabian Gulf) are mapped to survey countries (Bahrain, UAE, Oman, Iran, etc.).
When comparing project thermal data with bleaching, clearly distinguish CBASS/ED metrics from independent bleaching survey records in the same geographic region.
If the available tools do not provide enough evidence, state that the database query did not return sufficient information.
Do not invent, estimate, infer, interpolate, or complete missing data.
Use the database tools before answering any user request about the dataset.
If the tools return no rows, state that explicitly.
When relevant, include project links and map links from the tool results."""

DSML_TOOL_CALL_RE = re.compile(
    r'<\s*[^>]*tool_calls[^>]*>.*?<\s*/\s*[^>]*tool_calls\s*>',
    flags=re.IGNORECASE | re.DOTALL,
)
DSML_TAG_RE = re.compile(r'<\s*/?\s*[^>]*DSML[^>]*>', flags=re.IGNORECASE)
TOOL_MARKER_RE = re.compile(r'(tool_calls|<\s*[^>]*invoke\b|<\s*[^>]*parameter\b)', flags=re.IGNORECASE)


def _strip_internal_tool_markup(content):
    if not isinstance(content, str):
        return ''
    cleaned = DSML_TOOL_CALL_RE.sub('', content)
    cleaned = DSML_TAG_RE.sub('', cleaned)
    return cleaned.strip()


def _looks_like_internal_tool_markup(content):
    return bool(TOOL_MARKER_RE.search(content or ''))


def _clean_messages(messages):
    cleaned = []
    for message in messages[-12:]:
        role = message.get('role')
        content = message.get('content')
        if role not in {'user', 'assistant'} or not isinstance(content, str):
            continue
        content = _strip_internal_tool_markup(content)
        if not content or _looks_like_internal_tool_markup(content):
            continue
        cleaned.append({'role': role, 'content': content[:4000]})
    return cleaned


def _collect_links(value):
    if isinstance(value, dict):
        links = value.get('links') if isinstance(value.get('links'), list) else []
        nested = []
        for child in value.values():
            nested.extend(_collect_links(child))
        return links + nested
    if isinstance(value, list):
        collected = []
        for item in value:
            collected.extend(_collect_links(item))
        return collected
    return []


def _dedupe_links(links):
    result = []
    seen = set()
    for link in links:
        if not isinstance(link, dict):
            continue
        href = link.get('href')
        label = link.get('label')
        if not href or href in seen:
            continue
        seen.add(href)
        result.append({
            'label': label or href,
            'href': href,
            'type': link.get('type') or 'link',
        })
    return result[:12]


class ChatApiView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        messages = _clean_messages(request.data.get('messages') or [])
        if not messages or messages[-1]['role'] != 'user':
            return Response(
                {'error': 'A user message is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        conversation = [{'role': 'system', 'content': SYSTEM_PROMPT}] + messages
        tool_links = []

        try:
            first = chat_completion(conversation, tools=TOOL_SCHEMAS, tool_choice='required')
            tool_calls = first.get('tool_calls') or []

            if tool_calls:
                conversation.append(first)
                for call in tool_calls[:5]:
                    function = call.get('function') or {}
                    name = function.get('name')
                    tool = TOOL_FUNCTIONS.get(name)
                    args = parse_tool_arguments(function.get('arguments'))

                    if not tool:
                        result = {'error': f'Tool {name} is not available.'}
                    else:
                        try:
                            result = tool(**args)
                        except Http404:
                            result = {'error': 'Requested object was not found.'}
                        except Exception as exc:
                            result = {'error': str(exc)}

                    tool_links.extend(_collect_links(result))
                    conversation.append({
                        'role': 'tool',
                        'tool_call_id': call.get('id'),
                        'content': json.dumps(result, default=str),
                    })

                final = chat_completion(conversation)
                final_content = _strip_internal_tool_markup(final.get('content') or '')
                if _looks_like_internal_tool_markup(final.get('content') or '') or not final_content:
                    conversation.append({
                        'role': 'user',
                        'content': (
                            'Use the database tool results already provided above and write the final answer '
                            'for the user in normal Markdown. Do not output tool calls, XML, DSML, JSON, '
                            'or internal tool syntax.'
                        ),
                    })
                    final = chat_completion(conversation)
            else:
                final = {
                    'content': (
                        'I cannot answer this from model knowledge. '
                        'No database tool result was returned for this request.'
                    )
                }

        except DeepSeekError as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        message = _strip_internal_tool_markup(final.get('content') or '')
        if not message or _looks_like_internal_tool_markup(message):
            message = (
                'The assistant produced an internal tool-call draft instead of a final answer. '
                'Please retry the question.'
            )

        return Response({
            'message': message,
            'links': _dedupe_links(tool_links),
        })
