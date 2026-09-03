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

    // 1. GET: Fetch livestock records with filtering, sorting, and pagination
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        Connection conn = Connect.getConnection();
        
        if (conn == null) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            sendError(response, "Database connection failed. Please check server configuration.");
            return;
        }
        
        try {
            String pathInfo = request.getPathInfo();
            
            // Route: /api/livestock/stats - Get statistics
            if (pathInfo != null && pathInfo.contains("/stats")) {
                getStatistics(conn, response);
                return;
            }
            
            // Route: /api/livestock/search - Search with filters
            String searchTerm = request.getParameter("q");
            String filterType = request.getParameter("filter");
            String sortBy = request.getParameter("sort");
            int page = request.getParameter("page") != null ? Integer.parseInt(request.getParameter("page")) : 0;
            int limit = request.getParameter("limit") != null ? Integer.parseInt(request.getParameter("limit")) : 50;
            
            List<Animal> list = fetchLivestock(conn, searchTerm, filterType, sortBy, page, limit);
            sendAsJson(response, list);
            
        } catch (SQLException e) {
            System.err.println("SQL Error in GET: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Error fetching records: " + e.getMessage());
        } finally {
            try {
                if (conn != null) conn.close();
            } catch (SQLException e) {
                e.printStackTrace();
            }
        }
    }

    // Fetch livestock with advanced filtering
    private List<Animal> fetchLivestock(Connection conn, String search, String filter, String sort, int page, int limit) throws SQLException {
        List<Animal> list = new ArrayList<>();
        StringBuilder sql = new StringBuilder("SELECT * FROM livestock WHERE 1=1");
        
        // Add search filter
        if (search != null && !search.trim().isEmpty()) {
            sql.append(" AND (species ILIKE ? OR breed ILIKE ? OR id_tag ILIKE ?)");
        }
        
        // Add status filter
        if ("healthy".equalsIgnoreCase(filter)) {
            sql.append(" AND health_status = 'Healthy'");
        } else if ("sick".equalsIgnoreCase(filter)) {
            sql.append(" AND health_status != 'Healthy'");
        }
        
        // Add sorting
        if ("age_desc".equals(sort)) {
            sql.append(" ORDER BY age DESC");
        } else if ("weight_desc".equals(sort)) {
            sql.append(" ORDER BY weight DESC");
        } else {
            sql.append(" ORDER BY id DESC");
        }
        
        // Add pagination
        sql.append(" LIMIT ? OFFSET ?");
        
        try (PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {
            int paramIndex = 1;
            if (search != null && !search.trim().isEmpty()) {
                String searchPattern = "%" + search + "%";
                pstmt.setString(paramIndex++, searchPattern);
                pstmt.setString(paramIndex++, searchPattern);
                pstmt.setString(paramIndex++, searchPattern);
            }
            pstmt.setInt(paramIndex++, limit);
            pstmt.setInt(paramIndex, page * limit);
            
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(new Animal(
                            rs.getInt("id"),
                            rs.getString("species"),
                            rs.getString("breed"),
                            rs.getInt("age"),
                            rs.getDouble("weight"),
                            rs.getString("health_status"),
                            rs.getString("gender"),
                            rs.getString("classification"),
                            rs.getString("\"user\""),
                            rs.getTimestamp("registered_at"),
                            rs.getString("date_of_birth"),
                            rs.getString("acquisition_date"),
                            rs.getString("production_type"),
                            rs.getString("vaccination_status"),
                            rs.getString("location"),
                            rs.getString("id_tag"),
                            rs.getString("notes")));
                }
            }
        }
        return list;
    }

    // Get statistics about livestock
    private void getStatistics(Connection conn, HttpServletResponse response) throws SQLException, IOException {
        String sql = "SELECT COUNT(*) as total, " +
                "SUM(CASE WHEN health_status = 'Healthy' THEN 1 ELSE 0 END) as healthy_count, " +
                "SUM(CASE WHEN health_status != 'Healthy' THEN 1 ELSE 0 END) as sick_count, " +
                "COUNT(DISTINCT species) as species_count, " +
                "ROUND(AVG(age)::numeric, 2) as avg_age, " +
                "ROUND(AVG(weight)::numeric, 2) as avg_weight " +
                "FROM livestock";
        
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            if (rs.next()) {
                String json = "{" +
                        "\"total\":" + rs.getInt("total") + "," +
                        "\"healthy\":" + (rs.getInt("healthy_count") == 0 ? 0 : rs.getInt("healthy_count")) + "," +
                        "\"sick\":" + (rs.getInt("sick_count") == 0 ? 0 : rs.getInt("sick_count")) + "," +
                        "\"species_count\":" + rs.getInt("species_count") + "," +
                        "\"avg_age\":" + rs.getDouble("avg_age") + "," +
                        "\"avg_weight\":" + rs.getDouble("avg_weight") +
                        "}";
                sendAsJson(response, json);
            }
        }
    }

    // 2. POST: Save a new livestock record
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        Connection conn = Connect.getConnection();
        
        if (conn == null) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            sendError(response, "Database connection failed.");
            return;
        }
        
        try {
            BufferedReader reader = request.getReader();
            Animal animal = gson.fromJson(reader, Animal.class);

            String sql = "INSERT INTO livestock (species, breed, age, weight, health_status, gender, classification, \"user\", date_of_birth, acquisition_date, production_type, vaccination_status, location, id_tag, notes) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, animal.species);
                pstmt.setString(2, animal.breed);
                pstmt.setInt(3, animal.age);
                pstmt.setDouble(4, animal.weight);
                pstmt.setString(5, animal.health_status);
                pstmt.setString(6, animal.gender);
                pstmt.setString(7, animal.classification);
                pstmt.setString(8, "User");
                pstmt.setString(9, animal.date_of_birth);
                pstmt.setString(10, animal.acquisition_date);
                pstmt.setString(11, animal.production_type);
                pstmt.setString(12, animal.vaccination_status);
                pstmt.setString(13, animal.location);
                pstmt.setString(14, animal.id_tag);
                pstmt.setString(15, animal.notes);
                pstmt.executeUpdate();
                
                response.setStatus(HttpServletResponse.SC_CREATED);
                sendSuccess(response, "Record saved successfully");
            }
        } catch (SQLException e) {
            System.err.println("SQL Error in POST: " + e.getMessage());
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Error saving record: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Error in POST: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "Invalid request format");
        } finally {
            try {
                if (conn != null) conn.close();
            } catch (SQLException e) {
                e.printStackTrace();
            }
        }
    }

    // 3. PUT: Update an existing record
    protected void doPut(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.length() <= 1) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "ID is required");
            return;
        }
        
        Connection conn = Connect.getConnection();
        if (conn == null) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            sendError(response, "Database connection failed.");
            return;
        }
        
        try {
            int id = Integer.parseInt(pathInfo.substring(1));
            BufferedReader reader = request.getReader();
            Animal animal = gson.fromJson(reader, Animal.class);

            String sql = "UPDATE livestock SET species = ?, breed = ?, age = ?, weight = ?, health_status = ?, gender = ?, classification = ?, date_of_birth = ?, acquisition_date = ?, production_type = ?, vaccination_status = ?, location = ?, id_tag = ?, notes = ? WHERE id = ?";
            
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, animal.species);
                pstmt.setString(2, animal.breed);
                pstmt.setInt(3, animal.age);
                pstmt.setDouble(4, animal.weight);
                pstmt.setString(5, animal.health_status);
                pstmt.setString(6, animal.gender);
                pstmt.setString(7, animal.classification);
                pstmt.setString(8, animal.date_of_birth);
                pstmt.setString(9, animal.acquisition_date);
                pstmt.setString(10, animal.production_type);
                pstmt.setString(11, animal.vaccination_status);
                pstmt.setString(12, animal.location);
                pstmt.setString(13, animal.id_tag);
                pstmt.setString(14, animal.notes);
                pstmt.setInt(15, id);
                pstmt.executeUpdate();
                
                response.setStatus(HttpServletResponse.SC_OK);
                sendSuccess(response, "Record updated successfully");
            }
        } catch (SQLException e) {
            System.err.println("SQL Error in PUT: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Error updating record: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Error in PUT: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "Invalid request format");
        } finally {
            try {
                if (conn != null) conn.close();
            } catch (SQLException e) {
                e.printStackTrace();
            }
        }
    }

    // 4. DELETE: Remove a record
    protected void doDelete(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.length() <= 1) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "ID is required");
            return;
        }
        
        Connection conn = Connect.getConnection();
        if (conn == null) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            sendError(response, "Database connection failed.");
            return;
        }
        
        try {
            int id = Integer.parseInt(pathInfo.substring(1));
            try (PreparedStatement pstmt = conn.prepareStatement("DELETE FROM livestock WHERE id = ?")) {
                pstmt.setInt(1, id);
                pstmt.executeUpdate();
                
                response.setStatus(HttpServletResponse.SC_OK);
                sendSuccess(response, "Record deleted successfully");
            }
        } catch (SQLException e) {
            System.err.println("SQL Error in DELETE: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Error deleting record: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Error in DELETE: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "Invalid request format");
        } finally {
            try {
                if (conn != null) conn.close();
            } catch (SQLException e) {
                e.printStackTrace();
            }
        }
    }

    private void sendAsJson(HttpServletResponse response, Object obj) throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        if (obj instanceof String) {
            out.print(obj);
        } else {
            out.print(gson.toJson(obj));
        }
        out.flush();
    }
    
    private void sendSuccess(HttpServletResponse response, String message) throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        out.print("{\"status\":\"success\",\"message\":\"" + escapeJson(message) + "\"}");
        out.flush();
    }
    
    private void sendError(HttpServletResponse response, String message) throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        PrintWriter out = response.getWriter();
        out.print("{\"error\":\"" + escapeJson(message) + "\"}");
        out.flush();
    }
    
    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }

    // Simple Inner Class to map Data
    private static class Animal {
        int id;
        String species, breed, health_status, gender, classification, user;
        String date_of_birth, acquisition_date, production_type, vaccination_status, location, id_tag, notes;
        int age;
        double weight;
        Timestamp date;

        Animal(int id, String s, String b, int a, double w, String h, String g, String c, String u, Timestamp d,
               String dob, String ad, String pt, String vs, String loc, String it, String n) {
            this.id = id;
            this.species = s;
            this.breed = b;
            this.age = a;
            this.weight = w;
            this.health_status = h;
            this.gender = g;
            this.classification = c;
            this.user = u;
            this.date = d;
            this.date_of_birth = dob;
            this.acquisition_date = ad;
            this.production_type = pt;
            this.vaccination_status = vs;
            this.location = loc;
            this.id_tag = it;
            this.notes = n;
        }
    }
}
