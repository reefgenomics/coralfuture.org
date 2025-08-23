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

```commandline
[
    {"username": "user1", "password": "password123", "first_name": "John", "last_name": "Doe", "email": "John_Doe@domain.com"},
    {"username": "user2", "password": "password456", "first_name": "Jane", "last_name": "Smith", "email: "Jane_Smith@domain.com"},
    {"username": "admin", "password": "adminpassword", "first_name": "Admin", "last_name": "User", "email": "Admin_User@domain.com"}
]

```
And then run custom django-admin command:

```commandline
docker compose exec django-app python manage.py create_users path/to/user_data.json
```
Don't forget to replace the path to your `user_data.json` file.

#### Populate the database 

Let's say my owner is `user1`.

For complete datasets:

```commandline
docker compose exec django-app python manage.py \
  populate_db \
    --owner user1
    --csv_path static/datasheets/cbass_84.csv
```

For incomplete datasets, use `--no-pam` argument:

```commandline
docker compose exec django-app python manage.py \
  populate_db \
    --owner betyaevilya \
    --csv_path static/datasheets/redsea_gradient_study.csv \
    --no-pam
```

## Database Backups

Create a database backup:

```commandline
sudo docker compose exec database pg_dump -U $DB_USER --format=custom > backup.pgdump
```

Restore a database backup:

```commandline
pg_restore --clean --dbname $DB_NAME -U $DB_USER backup.pgdump
```
# Test commit
