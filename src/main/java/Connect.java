import java.io.FileInputStream;
import java.util.Properties;
import java.sql.Connection;
import java.sql.DriverManager;

public class Connect {
    public static Connection getConnection() {
        try {
            // Try to read from environment variables (cloud deployment)
            String dbUrl = System.getenv("DB_URL");
            String user = System.getenv("DB_USER");
            String pass = System.getenv("DB_PASSWORD");
            
            // Fallback to local.properties for local development
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
            System.out.println("✓ Database connection successful");
            return conn;
            
        } catch (ClassNotFoundException e) {
            System.err.println("PostgreSQL Driver not found: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Database Connection Error: " + e.getMessage());
        }
        return null;
    }
}