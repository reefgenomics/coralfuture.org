import os
import environ
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialise environment variables (repo `.env` lives in parent of `django_app/`)
env = environ.Env(
    # Set casting, default value
    DEBUG=(bool, False)
)
environ.Env.read_env(BASE_DIR.parent / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# False if not in os.environ because of casting above
DEBUG = env('DEBUG')

ALLOWED_HOSTS = env('DJANGO_ALLOWED_HOSTS').split(' ')

CONTACT_EMAIL_ADDRESS = env('CONTACT_EMAIL_ADDRESS')

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Installed pip packages
    'bootstrap5',
    'corsheaders',
    'django_extensions',
    'leaflet',
    'rest_framework',
    # Custom apps
    'api',
    'main',
    'users',
    'profiles.apps.ProfilesConfig',
    'projects'
]

AUTH_USER_MODEL = 'users.CustomUser'

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]

LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'home'
LOGOUT_REDIRECT_URL = 'home'

# Sessions: store in DB so they survive container restarts (cookie stays valid if SECRET_KEY is constant)
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:3000/map',
    'https://coralfuture.org',
    'https://coralfuture.org:3000',
    'https://coralfuture.org:3000/map',
    'http://hemorrhagia.online',
    'https://hemorrhagia.online',
    'http://www.hemorrhagia.online',
    'https://www.hemorrhagia.online',
]

CORS_ORIGIN_WHITELIST = [
    'http://localhost',
    'http://localhost:3000',
    'https://coralfuture.org',
    'https://coralfuture.org:3000',
    'http://hemorrhagia.online',
    'https://hemorrhagia.online',
    'http://www.hemorrhagia.online',
    'https://www.hemorrhagia.online',
]

# https settings
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = False  # nginx handles https

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'django_app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'static/templates',
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'django_app.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': env('SQL_ENGINE'),
        'NAME': env("DB_NAME"),
        'USER': env("DB_USER"),
        'PASSWORD': env("DB_PASSWORD"),
        'HOST': 'database',
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/

STATIC_URL = '/static/'

# Additional directories for static files during development
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

REACT_STATIC_DIR = BASE_DIR.parent / 'react_app' / 'build' / 'static'
if REACT_STATIC_DIR.exists():
    STATICFILES_DIRS.append(REACT_STATIC_DIR)

# Directory where 'collectstatic' will gather static files for production
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files (user uploads: attachment images, etc.)
# https://docs.djangoproject.com/en/5.0/topics/files/
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


def _coralfuture_local_mapdata_fallback():
    """On this project's production host, tiles live alongside the repo."""
    probe = Path.home() / 'MapData'
    try:
        if probe.exists():
            return str(probe)
    except (OSError, RuntimeError):
        pass
    return ''


_CORAL_MAPDATA_HOME = (
    os.getenv('CORAL_MAPDATA_HOME', '').strip().rstrip('/') or _coralfuture_local_mapdata_fallback()
)


def _mbtiles_under_mapdata(relative_under_mapdata: str):
    """
    Default MBTiles filesystem path.

    - If CORAL_MAPDATA_HOME is set (recommended for bare-metal Django on the host pointing at a
      MapData tree): <CORAL_MAPDATA_HOME>/benthic/... or .../reef_extent/...

    - Otherwise (Docker Compose): use top-level dirs /benthic and /reef_extent from volume mounts —
      same filenames as scripts write under MapData.
    """
    rel = relative_under_mapdata.strip().strip('/').replace('\\', '/')
    if _CORAL_MAPDATA_HOME:
        return os.path.join(_CORAL_MAPDATA_HOME, rel)
    return '/' + rel


def _tile_env(primary_key: str, relative_under_mapdata: str):
    return os.getenv(primary_key) or _mbtiles_under_mapdata(relative_under_mapdata)


# Allen Coral Atlas regional MBTiles (see coral-future/scripts/atlas_regions.tsv + generate_all_*_regions.sh)
_ATLAS_REGION_SLUGS = [
    'caribbean',
    'arabian',
    'redsea',
    'micronesia',
    'sw_pacific',
    'andaman_sea',
    'bermuda',
    'brazil',
    'central_south_pacific',
    'coral_sea',
    'eastern_micronesia',
    'eastern_tropical_pacific',
    'great_barrier_reef',
    'northeastern_asia',
    'south_china_sea',
    'southeastern_asia',
    'southeastern_caribbean',
    'southern_asia',
    'subtropical_eastern_australia',
    'timor_arafura',
    'western_africa',
    'western_australia',
]


def _atlas_region_env_var(prefix: str, slug: str) -> str:
    """e.g. prefix BENTHIC, slug sw_pacific -> BENTHIC_SW_PACIFIC_MBTILES_PATH"""
    return f'{prefix}_{slug.upper()}_MBTILES_PATH'


BENTHIC_MBTILES_PATHS = {
    'cio': _tile_env('BENTHIC_CIO_MBTILES_PATH', 'benthic/benthic_cio.mbtiles'),
}
for _slug in _ATLAS_REGION_SLUGS:
    BENTHIC_MBTILES_PATHS[_slug] = _tile_env(
        _atlas_region_env_var('BENTHIC', _slug),
        f'benthic/benthic_{_slug}.mbtiles',
    )

BENTHIC_MBTILES_PATH = os.getenv('BENTHIC_MBTILES_PATH') or BENTHIC_MBTILES_PATHS['cio']

REEF_EXTENT_MBTILES_PATHS = {}
for _slug in _ATLAS_REGION_SLUGS:
    REEF_EXTENT_MBTILES_PATHS[_slug] = _tile_env(
        _atlas_region_env_var('REEF_EXTENT', _slug),
        f'reef_extent/reef_extent_{_slug}.mbtiles',
    )

REEF_EXTENT_MBTILES_PATH = (
    os.getenv('REEF_EXTENT_MBTILES_PATH') or REEF_EXTENT_MBTILES_PATHS['caribbean']
)

BLEACHING_GRID_MBTILES_PATH = _tile_env(
    'BLEACHING_GRID_MBTILES_PATH',
    'bleaching/bleaching_grid.mbtiles',
)
BLEACHING_OBSERVATIONS_GEOJSON_PATH = (
    os.getenv('BLEACHING_OBSERVATIONS_GEOJSON_PATH')
    or (
        os.path.join(_CORAL_MAPDATA_HOME, 'bleaching', 'bleaching_observations.geojson')
        if _CORAL_MAPDATA_HOME
        else '/bleaching/bleaching_observations.geojson'
    )
)
BLEACHING_YEARS_JSON_PATH = (
    os.getenv('BLEACHING_YEARS_JSON_PATH')
    or (
        os.path.join(_CORAL_MAPDATA_HOME, 'bleaching', 'bleaching_years.json')
        if _CORAL_MAPDATA_HOME
        else '/bleaching/bleaching_years.json'
    )
)

DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
DEEPSEEK_API_URL = os.getenv('DEEPSEEK_API_URL', 'https://api.deepseek.com/chat/completions')
DEEPSEEK_MODEL = os.getenv('DEEPSEEK_MODEL', 'deepseek-chat')

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
WHITENOISE_MANIFEST_STRICT = False

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'