#!/usr/bin/env bash
# Exit on error
set -o errexit

# 1. Install frontend dependencies and build React app
npm install
npm run build

# 2. Install Python backend dependencies
pip install -r backend/requirements.txt

# 3. Apply database migrations and ensure reviewer user
python manage.py migrate
python manage.py ensure_reviewer

# 4. Collect static assets for WhiteNoise
python manage.py collectstatic --no-input
