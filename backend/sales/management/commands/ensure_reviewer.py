import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = "Ensures the reviewer superuser exists for assessment review"

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.getenv('REVIEWER_USERNAME', 'reviewer')
        password = os.getenv('REVIEWER_PASSWORD')
        email = os.getenv('REVIEWER_EMAIL', 'reviewer@example.com')

        if not password:
            self.stdout.write(
                self.style.WARNING(
                    "REVIEWER_PASSWORD environment variable is not set. "
                    "Skipping reviewer account creation/update."
                )
            )
            return

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Successfully created reviewer user '{username}'"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Reviewer user '{username}' updated successfully."))
