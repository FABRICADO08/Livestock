# Livestock Management System (Java Edition)
A modern, responsive web application for managing livestock records. This system allows farmers and managers to track cattle and sheep, monitor health status, and maintain persistent records using a PostgreSQL database.

🚀 Key Features
Dynamic Web Dashboard: A single-page interface built with Bootstrap 5.

Smart Selection: Dependent dropdowns that filter breeds based on the selected species (Cattle or Sheep).

Full CRUD Operations: Create, Read, Update, and Delete livestock records in real-time.

Health Tracking: Visual badges to identify "Healthy" vs "Sick/Quarantined" animals.

Persistent Storage: Integration with PostgreSQL for reliable data management.

JSON API: A RESTful backend that communicates via JSON.

🛠️ Technology Stack
Backend: Java 11 / 17

Framework: Spring Boot (Web & JDBC)

Database: PostgreSQL

Frontend: HTML5, JavaScript (ES6+), Bootstrap 5

JSON Parser: GSON

📋 Prerequisites
Before running the application, ensure you have:

JDK 11 or 17 installed.

Apache Maven installed.

PostgreSQL installed and running.

pgAdmin 4 (recommended for database management).

⚙️ Setup and Installation
1. Database Setup
Open pgAdmin or psql and run the following commands to create the table in the public schema:

SQL

CREATE TABLE public.livestock (
    id SERIAL PRIMARY KEY,
    species VARCHAR(100) NOT NULL,
    breed VARCHAR(100) NOT NULL,
    age INTEGER,
    weight NUMERIC,
    health_status VARCHAR(50),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
2. Configuration
Create a local.properties file in the root directory (where pom.xml is located) to store your credentials:

Properties

DB_PASSWORD=your_postgres_password
3. Update Connection String
Ensure your Connect.java points to your local PostgreSQL instance: jdbc:postgresql://localhost:5432/postgres?currentSchema=public

🏃 How to Run the Application
1. Build the Project Use Maven to clean and package the application:

Bash

mvn clean package
2. Start the Server Run the application using the embedded Jetty/Spring Boot server:

Bash

npm start
# OR
mvn spring-boot:run
3. Access the Dashboard Open your browser and navigate to:

http://localhost:9090 (or 8080 depending on your server config)

📂 Project Structure
Plaintext

Livestock/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   ├── Connect.java          # Database connection logic
│   │   │   └── LivestockServlet.java # API Endpoints (GET, POST, DELETE)
│   │   └── webapp/
│   │       └── index.html            # Main Dashboard UI
├── pom.xml                           # Maven dependencies (GSON, PostgreSQL)
├── local.properties                  # Private database credentials
└── README.md                         # This file
🤝 Contributing
Fork the repository.

Create a new feature branch (git checkout -b feature-name).

Commit changes (git commit -m 'Add feature').

Push to the branch (git push origin feature-name).

Open a Pull Request.
