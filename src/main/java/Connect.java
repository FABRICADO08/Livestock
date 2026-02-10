
import java.io.FileInputStream;
import java.util.Properties;
import java.sql.Connection;
import java.sql.DriverManager;

public class Connect {
    public static Connection getConnection() {
        try {
            // This reads the "DB_URL" variable you will set in Render's dashboard
            String dbUrl = System.getenv("DB_URL");
            String user = System.getenv("DB_USER");
            String pass = System.getenv("DB_PASSWORD");
            
            Class.forName("org.postgresql.Driver");
            return DriverManager.getConnection(dbUrl, user, pass);
        } catch (Exception e) {
           System.out.println("Cloud Connection Error: " + e.getMessage());
        return null;
            
        }
    }
}