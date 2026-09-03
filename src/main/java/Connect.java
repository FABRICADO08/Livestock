import java.io.FileInputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
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

            reconcileSchema(conn);
        }
    }

    /**
     * Re-runs the schema reconciliation on the given connection, even if it
     * already ran once in this JVM. Used as a recovery path when a query hits
     * a legacy schema that could not be fully reconciled automatically.
     */
    public static void reconcileSchema(Connection conn) {
        synchronized (Connect.class) {
            executeQuietly(conn, "CREATE TABLE IF NOT EXISTS users (" +
                    "id SERIAL PRIMARY KEY, " +
                    "email VARCHAR(255) UNIQUE NOT NULL, " +
                    "google_id VARCHAR(255), " +
                    "role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')), " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "last_login TIMESTAMP" +
                    ")");

            // Reconcile schemas of users tables created by older app versions.
            // Each step is best-effort so a single failing migration cannot
            // prevent the application from connecting to the database.
            executeQuietly(conn, "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)");
            dropLegacyGoogleIdConstraints(conn);
            executeQuietly(conn, "ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL");
            executeQuietly(conn, "ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP");

            executeQuietly(conn, "CREATE TABLE IF NOT EXISTS app_config (" +
                    "key VARCHAR(100) PRIMARY KEY, " +
                    "value TEXT NOT NULL, " +
                    "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            executeQuietly(conn, "ALTER TABLE livestock ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)");
            executeQuietly(conn, "ALTER TABLE livestock ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255)");
            executeQuietly(conn, "ALTER TABLE livestock ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            executeQuietly(conn, "ALTER TABLE livestock ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

            schemaInitialized = true;
            System.out.println("✓ Schema checks completed");
        }
    }

    /**
     * Drops legacy PRIMARY KEY / UNIQUE constraints that include the
     * users.google_id column. Older deployments created the users table with
     * google_id as (part of) the primary key, which both rejects NULL values
     * and prevents ALTER COLUMN ... DROP NOT NULL. Such constraints must be
     * removed before the column can accept NULLs again.
     */
    private static void dropLegacyGoogleIdConstraints(Connection conn) {
        List<String> constraintNames = new ArrayList<>();
        String query = "SELECT DISTINCT tc.constraint_name " +
                "FROM information_schema.table_constraints tc " +
                "JOIN information_schema.key_column_usage kcu " +
                "  ON tc.constraint_name = kcu.constraint_name " +
                " AND tc.table_schema = kcu.table_schema " +
                " AND tc.table_name = kcu.table_name " +
                "WHERE tc.table_name = 'users' " +
                "  AND kcu.column_name = 'google_id' " +
                "  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')";

        try (PreparedStatement ps = conn.prepareStatement(query);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                constraintNames.add(rs.getString(1));
            }
        } catch (SQLException e) {
            System.err.println("Schema check: unable to inspect users table constraints: " + e.getMessage());
            return;
        }

        for (String name : constraintNames) {
            if (!isSafeIdentifier(name)) {
                System.err.println("Schema check: skipping suspicious constraint name: " + name);
                continue;
            }
            executeQuietly(conn, "ALTER TABLE users DROP CONSTRAINT IF EXISTS \"" + name + "\"");
            System.out.println("✓ Dropped legacy users constraint: " + name);
        }
    }

    private static boolean isSafeIdentifier(String name) {
        return name != null && name.matches("[A-Za-z0-9_$]+");
    }

    private static void executeQuietly(Connection conn, String sql) {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
        } catch (SQLException e) {
            System.err.println("Schema check skipped (" + sql + "): " + e.getMessage());
        }
    }
}
