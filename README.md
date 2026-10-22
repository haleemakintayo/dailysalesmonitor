# Daily Sales Log

A responsive web application enabling a shop owner to record sales in Nigerian Naira (₦), view an accurate running daily total and transactions list in the **Africa/Lagos** timezone, and maintain persistent storage using **Neon PostgreSQL** in production (with **SQLite** support for local development).

---

## Architecture Overview

- **Frontend**: React 19, Vite, Tailwind CSS v4 (located at repository root).
- **Backend**: Django 5.x, Django REST Framework, WhiteNoise (located in [`backend/`](file:///c:/Users/echoe/OneDrive/Documents/GitHub/dailysalesmonitor/backend)).
- **Database**:
  - **Production**: Hosted **Neon PostgreSQL**, connected via `DATABASE_URL` using `dj-database-url` and `psycopg`.
  - **Local Development**: Local **SQLite** fallback (`backend/db.sqlite3`) when `DATABASE_URL` is omitted and `DEBUG=True`.
- **Timezone**: `Africa/Lagos` (WAT, UTC+1). Daily totals and date filters strictly respect Lagos midnight-to-midnight boundaries.
- **Currency & Calculations**: Nigerian Naira (`₦`), calculated using database-authoritative decimal aggregation (`Sum('amount')`) to eliminate client-side floating-point rounding errors.
- **Authentication**: Built-in Django session authentication with CSRF protection (`X-CSRFToken`) for reviewer access.
- **Deployment**: Configured as a single **Vercel** project using Vercel’s native full-stack Django framework integration.

---

## Project Structure

```text
dailysalesmonitor/
├── backend/                                  # Django backend application
│   ├── dailysales/                           # Django project configuration
│   │   ├── __init__.py
│   │   ├── asgi.py                           # ASGI entrypoint
│   │   ├── settings.py                       # Settings (Neon Postgres, SQLite fallback, CSRF, WhiteNoise)
│   │   ├── urls.py                           # URL routing and SPA fallback view
│   │   └── wsgi.py                           # WSGI entrypoint
│   ├── sales/                                # Sales app
│   │   ├── management/
│   │   │   └── commands/
│   │   │       ├── ensure_reviewer.py        # Creates reviewer user from environment variables
│   │   │       └── setup_db.py               # Manual command: runs migrations + ensure_reviewer
│   │   ├── migrations/                       # Database migrations
│   │   ├── models.py                         # Sale model definition
│   │   ├── serializers.py                    # DRF serializers & field validation rules
│   │   ├── tests.py                          # Automated test suite (AC1–AC8)
│   │   ├── urls.py                           # API routes (/api/sales/, /api/auth/...)
│   │   └── views.py                          # API endpoint handlers & aggregate queries
│   ├── staticfiles/                          # Collected static assets for WhiteNoise & Vercel CDN
│   ├── manage.py                             # Django CLI management script
│   └── requirements.txt                      # Python dependencies
├── src/                                      # React frontend source code
│   ├── App.jsx                               # Main Dashboard (Summary, Form, Table, Modal)
│   ├── index.css                             # Tailwind CSS v4 styling
│   └── main.jsx                              # React DOM mount point
├── .env.example                              # Template of required environment variables (safe placeholders)
├── .gitignore                                # Excludes node_modules, .env, SQLite DB, staticfiles
├── build.sh                                  # Standalone build script (frontend build + collectstatic)
├── index.html                                # SPA HTML shell
├── manage.py                                 # Root convenience wrapper delegating to backend/manage.py
├── package.json                              # Node dependencies, build & database scripts
├── pyproject.toml                            # Vercel native Django entrypoint & build configuration
├── requirements.txt                          # Root Python dependencies for Vercel Python runtime
└── vite.config.js                            # Vite config (/static/ asset base in build, /api/ proxy in dev)
```

---

## Local Development Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 2. Environment Configuration
Copy the safe example environment template:
```bash
cp .env.example .env
```
In `.env`, set:
```dotenv
DEBUG=True
RESTRICTED_ACCESS=False
REVIEWER_USERNAME=reviewer
REVIEWER_PASSWORD=choose-a-local-password
```
*(Leave `DATABASE_URL` empty to automatically use local SQLite, or provide a Neon connection string to test PostgreSQL locally).*

### 3. Install Dependencies

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Install frontend Node dependencies:
```bash
npm install
```

### 4. Database Setup (Migrations & Reviewer Account)
Run the manual database setup command:
```bash
python manage.py setup_db
```
*(Or `npm run setup:db`). This applies all schema migrations and provisions the reviewer account specified by `REVIEWER_USERNAME` and `REVIEWER_PASSWORD`.*

### 5. Running the Automated Tests
Run the Django backend test suite:
```bash
python manage.py test sales
```

### 6. Starting the Application

#### Option A: Development Mode (with Hot Module Replacement)
Run both servers in separate terminals:
- **Backend (port 8000)**:
  ```bash
  python manage.py runserver 8000
  ```
- **Frontend (port 5173)**:
  ```bash
  npm run dev
  ```
Open `http://localhost:5173` in your browser. API calls to `/api/*` are automatically proxied to Django on port 8000.

#### Option B: Standalone Production Simulation
Build the React frontend and collect static assets:
```bash
npm run build
python manage.py runserver 8000
```
Open `http://localhost:8000/`. Django serves the compiled React SPA and all API endpoints directly.

---

## Deployment to Vercel (with Neon PostgreSQL)

This application is configured for deployment as **one Vercel project** using Vercel’s native Django framework integration ([official documentation](https://vercel.com/docs/frameworks/full-stack/django)).

### Step 1: Provision a Neon PostgreSQL Database
1. Sign in to [Neon Console](https://console.neon.tech/).
2. Create a new project (e.g., `dailysalesmonitor`).
3. Copy your pooled connection string from the dashboard. It will look like:
   ```text
   postgresql://[user]:[password]@[endpoint].neon.tech/neondb?sslmode=require
   ```

### Step 2: Run Manual Database Migrations
> [!IMPORTANT]
> To ensure reliability and avoid serverless race conditions, database migrations and reviewer account creation are **not** executed on request handling or automatically during the Vercel build. Run setup manually against your Neon database from your local machine before launching:

```bash
DATABASE_URL="your-neon-connection-string" REVIEWER_USERNAME="reviewer" REVIEWER_PASSWORD="your-strong-password" python manage.py setup_db
```
This executes:
1. `python manage.py migrate` against Neon.
2. `python manage.py ensure_reviewer` to create the reviewer superuser with the provided password.

### Step 3: Deploy to Vercel
1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New…** > **Project**.
3. Import your GitHub repository.
4. Vercel automatically detects the project using [`pyproject.toml`](file:///c:/Users/echoe/OneDrive/Documents/GitHub/dailysalesmonitor/pyproject.toml) and root [`manage.py`](file:///c:/Users/echoe/OneDrive/Documents/GitHub/dailysalesmonitor/manage.py).
5. **Project Settings**:
   - **Framework Preset**: Django (auto-detected).
   - **Root Directory**: `./` (leave as root).
   - **Build Command**: `npm run build` *(runs Vite build + `collectstatic`)*.
   - **Output Directory**: Leave default (Vercel manages static and serverless outputs automatically).
6. **Environment Variables**:
   Add the following environment variables in the Vercel dashboard:

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...neon.tech/neondb?sslmode=require` | **(Secret)** Neon PostgreSQL connection string. |
| `DJANGO_SECRET_KEY` | *(A 50+ character random secret key)* | **(Secret)** Cryptographic signing key. |
| `DEBUG` | `False` | Disables debug mode in production. |
| `ALLOWED_HOSTS` | `.vercel.app` *(or your custom domain)* | Allowed hostnames for the deployment. |
| `CSRF_TRUSTED_ORIGINS` | `https://*.vercel.app` *(or your custom domain)* | Allowed HTTPS origins for CSRF POST requests. |
| `RESTRICTED_ACCESS` | `False` *(or `True` if reviewer login is required)* | Enforces session authentication for all sales access. |
| `REVIEWER_USERNAME` | `reviewer` | Username for reviewer authentication. |
| `REVIEWER_PASSWORD` | *(Your private reviewer password)* | Password for reviewer authentication. |
| `REVIEWER_EMAIL` | `reviewer@example.com` | Email address for reviewer superuser. |

7. Click **Deploy**.

---

## Authentication & Reviewer Access

### How It Works
1. **CSRF Protection**: On initial load, the React frontend calls `GET /api/auth/csrf/` to establish the CSRF cookie (`csrftoken`) and extract the token. All state-modifying requests (`POST /api/sales/`, `/api/auth/login/`, `/api/auth/logout/`) send the `X-CSRFToken` header.
2. **Session Authentication**:
   - Clicking **"Sign in"** in the top header opens the reviewer login modal.
   - Submitting the form sends a request to `POST /api/auth/login/`.
   - Django authenticates the credentials against the database and establishes a secure session via the `sessionid` cookie (`SameSite=Lax`, `Secure=True` in production).
3. **Restricted Mode (`RESTRICTED_ACCESS`)**:
   - When set to `True`, unauthenticated calls to `/api/sales/` return `HTTP 403 Forbidden`, prompting the sign-in modal (fulfilling PRD acceptance criterion AC14).

### Reviewer Credentials
- Reviewer credentials are created securely via `python manage.py setup_db` (or `python manage.py ensure_reviewer`) using the environment variables `REVIEWER_USERNAME` and `REVIEWER_PASSWORD`.
- **Never commit real reviewer passwords to the Git repository.** Reviewer credentials should be communicated privately through recruitment or assessment submission channels.

---

## API Reference

### `GET /api/sales/`
Returns sales and running total for a specific date (defaults to today in `Africa/Lagos`).
- **Query Parameter (optional)**: `?date=YYYY-MM-DD`
- **Response Format**:
```json
{
  "date": "2026-10-22",
  "timezone": "Africa/Lagos",
  "currency": "NGN",
  "total": "1250.00",
  "count": 1,
  "sales": [
    {
      "id": 1,
      "item_name": "Bread",
      "amount": "1250.00",
      "sold_at": "2026-10-22T09:15:00+01:00"
    }
  ]
}
```

### `POST /api/sales/`
Records a new sale.
- **Request Body**:
```json
{
  "item_name": "Bread",
  "amount": "1250.00",
  "sold_at": "2026-10-22T09:15:00+01:00"
}
```
- **Validation Rules**:
  - `item_name`: Required, 1–120 characters after trimming whitespace.
  - `amount`: Positive decimal, up to 2 decimal places, maximum ₦9,999,999,999.99.
  - `sold_at`: Timezone-aware ISO 8601 string with explicit offset. Future minutes are rejected.

### Auth Endpoints
- `GET /api/auth/csrf/` — Fetch CSRF token for request headers.
- `GET /api/auth/status/` — Check session authentication and restricted mode status.
- `POST /api/auth/login/` — Authenticate and create session (`{ "username": "...", "password": "..." }`).
- `POST /api/auth/logout/` — Terminate active session.
