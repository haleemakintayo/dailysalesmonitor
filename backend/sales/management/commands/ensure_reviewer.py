import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = "Ensures the default reviewer superuser exists for assessment review"

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.getenv('REVIEWER_USERNAME', 'reviewer')
        password = os.getenv('REVIEWER_PASSWORD', 'SalesReviewer2026!')
        email = os.getenv('REVIEWER_EMAIL', 'reviewer@example.com')

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Successfully created reviewer user '{username}'"))
        else:
            self.stdout.write(self.style.NOTICE(f"Reviewer user '{username}' already exists"))
