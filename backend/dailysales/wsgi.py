import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Explicitly load local .env if present
env_file = backend_dir.parent / '.env'
if env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv(backend_dir / '.env')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dailysales.settings')

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
app = application
