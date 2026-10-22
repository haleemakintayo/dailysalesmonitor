# Daily Sales Log

A responsive web application enabling a shop owner to record sales in Nigerian Naira (₦), maintain persistent database storage with **SQLite**, and view an accurate running daily total and transactions list in the **Africa/Lagos** timezone.

---

## Architecture Overview

- **Frontend**: React 19, Vite, Tailwind CSS v4.
- **Backend**: Django 5.x, Django REST Framework, WhiteNoise, SQLite (`db.sqlite3`).
- **Timezone**: Africa/Lagos (WAT, UTC+1). All business day totals are calculated against Lagos midnight boundaries.
- **Currency**: Nigerian Naira (`₦`), using exact Decimal arithmetic and database-level aggregation (`Sum`).
- **Authentication**: Built-in Django session authentication with CSRF token protection.

---

## Directory Structure

```text
dailysalesmonitor/
├── backend/
│   ├── dailysales/          # Django project configuration (settings, urls, wsgi, asgi)
│   ├── sales/               # Sales Django app (models, serializers, views, urls, tests)
│   ├── staticfiles/         # Collected static assets
│   ├── manage.py            # Backend management script
│   └── requirements.txt     # Python dependencies
├── src/                     # React application source
├── public/                  # Static assets
├── manage.py                # Root convenience wrapper delegating to backend/manage.py
├── package.json             # NPM package and dev scripts
├── vite.config.js           # Vite configuration with Tailwind and API proxy
└── db.sqlite3               # SQLite database file (created in backend/)
```

---

## Getting Started

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 2. Backend Setup

Install Python dependencies:
```bash
pip install -r backend/requirements.txt
```

Run database migrations:
```bash
python manage.py migrate
```

Run backend unit tests:
```bash
python manage.py test sales
```

### 3. Frontend Setup

Install Node dependencies:
```bash
npm install
```

Build frontend:
```bash
npm run build
```

---

## Running the Application

### Development Mode (with Hot Module Replacement)

Run both servers in separate terminals:

1. **Start Django Backend**:
   ```bash
   python manage.py runserver 8000
   ```
   (or `npm run server`)

2. **Start Vite Frontend**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser. API requests to `/api/*` are automatically proxied to the Django backend on port 8000.

### Standalone Production Mode (Django serving React & API)

Build the React frontend:
```bash
npm run build
```

Start the Django server:
```bash
python manage.py runserver 8000
```
Open `http://localhost:8000/` in your browser. Django serves both the compiled frontend and the API endpoints directly.


## Authentication & Reviewer Access

The application uses Django's built-in session authentication alongside CSRF protection for restricted reviewer access.

### How Sign-In Works

1. **CSRF Initialization**: On page load, the frontend calls `GET /api/auth/csrf/` to establish the CSRF cookie and store the token. Every state-modifying POST request (`/api/sales/`, `/api/auth/login/`, `/api/auth/logout/`) includes the `X-CSRFToken` HTTP header with credentials included.
2. **Session Verification**: The frontend checks `GET /api/auth/status/` to determine if a session is currently active and whether restricted mode is enabled.
3. **Signing In**:
   - Clicking **"Sign in"** in the top header opens the reviewer login modal.
   - Submitting the form sends a `POST /api/auth/login/` request with `username` and `password`.
   - Django validates the credentials using `authenticate()`, establishes a secure server-side session via `login()`, and issues the `sessionid` cookie.
   - The UI automatically updates to show **"Signed in as [username]"** and displays a **"Sign out"** button.
4. **Signing Out**:
   - Clicking **"Sign out"** sends `POST /api/auth/logout/`, clearing the server session.
5. **Restricted Mode (`RESTRICTED_ACCESS`)**:
   - By default, `RESTRICTED_ACCESS` is `False` for open local inspection.
   - When set to `True` (e.g., `RESTRICTED_ACCESS=True` in environment variables or settings), both `/api/sales/` and the UI require active authentication (returning HTTP 403 Forbidden to unauthenticated requests) satisfying AC14.

### Pre-Configured Reviewer User

A superuser account is pre-created in the SQLite database for reviewer inspection:

| Role | Username | Password |
| --- | --- | --- |
| **Reviewer / Admin** | `reviewer` | `SalesReviewer2026!` |

*(Admin portal is also available at `http://localhost:8000/admin/` with the same credentials).*

### Creating Additional Users

To create another administrator or reviewer:
```bash
python manage.py createsuperuser
```
Follow the interactive prompts to assign a username, email, and password.

---

## API Reference

### `GET /api/sales/`
Returns sales and running total for a specific date (defaults to today in Africa/Lagos).
- **Query Parameter (optional)**: `?date=YYYY-MM-DD`
- **Response Format**:
```json
{
  "date": "2026-10-17",
  "timezone": "Africa/Lagos",
  "currency": "NGN",
  "total": "1250.00",
  "count": 1,
  "sales": [
    {
      "id": 1,
      "item_name": "Bread",
      "amount": "1250.00",
      "sold_at": "2026-10-17T09:15:00+01:00"
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
  "sold_at": "2026-10-17T09:15:00+01:00"
}
```
- **Validation Rules**:
  - `item_name`: Required, 1–120 characters after trimming whitespace.
  - `amount`: Required positive decimal, at most 2 decimal places, max ₦9,999,999,999.99.
  - `sold_at`: Timezone-aware ISO 8601 string with explicit offset. Future minutes are rejected.

### Auth Endpoints
- `GET /api/auth/csrf/` — Fetch CSRF token for request header.
- `GET /api/auth/status/` — Check current session authentication and restricted mode status.
- `POST /api/auth/login/` — Authenticate and establish session (`{ "username": "...", "password": "..." }`).
- `POST /api/auth/logout/` — Terminate active session.

---

## Verification & Testing

Run the automated test suite:
```bash
python manage.py test sales
```
The test suite validates:
- `AC1`: Saving valid sale persists record and returns HTTP 201.
- `AC2`: Blank/whitespace item names and zero/negative amounts are rejected.
- `AC3`: Amounts with excessive decimal places, naive datetimes, and future datetimes are rejected.
- `AC4`: Decimal aggregation precision (₦100.10 + ₦200.20 = ₦300.30).
- `AC5`: Lagos date boundaries (records at 23:59:59 yesterday vs 00:00:00 today).
- `AC8`: Empty days return ₦0.00 total and count 0.
