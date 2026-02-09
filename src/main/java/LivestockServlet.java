import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.google.gson.Gson;

@WebServlet("/api/livestock/*")
public class LivestockServlet extends HttpServlet {
    private Gson gson = new Gson();

    // 1. GET: Fetch all livestock records for the table
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        List<Animal> list = new ArrayList<>();
        try (Connection conn = Connect.getConnection();
                Statement stmt = conn.createStatement();
                ResultSet rs = stmt.executeQuery("SELECT * FROM livestock ORDER BY id DESC")) {

            while (rs.next()) {
                list.add(new Animal(
                        rs.getInt("id"),
                        rs.getString("species"),
                        rs.getString("breed"),
                        rs.getInt("age"),
                        rs.getDouble("weight"),
                        rs.getString("health_status"),
                        rs.getTimestamp("registered_at")));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        sendAsJson(response, list);
    }

    // 2. POST: Save a new livestock record
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        BufferedReader reader = request.getReader();
        Animal animal = gson.fromJson(reader, Animal.class);

        String sql = "INSERT INTO livestock (species, breed, age, weight, health_status) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = Connect.getConnection();
                PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, animal.species);
            pstmt.setString(2, animal.breed);
            pstmt.setInt(3, animal.age);
            pstmt.setDouble(4, animal.weight);
            pstmt.setString(5, animal.health_status);
            pstmt.executeUpdate();
            response.setStatus(HttpServletResponse.SC_CREATED);
        } catch (SQLException e) {
            e.printStackTrace();
            response.sendError(500);
        }
    }

    // 3. DELETE: Remove a record
    protected void doDelete(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String pathInfo = request.getPathInfo(); // Expecting /id
        if (pathInfo != null && pathInfo.length() > 1) {
            int id = Integer.parseInt(pathInfo.substring(1));
            try (Connection conn = Connect.getConnection();
                    PreparedStatement pstmt = conn.prepareStatement("DELETE FROM livestock WHERE id = ?")) {
                pstmt.setInt(1, id);
                pstmt.executeUpdate();
                response.setStatus(HttpServletResponse.SC_OK);
            } catch (SQLException e) {
                e.printStackTrace();
            }
        }
    }

    private void sendAsJson(HttpServletResponse response, Object obj) throws IOException {
        response.setContentType("application/json");
        PrintWriter out = response.getWriter();
        out.print(gson.toJson(obj));
        out.flush();
    }

    // Simple Inner Class to map Data
    private static class Animal {
        int id;
        String species, breed, health_status;
        int age;
        double weight;
        Timestamp registration_date;

        Animal(int id, String s, String b, int a, double w, String h, Timestamp r) {
            this.id = id;
            this.species = s;
            this.breed = b;
            this.age = a;
            this.weight = w;
            this.health_status = h;
            this.registration_date = r;
        }
    }
}