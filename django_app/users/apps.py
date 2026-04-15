import os
from django.apps import AppConfig
from django.conf import settings


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        """creates default user from env vars"""
        if os.environ.get('DJANGO_SETTINGS_MODULE'):
            try:
                from django.contrib.auth import get_user_model
                import environ
                from pathlib import Path
                
                # same approach as settings.py
                BASE_DIR = Path(__file__).resolve().parent.parent.parent
                env = environ.Env()
                environ.Env.read_env(BASE_DIR / '.env')
                
                # read from .env
                default_username = env('DEFAULT_ADMIN_USERNAME', default=None)
                default_email = env('DEFAULT_ADMIN_EMAIL', default=None)
                default_password = env('DEFAULT_ADMIN_PASSWORD', default=None)
                default_first_name = env('DEFAULT_ADMIN_FIRST_NAME', default='Admin')
                default_last_name = env('DEFAULT_ADMIN_LAST_NAME', default='User')
                
                # create user if all vars set
                if default_username and default_email and default_password:
                    User = get_user_model()
                    user, created = User.objects.get_or_create(
                        username=default_username,
                        defaults={
                            'email': default_email,
                            'first_name': default_first_name,
                            'last_name': default_last_name,
                            'is_staff': True,
                            'is_superuser': True,
                        }
                    )
                    if created:
                        user.set_password(default_password)
                        user.save()
                        print(f'created default user: {default_username}')
                    elif not user.check_password(default_password):
                        # update password if changed
                        user.set_password(default_password)
                        user.is_staff = True
                        user.is_superuser = True
                        user.save()
                        print(f'updated default user: {default_username}')
            except Exception as e:
                # ignore errors on startup (e.g. db not ready yet)
                pass
