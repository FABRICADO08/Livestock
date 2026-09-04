# Livestock Management System (Java Edition)

A responsive web application for managing livestock records with PostgreSQL persistence, Google OAuth sign-in, and role-based access control.

## Key Features

- Google OAuth 2.0 sign-in
- Session-based authentication for API calls
- Role-based permissions:
  - `ADMIN`: full access, user management, edit/delete any record
  - `USER`: create/view all, edit/delete own records only
- Audit trail per record (`created_by`, `updated_by`, `created_at`, `updated_at`)
- User table with role and login tracking
- CRUD dashboard with search/filter/statistics

## Technology Stack

- Java 11
- Java Servlet API (Jetty via Maven plugin)
- PostgreSQL
- HTML5 + Bootstrap 5 + JavaScript
- Gson

## Prerequisites

- JDK 11+
- Maven
- PostgreSQL
- Google Cloud OAuth 2.0 Client ID (Web application)

## Database Setup

Run this SQL on your PostgreSQL database:

```sql
CREATE TABLE IF NOT EXISTS public.livestock (
    id SERIAL PRIMARY KEY,
    species VARCHAR(100) NOT NULL,
    breed VARCHAR(100) NOT NULL,
    age INTEGER,
    weight NUMERIC,
    health_status VARCHAR(50),
    gender VARCHAR(20),
    classification VARCHAR(50),
    date_of_birth DATE,
    acquisition_date DATE,
    production_type VARCHAR(50),
    vaccination_status VARCHAR(50),
    location VARCHAR(100),
    id_tag VARCHAR(50),
    notes TEXT,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE livestock ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE livestock ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255);
ALTER TABLE livestock ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE livestock ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255),
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> Note: the application also auto-creates the `users` table and audit columns on startup if missing.

### Fixing a legacy `users` table

Databases created by very old versions of this app may have `google_id` as (part of) the primary key or with a `NOT NULL` constraint. The app now drops those legacy constraints automatically at startup. If you prefer to fix it manually, run:

```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
```

## Environment Variables

Set these environment variables (Render.com or local shell):

```bash
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority
GOOGLE_CLIENT_ID=<google_oauth_client_id>
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com
```

On Render, set `MONGO_URI` and reference it in your properties so Spring uses it:

```properties
# Tells Spring to use your MongoDB URL on Render
spring.data.mongodb.uri=${MONGO_URI}
```

Optional local fallback file at repository root (`local.properties`):

```properties
spring.data.mongodb.uri=${MONGO_URI}
MONGO_URI=mongodb://localhost:27017/livestock
GOOGLE_CLIENT_ID=your_google_oauth_client_id
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com
```

If you keep auth settings in Neon/PostgreSQL instead of environment variables, add them to `app_config`:

```sql
INSERT INTO app_config (key, value)
VALUES
  ('GOOGLE_CLIENT_ID', '<google_oauth_client_id>'),
  ('ADMIN_EMAILS', 'admin1@gmail.com,admin2@gmail.com')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = CURRENT_TIMESTAMP;
```

## Google OAuth Setup

1. Open Google Cloud Console.
2. Create OAuth 2.0 credentials for a **Web application**.
3. Add authorized JavaScript origins (example: `http://localhost:8080`).
4. Use the generated Client ID as `GOOGLE_CLIENT_ID`.

## Run

```bash
mvn clean package
mvn jetty:run -Djetty.http.port=8080
```

Open `http://localhost:8080`, sign in with Google, then manage records.

## API Endpoints

- `POST /api/auth/google` – authenticate with Google credential token
- `GET /api/auth/session` – current logged-in user
- `POST /api/auth/logout` – logout
- `GET /api/auth/users` – list users (ADMIN)
- `PUT /api/auth/users/{email}` – update role (ADMIN)
- `GET /api/livestock/*` – authenticated livestock APIs
