import os
import environ
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialise environment variables
env = environ.Env(
    # Set casting, default value
    DEBUG=(bool, False)
)
environ.Env.read_env()

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

BENTHIC_MBTILES_PATHS = {
    'cio': os.getenv('BENTHIC_CIO_MBTILES_PATH', '/benthic/benthic_cio.mbtiles'),
    'caribbean': os.getenv('BENTHIC_CARIBBEAN_MBTILES_PATH', '/benthic/benthic_caribbean.mbtiles'),
    'arabian': os.getenv('BENTHIC_ARABIAN_MBTILES_PATH', '/benthic/benthic_arabian.mbtiles'),
    'redsea': os.getenv('BENTHIC_REDSEA_MBTILES_PATH', '/benthic/benthic_redsea.mbtiles'),
}

BENTHIC_MBTILES_PATH = os.getenv('BENTHIC_MBTILES_PATH', BENTHIC_MBTILES_PATHS['cio'])

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
WHITENOISE_MANIFEST_STRICT = False

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'