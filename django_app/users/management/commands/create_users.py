import json
from django.core.management.base import BaseCommand
from users.models import CustomUser


class Command(BaseCommand):
    help = 'Creates users and superusers'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str,
                            help='Path to the JSON file containing user data')

    def handle(self, *args, **kwargs):
        file_path = kwargs['file_path']
        with open(file_path, 'r') as file:
            users_data = json.load(file)

        for user_data in users_data:
            self.create_user_from_data(user_data)

    def create_user_from_data(self, user_data):
        username = user_data['username']
        first_name = user_data['first_name']
        last_name = user_data['last_name']
        email = user_data['email']
        password = user_data['password']

        user, created = CustomUser.objects.get_or_create(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name)

        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.save()

        self.stdout.write(
            self.style.SUCCESS(f'Created user: {username}: {created}'))
