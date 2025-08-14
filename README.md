# Livestock Management System (Java Edition)

A robust command-line and web-based application for managing livestock records, built with Java, Maven, and a MySQL database. This system provides a straightforward way to handle CRUD (Create, Read, Update, Delete) operations for livestock data.

## Features

- **Add Livestock**: Add new animals with details like species, breed, age, weight, and health status.
- **View All Livestock**: Display a complete list of all animals in the database.
- **Update Livestock**: Modify the details of an existing animal.
- **Delete Livestock**: Remove an animal's record from the database.
- **Search Livestock**: Find specific animals by their species or breed.
- **Web Interface**: A modern, user-friendly web dashboard to perform all management tasks visually.
- **Persistent Storage**: Utilizes a MySQL database for reliable data storage.

## Technology Stack

- **Backend**: Java 11
- **Build Tool**: Apache Maven
- **Web Framework**: Spring Boot
- **Database**: MySQL
- **Libraries**:
  - `mysql-connector-j` (for JDBC connection)
  - `spring-boot-starter-web` (for REST APIs)
  - `spring-boot-starter-thymeleaf` (for serving HTML pages)

## Prerequisites

Before you begin, ensure you have the following installed on your system:
- **Java Development Kit (JDK) 11** or newer.
- **Apache Maven**.
- A running **MySQL Server** instance.
- A code editor or IDE like IntelliJ IDEA, VS Code, or Eclipse.

## Setup and Installation

Follow these steps to get the application running on your local machine.

**1. Clone the Repository**

```bash
git clone https://github.com/FABRICADO08/Livestock.git
cd Livestock
```

**2. Set up the MySQL Database**

- Connect to your MySQL server.
- Create a new database for the project: `CREATE DATABASE livestock_db;`
- (Optional but recommended) Create a dedicated user and grant it permissions:
  ```sql
  CREATE USER 'livestock_user'@'localhost' IDENTIFIED BY 'your_password';
  GRANT ALL PRIVILEGES ON livestock_db.* TO 'livestock_user'@'localhost';
  FLUSH PRIVILEGES;
  ```

**3. Configure Application Properties**

Instead of environment variables, Spring Boot uses an `application.properties` file. Create this file in `src/main/resources/application.properties` and add your database configuration:

```properties
# MySQL Database Configuration
spring.datasource.url=jdbc:mysql://localhost:3306/livestock_db
spring.datasource.username=livestock_user
spring.datasource.password=your_password
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# Thymeleaf configuration (to allow HTML5 without strict closing tags)
spring.thymeleaf.mode=HTML
```

**4. Update `pom.xml` for Web Functionality**

You need to add Spring Boot dependencies to your `pom.xml` file. The file should be updated to look like the one provided in the setup guide. This will add the necessary web server and templating engine capabilities.

## How to Run the Application

The project can be run in two modes:

### A. Original Command-Line Interface

To run the original console application:

1.  **Build the project:**
    ```bash
    mvn clean install
    ```
2.  **Run the JAR file (make sure to set environment variables first):**
    ```bash
    # For Windows
    set DB_URL=jdbc:mysql://localhost:3306/livestock_db
    set DB_USER=your_mysql_user
    set DB_PASSWORD=your_password
    java -cp target/Livestock-1.0-SNAPSHOT.jar com.mycompany.livestock.Livestock

    # For macOS/Linux
    export DB_URL="jdbc:mysql://localhost:3306/livestock_db"
    export DB_USER="your_mysql_user"
    export DB_PASSWORD="your_password"
    java -cp target/Livestock-1.0-SNAPSHOT.jar com.mycompany.livestock.Livestock
    ```

### B. Web-Based User Interface (Recommended)

After completing the setup steps (including updating `pom.xml` and adding new Java/HTML files):

1.  **Run the application using Maven:**
    ```bash
    mvn spring-boot:run
    ```
2.  Open your web browser and navigate to:
    > **http://localhost:8080**

You will see a dashboard where you can manage the livestock records visually. The application will automatically create the `livestock` table in your database on the first run.
