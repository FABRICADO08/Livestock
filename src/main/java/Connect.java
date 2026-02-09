
import java.io.FileInputStream;
import java.util.Properties;
import java.sql.Connection;
import java.sql.DriverManager;

public class Connect {
    public static Connection getConnection() {
        Connection con = null;
        Properties props = new Properties();
        try {
            // Load the password from the local.properties file
            FileInputStream fis = new FileInputStream("./local.properties");
            props.load(fis);
            String dbPass = props.getProperty("DB_PASSWORD");

            String url = "jdbc:postgresql://localhost:5432/livestock";
            String user = "postgres";

            Class.forName("org.postgresql.Driver");
            con = DriverManager.getConnection(url, user, dbPass);
            System.out.println("Connected to PostgreSQL successfully!");
        } catch (Exception e) {
            System.out.println("Could not connect: " + e.getMessage());
        }
        return con;
    }
}