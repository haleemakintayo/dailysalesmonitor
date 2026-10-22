#!/usr/bin/env bash
# Exit on error
set -o errexit

# 1. Install frontend dependencies and build React app
npm install
npm run build:frontend

# 2. Install Python backend dependencies
pip install -r requirements.txt

# 3. Collect static assets
python manage.py collectstatic --no-input
