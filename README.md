# Coral Future App

The website is available at [coralfuture.org](https://coralfuture.org/), run by [Voolstra lab](https://biologie.uni-konstanz.de/voolstra). The motivation is to build a global database of standardized thermal tolerance ED50 values as determined by CBASS to enable meta-analyses and -comparisons. 

## Get Started

### Generate Django secrete jey

```python
from django.core.management.utils import get_random_secret_key

get_random_secret_key()
```

### Create `.env` file:

Here below an example `.env` file for development purposes:

```commandline
DEBUG=1 # Don't use 1 (True) in the production environment!
SECRET_KEY=''
DJANGO_ALLOWED_HOSTS='localhost 127.0.0.1 [::1]'
DJANGO_SETTINGS_MODULE=django_app.settings
SQL_ENGINE=django.db.backends.postgresql_psycopg2
REACT_APP_BACKEND_URL=http://localhost # Don't forget to change this
DB_USER=''
DB_PASSWORD=''
DB_NAME=''
CONTACT_EMAIL_ADDRESS=''
```

### Deploy

#### Up the project from scratch

```commandline
docker compose up -d

```

#### Create superuser

```commandline
docker compose exec django-app python manage.py createsuperuser
```

You can also prepare your `user_data.json` and populate your database automatically:

```json
[
  {
    "username": "user1",
    "password": "password123",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john_doe@domain.com"
  },
  {
    "username": "user2",
    "password": "password456",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane_smith@domain.com"
  },
  {
    "username": "admin",
    "password": "adminpassword",
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin_user@domain.com"
  }
]
```
And then run custom django-admin command:

```

## API endpoints

- `GET /` – FastAPI ED calculator home page with upload form.
- `POST /process` – handles file upload/example data, invokes the R workflow, returns table + plots.
- `GET /download-csv` – downloads the latest ED table (used by the web UI button).

## FastAPI ED calculator

1. UI posts CSV/XLSX or toggled example data to `/process`.
2. FastAPI writes the dataset to a temp CSV and calls `calculate_eds.R`.
3. The R script loads CBASSED50, preprocesses, fits DRMs with `is_curveid = TRUE`, and writes ED5/50/95 plus PNG plots.
4. FastAPI reads the output CSV and PNGs, embeds the table + base64 images into the results template with download buttons.

## Django backend endpoints

- `/` — legacy Django home, keeps basic landing view, redirects to React when needed.
- `/admin/` — standard Django admin.
- `/projects/` — SSR views for project listings (see `projects.urls`).
- `/user/` — auth/profile views (see `users.urls`).
- `/api/auth/...` — authenticated REST endpoints: cart (`/cart/`, `/cart/group/<id>/`, `/cart/export/`), session helpers (`/status/`, `/csrf/`, `/login/`, `/logout/`), CSV upload/check/ED50 calculation (`/upload-csv/`, `/check-csv-ed50/`, `/calculate-ed50/`).
- `/api/public/...` — read-only data feeds: `statistics/`, `biosamples/`, `colonies/`, `observations/`, `projects/`, `projects/<id>/`, and thermal layers (`thermal-tolerances/`, `thermal-tolerances/max-min/`, `breakpoint-temperatures/`, `breakpoint-temperatures/max-min/`, `thermal-limits/`, `thermal-limits/max-min/`).