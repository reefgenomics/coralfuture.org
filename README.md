# Coral Future App

The website is available at [coralfuture.org](https://coralfuture.org/), run by [Voolstra lab](https://biologie.uni-konstanz.de/voolstra). The motivation is to build a global database of standardized thermal tolerance ED50 values as determined by CBASS to enable meta-analyses and -comparisons. 


### Deploy

1. `docker compose up -d`
2. Frontend:
   ```
   cd react_app
   npm install
   npm run build
   rsync -a build/ /var/www/hemorrhagia.online/
   ```
3. Django superuser (when needed):
   ```
   docker compose exec django-app python manage.py createsuperuser
   ```
4. Optional seed users: edit `django_app/user_data.example.json`, then save it as `user_data.json` in the same folder before `docker compose up -d`—startup scripts will create those accounts automatically.
5. After code updates:
   ```
   docker compose exec django-app python manage.py migrate
   docker compose exec django-app python manage.py collectstatic --noinput
   sudo nginx -t && sudo systemctl reload nginx
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

## Ports and services

| Service            | Port | Notes                                              |
|--------------------|------|----------------------------------------------------|
| Django backend     | 8000 | API + admin, proxied by nginx `/api`, `/admin`.    |
| FastAPI ED50 app   | 8001 | `/shiny` + `/process`, runs the R workflow.        |
| React build (nginx)| 443  | Deployed to `/var/www/hemorrhagia.online`.         |

## Deployment cheatsheet

1. **Build frontend**
   ```bash
   cd react_app
   npm install
   npm run build
   sudo cp -r build/* /var/www/coralfuture.org/
   ```
2. **Rebuild backend containers**
   ```bash
   docker compose build
   docker compose up -d
   ```
3. **Static files / migrations (when needed)**
   ```bash
   docker compose exec django-app python manage.py migrate
   docker compose exec django-app python manage.py collectstatic --noinput
   ```
4. **Reload nginx**
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Django data model quick-notes

- `users` app: wraps Django auth, adds profile info, and exposes `/api/auth/...` endpoints for login/logout, cart management, CSV uploads, and ED50 calculations. Superusers manage accounts via `/admin/`.
- `projects` app: handles studies (projects) and associated colonies/observations. React pulls these via `/api/public/projects` and details via `/api/public/projects/<id>/`.
- “Studies”/“cart” flow: authenticated users build a cart of colonies (`UserCart`, `CartGroup`) through the API, then export ED tables via `/api/auth/cart/export/`. Upload endpoints (`upload-csv`, `check-csv-ed50`, `calculate-ed50`) persist uploads for review.