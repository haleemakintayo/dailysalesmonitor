from django.core.management.base import BaseCommand
from django.core.management import call_command

class Command(BaseCommand):
    help = "Manually applies database migrations and runs ensure_reviewer."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Running database migrations..."))
        call_command('migrate', interactive=False)
        self.stdout.write(self.style.SUCCESS("Database migrations completed."))

        self.stdout.write(self.style.NOTICE("Setting up reviewer account..."))
        call_command('ensure_reviewer')
        self.stdout.write(self.style.SUCCESS("Database setup completed successfully."))
