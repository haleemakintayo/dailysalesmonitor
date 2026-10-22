#!/usr/bin/env python
"""Root convenience wrapper for backend Django management commands."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

def main():
    root_dir = Path(__file__).resolve().parent

    # Explicitly load local .env from project root if present
    env_file = root_dir / '.env'
    if env_file.exists():
        load_dotenv(env_file)

    backend_dir = root_dir / 'backend'
    sys.path.insert(0, str(backend_dir))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dailysales.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
