import java.io.FileInputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Properties;

public class Connect {
    private static volatile boolean schemaInitialized = false;

    public static Connection getConnection() {
        try {
            String dbUrl = System.getenv("DB_URL");
            String user = System.getenv("DB_USER");
            String pass = System.getenv("DB_PASSWORD");

            if (dbUrl == null || user == null || pass == null) {
                Properties props = new Properties();
                try (FileInputStream fis = new FileInputStream("local.properties")) {
                    props.load(fis);
                    if (dbUrl == null) dbUrl = props.getProperty("DB_URL", "jdbc:postgresql://localhost:5432/postgres?currentSchema=public");
                    if (user == null) user = props.getProperty("DB_USER", "postgres");
                    if (pass == null) pass = props.getProperty("DB_PASSWORD", "");
                } catch (Exception e) {
                    System.err.println("local.properties not found, using environment variables only");
                }
            }

            if (dbUrl == null || user == null) {
                System.err.println("ERROR: Database credentials not configured. Set DB_URL, DB_USER, DB_PASSWORD environment variables or create local.properties");
                return null;
            }

            Class.forName("org.postgresql.Driver");
            Connection conn = DriverManager.getConnection(dbUrl, user, pass);
            ensureSchema(conn);
            System.out.println("✓ Database connection successful");
            return conn;

        } catch (ClassNotFoundException e) {
            System.err.println("PostgreSQL Driver not found: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Database Connection Error: " + e.getMessage());
        }
        return null;
    }

    private static void ensureSchema(Connection conn) throws Exception {
        if (schemaInitialized) {
            return;
        }

        synchronized (Connect.class) {
            if (schemaInitialized) {
                return;
            }

            try (Statement stmt = conn.createStatement()) {
                stmt.execute("CREATE TABLE IF NOT EXISTS users (" +
                        "id SERIAL PRIMARY KEY, " +
                        "email VARCHAR(255) UNIQUE NOT NULL, " +
                        "role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')), " +
                        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                        "last_login TIMESTAMP" +
                        ")");

                stmt.execute("CREATE TABLE IF NOT EXISTS app_config (" +
                        "key VARCHAR(100) PRIMARY KEY, " +
                        "value TEXT NOT NULL, " +
                        "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                        ")");

                stmt.execute("ALTER TABLE livestock ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)");
                stmt.execute("ALTER TABLE livestock ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255)");
                stmt.execute("ALTER TABLE livestock ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
                stmt.execute("ALTER TABLE livestock ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            }

            schemaInitialized = true;
            System.out.println("✓ Schema checks completed");
        }
    }
}
