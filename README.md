# Livestock Management System (Java Edition)

A responsive web application for managing livestock records with MongoDB persistence, Google OAuth sign-in, and role-based access control.

## Key Features

- Google OAuth 2.0 sign-in
- Session-based authentication for API calls
- Role-based permissions:
  - `ADMIN`: full access, user management, edit/delete any record
  - `USER`: create/view all, edit/delete own records only
  - `BUYER`: customer role - browses the marketplace of livestock listed for sale, cannot create/edit/delete records
- When an `ADMIN` adds an animal they must assign it to a seller (a `USER` account) - the seller becomes the record owner
- Animal lifecycle status: `ACTIVE` (default), `SOLD`, `DEAD`. Sold and dead animals are removed from the main Animals list and shown in their own Sold/Dead views; the marketplace only lists active animals
- Purchase requests: buyers request to buy an animal; the seller (record owner) or an admin approves or declines from the Purchase Requests view. While a request is pending the marketplace shows "Waiting for approval" to that buyer and "Purchase pending" to everyone else, and the Buy button is hidden. Approving marks the animal `SOLD` and declines competing requests; buyers track their requests (and cancel pending ones) under My Purchases
- Email notifications: the animal owner and buyer are emailed when a purchase request is created, approved, declined or cancelled (requires SMTP settings, see Environment Variables)
- In-app notifications: a bell icon with an unread badge in the navbar shows purchase requests, approvals/declines/cancellations and vaccination reminders even when email delivery is unavailable
- Animal photos: owners/admins can attach up to 5 photos per animal (JPEG/PNG/WebP/GIF, max 5 MB each); photos are stored in MongoDB GridFS and shown as photo cards in the marketplace and as a gallery in the detail view
- Health records: per-animal log of vaccinations, treatments and checkups (date, vet, notes, next due date); due/overdue vaccinations are surfaced on the dashboard and create in-app notifications for the owner
- Marketplace filters and photo cards: buyers browse a photo card grid and can filter by species, gender and max price, search by species/breed/ID tag/location, and sort by price, age or newest
- Reports: CSV export of animals, sold/dead animals and pending purchase requests
- Rate limiting: sign-in and purchase-request endpoints reject bursts with HTTP 429
- Health check endpoint: `GET /actuator/health` for uptime monitoring (e.g. Render)
- New sign-ins default to `USER`; admins can change a user's role to `BUYER` in User Management
- Audit trail per record (`created_by`, `updated_by`, `created_at`, `updated_at`) - records store the owner's full name plus their email (`created_by_email`)
- ID tags (`id_tag`) are unique - enforced in code and by a unique MongoDB index; an animal cannot be saved with a tag already used by another record, and the tag cannot be changed once the record exists
- User collection with name, role and login tracking
- CRUD dashboard with search/filter/statistics

## Technology Stack

- Java 25
- Spring Boot 3.5 (embedded Tomcat)
- Spring Data MongoDB
- HTML5 + Bootstrap 5 + JavaScript
- Gson

## Prerequisites

- JDK 25+
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

Render builds the Docker image from `DockerFile` (multi-stage Maven build, then runs the Spring Boot jar). Configure the service to deploy from the `main` branch and disable Render's automatic deploys. Create a Render deploy hook and save its URL as the GitHub repository secret `RENDER_DEPLOY_HOOK`. The GitHub Actions workflow triggers that hook only when a pull request targeting `main` is merged; closing an unmerged pull request does not deploy.

Set these environment variables in the Render dashboard:

- `MONGO_URI` – MongoDB connection string
- `GOOGLE_CLIENT_ID` – Google OAuth client ID
- `ADMIN_EMAILS` – comma-separated admin emails
- `PORT` – injected automatically by Render
- `MAIL_HOST`, `MAIL_PORT` (default 587), `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` – optional SMTP settings for owner/buyer notification emails; email sending is skipped when `MAIL_HOST` is not set. Emails are sent in the background and the SMTP connection is tested at startup: if the server is unreachable (e.g. Render free web services block outbound SMTP ports 25/465/587, so Gmail SMTP will time out), email notifications are disabled automatically with a single log line instead of failing on every email. To send email from Render, use an HTTP-based provider (SendGrid, Mailgun, Resend) or a paid instance with SMTP allowed.

## SonarQube Analysis

To enable the optional SonarQube GitHub Actions job, import this project into a SonarQube instance and configure the repository Actions secrets `SONAR_TOKEN` (a SonarQube analysis token) and `SONAR_HOST_URL` (the server URL), plus the repository Actions variable `SONAR_PROJECT_KEY` (the imported project's key). Without all three settings, the job succeeds without scanning and records a skip notice in its job summary. Fork pull requests skip the job entirely because repository secrets are unavailable to them.

## API Endpoints

- `POST /api/auth/google` – authenticate with Google credential token
- `GET /api/auth/session` – current logged-in user (email, name, role, picture)
- `POST /api/auth/logout` – logout
- `GET /api/auth/users` – list users (ADMIN)
- `GET /api/auth/sellers` – list USER accounts that animals can be assigned to (ADMIN)
- `PUT /api/auth/users/{email}` – update role to ADMIN, USER or BUYER (ADMIN)
- `GET /api/livestock/` – list livestock (supports `q`, `filter`, `sort`, `status`, `page`, `limit`). By default only ACTIVE animals are returned; use `status=SOLD`, `status=DEAD` or `status=ALL` to include the separated lists
- `GET /api/livestock/{id}` – fetch a single record (any signed-in user)
- `GET /api/livestock/marketplace` – livestock listed for sale (any signed-in user); each entry includes `pending_request`, `pending_request_mine` and `pending_buyer` flags when a purchase is awaiting approval
- `POST /api/livestock/` – create a record (ADMIN/USER; `id_tag` must be unique)
- `PUT /api/livestock/{id}` – update a record (owner or ADMIN; `id_tag` is fixed at creation and cannot be changed on update)
- `DELETE /api/livestock/{id}` – delete a record (owner or ADMIN)
- `GET /api/livestock/stats` – dashboard statistics
- `POST /api/purchases` – submit a purchase request (`livestock_id`, optional `price`) (BUYER)
- `GET /api/purchases/mine` – the buyer's own purchase requests (BUYER)
- `GET /api/purchases/pending` – pending requests to review: own animals (USER) or all (ADMIN)
- `PUT /api/purchases/{id}/approve` – approve a request; marks the animal SOLD and declines competing requests (owner or ADMIN)
- `PUT /api/purchases/{id}/decline` – decline a request (owner or ADMIN)
- `PUT /api/purchases/{id}/cancel` – cancel your own pending request (BUYER)
- `GET /api/pricing/suggestions?species=` – suggested asking price based on existing listings
- `POST /api/livestock/{id}/photos` – upload an animal photo (`multipart/form-data`, field `file`; owner or ADMIN; max 5 photos, 5 MB each)
- `GET /api/livestock/photos/{photoId}` – download a photo (any signed-in user)
- `DELETE /api/livestock/{id}/photos/{photoId}` – remove a photo (owner or ADMIN)
- `GET /api/livestock/vaccinations-due` – vaccination records due within 30 days or overdue for the signed-in user's animals (all animals for ADMIN); also creates in-app reminder notifications
- `GET /api/livestock/{id}/health-records` – list health records for an animal (any signed-in user)
- `POST /api/livestock/{id}/health-records` – add a health record: `type` (Vaccination/Treatment/Checkup), `record_date`, optional `vet`, `notes`, `next_due_date` (owner or ADMIN)
- `DELETE /api/livestock/{id}/health-records/{recordId}` – delete a health record (owner or ADMIN)
- `GET /api/notifications/` – the signed-in user's in-app notifications (newest first, max 50)
- `GET /api/notifications/unread-count` – unread notification count for the navbar badge
- `PUT /api/notifications/{id}/read` – mark one of your notifications as read
- `PUT /api/notifications/read-all` – mark all your notifications as read
- `GET /actuator/health` – liveness/readiness probe (no authentication required)

Record IDs are MongoDB ObjectId strings.
