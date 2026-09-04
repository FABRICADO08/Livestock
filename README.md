# Livestock Management System (Java Edition)

A responsive web application for managing livestock records with MongoDB persistence, Google OAuth sign-in, and role-based access control.

## Key Features

- Google OAuth 2.0 sign-in
- Session-based authentication for API calls
- Role-based permissions:
  - `ADMIN`: full access, user management, edit/delete any record
  - `USER`: create/view all, edit/delete own records only
- Audit trail per record (`created_by`, `updated_by`, `created_at`, `updated_at`)
- User collection with role and login tracking
- CRUD dashboard with search/filter/statistics

## Technology Stack

- Java 11
- Spring Boot 2.7 (embedded Tomcat)
- Spring Data MongoDB
- HTML5 + Bootstrap 5 + JavaScript
- Gson

## Prerequisites

- JDK 11+
- Maven
- MongoDB (local instance or MongoDB Atlas connection string)
- Google Cloud OAuth 2.0 Client ID (Web application)

## Database Setup

No manual schema setup is required. MongoDB creates the `livestock` and `users` collections automatically when the first records are written.

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

The MongoDB connection itself is configured in `src/main/resources/application.yml`:

```yaml
spring:
  data:
    mongodb:
      uri: ${MONGO_URI:mongodb://localhost:27017/livestock}
```

## Google OAuth Setup

1. Open Google Cloud Console.
2. Create OAuth 2.0 credentials for a **Web application**.
3. Add authorized JavaScript origins (example: `http://localhost:8080`).
4. Use the generated Client ID as `GOOGLE_CLIENT_ID`.

## Run

```bash
mvn clean package
mvn spring-boot:run
```

Or run the packaged jar:

```bash
java -jar target/livestock.jar
```

Open `http://localhost:8080`, sign in with Google, then manage records.

## Deploy on Render

Render builds the Docker image from `DockerFile` (multi-stage Maven build, then runs the Spring Boot jar). Set these environment variables in the Render dashboard:

- `MONGO_URI` – MongoDB connection string
- `GOOGLE_CLIENT_ID` – Google OAuth client ID
- `ADMIN_EMAILS` – comma-separated admin emails
- `PORT` – injected automatically by Render

## API Endpoints

- `POST /api/auth/google` – authenticate with Google credential token
- `GET /api/auth/session` – current logged-in user
- `POST /api/auth/logout` – logout
- `GET /api/auth/users` – list users (ADMIN)
- `PUT /api/auth/users/{email}` – update role (ADMIN)
- `GET /api/livestock/` – list livestock (supports `q`, `filter`, `sort`, `page`, `limit`)
- `POST /api/livestock/` – create a record
- `PUT /api/livestock/{id}` – update a record (owner or ADMIN)
- `DELETE /api/livestock/{id}` – delete a record (owner or ADMIN)
- `GET /api/livestock/stats` – dashboard statistics

Record IDs are MongoDB ObjectId strings.
