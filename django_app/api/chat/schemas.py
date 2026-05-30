import json


TOOL_SCHEMAS = [
    {
        'type': 'function',
        'function': {
            'name': 'find_ed_extreme',
            'description': 'Find colonies with the lowest or highest ED5, ED50, or ED95 values.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'metric': {
                        'type': 'string',
                        'enum': ['ed5', 'ed50', 'ed95'],
                        'description': 'ED metric to inspect.',
                    },
                    'direction': {
                        'type': 'string',
                        'enum': ['lowest', 'highest'],
                        'description': 'Whether to return the lowest or highest values.',
                    },
                    'relative': {
                        'type': 'boolean',
                        'description': 'Use relative ED values instead of absolute values.',
                    },
                    'limit': {
                        'type': 'integer',
                        'minimum': 1,
                        'maximum': 10,
                        'description': 'Maximum number of rows to return.',
                    },
                },
                'required': ['metric', 'direction'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'search_projects',
            'description': 'Search research projects by name, description, owner, publication, species, or country.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'query': {'type': 'string'},
                    'limit': {'type': 'integer', 'minimum': 1, 'maximum': 10},
                },
                'required': ['query'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'search_colonies',
            'description': 'Search coral colonies by name, species, country, and linked project data.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'query': {'type': 'string'},
                    'species': {'type': 'string'},
                    'country': {'type': 'string'},
                    'limit': {'type': 'integer', 'minimum': 1, 'maximum': 10},
                },
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_project_summary',
            'description': 'Get a compact project summary with colonies, publications, and links.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'project_id': {'type': 'integer'},
                },
                'required': ['project_id'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_database_overview',
            'description': 'Get high-level counts and top countries/species in the database.',
            'parameters': {
                'type': 'object',
                'properties': {},
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_bleaching_overview',
            'description': (
                'Get global bleaching survey statistics: available years, total observation counts, '
                'and severity breakdown by year across the full BleachingDataBase dataset.'
            ),
            'parameters': {
                'type': 'object',
                'properties': {},
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_project_bleaching_analysis',
            'description': (
                'REQUIRED for bleaching questions about a specific project. Loads independent BleachingDataBase '
                'survey records near the project (bounding box + country/region mapping). Returns year-by-year '
                'counts, severity breakdown, and ED50 summary. Project colonies are not bleaching-linked in ORM; '
                'this tool searches the full bleaching table spatially and by country.'
            ),
            'parameters': {
                'type': 'object',
                'properties': {
                    'project_id': {
                        'type': 'integer',
                        'description': 'CoralFuture project ID.',
                    },
                },
                'required': ['project_id'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'get_project_bleaching_by_name',
            'description': (
                'Bleaching analysis for a project by name (partial match), e.g. GloSea_PAG. '
                'Same output as get_project_bleaching_analysis.'
            ),
            'parameters': {
                'type': 'object',
                'properties': {
                    'project_name': {'type': 'string'},
                },
                'required': ['project_name'],
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'search_bleaching_by_country',
            'description': (
                'Bleaching survey statistics for a country (exact name match, e.g. Australia, Indonesia).'
            ),
            'parameters': {
                'type': 'object',
                'properties': {
                    'country': {'type': 'string'},
                },
                'required': ['country'],
            },
        },
    },
]


def parse_tool_arguments(arguments):
    if isinstance(arguments, dict):
        return arguments
    if not arguments:
        return {}
    try:
        value = json.loads(arguments)
    except (TypeError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}
