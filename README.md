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
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

> Note: the application also auto-creates the `users` table and audit columns on startup if missing.

## Environment Variables

Set these environment variables (Render.com or local shell):

```bash
DB_URL=jdbc:postgresql://<host>:5432/<db>?currentSchema=public
DB_USER=<database_user>
DB_PASSWORD=<database_password>
GOOGLE_CLIENT_ID=<google_oauth_client_id>
ADMIN_EMAILS=admin1@gmail.com,admin2@gmail.com
```

Optional local fallback file at repository root (`local.properties`):

```properties
DB_URL=jdbc:postgresql://localhost:5432/postgres?currentSchema=public
DB_USER=postgres
DB_PASSWORD=your_password
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

