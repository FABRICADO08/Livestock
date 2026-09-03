import com.google.gson.Gson;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

@WebServlet("/api/livestock/*")
public class LivestockServlet extends HttpServlet {
    private final Gson gson = new Gson();

    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("application/json;charset=UTF-8");

        try (Connection conn = Connect.getConnection()) {
            if (conn == null) {
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                sendError(response, "Database connection failed. Please check server configuration and logs.");
                return;
            }

            String pathInfo = request.getPathInfo();

            if (pathInfo != null && pathInfo.contains("/stats")) {
                getStatistics(conn, response);
                return;
            }

            String searchTerm = request.getParameter("q");
            String filterType = request.getParameter("filter");
            String sortBy = request.getParameter("sort");
            int page = request.getParameter("page") != null ? Integer.parseInt(request.getParameter("page")) : 0;
            int limit = request.getParameter("limit") != null ? Integer.parseInt(request.getParameter("limit")) : 50;

            List<Animal> list = fetchLivestock(conn, searchTerm, filterType, sortBy, page, limit);
            sendAsJson(response, list);

        } catch (SQLException e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "SQL Error: " + e.getMessage());
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Error: " + e.getMessage());
        }
    }

    private List<Animal> fetchLivestock(Connection conn, String search, String filter, String sort, int page, int limit) throws SQLException {
        List<Animal> list = new ArrayList<>();
        StringBuilder sql = new StringBuilder("SELECT * FROM livestock WHERE 1=1");

        if (search != null && !search.trim().isEmpty()) {
            sql.append(" AND (species ILIKE ? OR breed ILIKE ? OR id_tag ILIKE ?)");
        }

        if ("healthy".equalsIgnoreCase(filter)) {
            sql.append(" AND health_status = 'Healthy'");
        } else if ("sick".equalsIgnoreCase(filter)) {
            sql.append(" AND health_status != 'Healthy'");
        }

        if ("age_desc".equals(sort)) {
            sql.append(" ORDER BY age DESC");
        } else if ("weight_desc".equals(sort)) {
            sql.append(" ORDER BY weight DESC");
        } else {
            sql.append(" ORDER BY id DESC");
        }

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
                    Animal animal = new Animal(
                            rs.getInt("id"),
                            rs.getString("species"),
                            rs.getString("breed"),
                            rs.getInt("age"),
                            rs.getDouble("weight"),
                            rs.getString("health_status"),
                            rs.getString("gender") != null ? rs.getString("gender") : "N/A",
                            rs.getString("classification") != null ? rs.getString("classification") : "N/A",
                            rs.getTimestamp("registration_date"),
                            rs.getString("date_of_birth"),
                            rs.getString("acquisition_date"),
                            rs.getString("production_type"),
                            rs.getString("vaccination_status"),
                            rs.getString("location"),
                            rs.getString("id_tag"),
                            rs.getString("notes"),
                            rs.getString("created_by"),
                            rs.getString("updated_by"),
                            rs.getTimestamp("created_at"),
                            rs.getTimestamp("updated_at")
                    );
                    list.add(animal);
                }
            }
        }
        return list;
    }

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

    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("application/json;charset=UTF-8");

        String currentEmail = getCurrentUserEmail(request);
        if (currentEmail == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            sendError(response, "Authentication required");
            return;
        }

        try (Connection conn = Connect.getConnection()) {
            if (conn == null) {
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                sendError(response, "Database connection failed.");
                return;
            }

            BufferedReader reader = request.getReader();
            Animal animal = gson.fromJson(reader, Animal.class);
            Integer computedAge = calculateAgeFromDateOfBirth(animal.date_of_birth);
            if (computedAge == null) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                sendError(response, "Date of birth is required in YYYY-MM-DD format and cannot be in the future");
                return;
            }

            String sql = "INSERT INTO livestock (species, breed, age, weight, health_status, gender, classification, date_of_birth, acquisition_date, production_type, vaccination_status, location, id_tag, notes, created_by, updated_by, created_at, updated_at) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";

            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, animal.species);
                pstmt.setString(2, animal.breed);
                pstmt.setInt(3, computedAge);
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
                pstmt.setString(15, currentEmail);
                pstmt.setString(16, currentEmail);

                pstmt.executeUpdate();

                response.setStatus(HttpServletResponse.SC_CREATED);
                sendSuccess(response, "Record saved successfully");
            }
        } catch (SQLException e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Error saving record: " + e.getMessage());
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "Invalid request format: " + e.getMessage());
        }
    }

    protected void doPut(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("application/json;charset=UTF-8");

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.length() <= 1) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "ID is required");
            return;
        }

        String currentEmail = getCurrentUserEmail(request);
        String currentRole = getCurrentUserRole(request);
        if (currentEmail == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            sendError(response, "Authentication required");
            return;
        }

        try (Connection conn = Connect.getConnection()) {
            if (conn == null) {
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                sendError(response, "Database connection failed.");
                return;
            }

            int id = Integer.parseInt(pathInfo.substring(1));
            Ownership ownership = findOwnership(conn, id);
            if (!ownership.exists) {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                sendError(response, "Record not found");
                return;
            }

            if (!"ADMIN".equalsIgnoreCase(currentRole)
                    && (ownership.createdBy == null || !currentEmail.equalsIgnoreCase(ownership.createdBy))) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                sendError(response, "You can only edit your own records");
                return;
            }

            BufferedReader reader = request.getReader();
            Animal animal = gson.fromJson(reader, Animal.class);
            Integer computedAge = calculateAgeFromDateOfBirth(animal.date_of_birth);
            if (computedAge == null) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                sendError(response, "Date of birth is required in YYYY-MM-DD format and cannot be in the future");
                return;
            }

            String sql = "UPDATE livestock SET species = ?, breed = ?, age = ?, weight = ?, health_status = ?, gender = ?, classification = ?, date_of_birth = ?, acquisition_date = ?, production_type = ?, vaccination_status = ?, location = ?, id_tag = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";

            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, animal.species);
                pstmt.setString(2, animal.breed);
                pstmt.setInt(3, computedAge);
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
                pstmt.setString(15, currentEmail);
                pstmt.setInt(16, id);

                pstmt.executeUpdate();

                response.setStatus(HttpServletResponse.SC_OK);
                sendSuccess(response, "Record updated successfully");
            }
        } catch (SQLException e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Error updating record: " + e.getMessage());
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "Invalid request format");
        }
    }

    protected void doDelete(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("application/json;charset=UTF-8");

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || pathInfo.length() <= 1) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "ID is required");
            return;
        }

        String currentEmail = getCurrentUserEmail(request);
        String currentRole = getCurrentUserRole(request);
        if (currentEmail == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            sendError(response, "Authentication required");
            return;
        }

        try (Connection conn = Connect.getConnection()) {
            if (conn == null) {
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                sendError(response, "Database connection failed.");
                return;
            }

            int id = Integer.parseInt(pathInfo.substring(1));
            Ownership ownership = findOwnership(conn, id);
            if (!ownership.exists) {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                sendError(response, "Record not found");
                return;
            }

            if (!"ADMIN".equalsIgnoreCase(currentRole)
                    && (ownership.createdBy == null || !currentEmail.equalsIgnoreCase(ownership.createdBy))) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                sendError(response, "You can only delete your own records");
                return;
            }

            try (PreparedStatement pstmt = conn.prepareStatement("DELETE FROM livestock WHERE id = ?")) {
                pstmt.setInt(1, id);
                pstmt.executeUpdate();

                response.setStatus(HttpServletResponse.SC_OK);
                sendSuccess(response, "Record deleted successfully");
            }
        } catch (SQLException e) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Error deleting record: " + e.getMessage());
        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "Invalid request format");
        }
    }

    private Ownership findOwnership(Connection conn, int id) throws SQLException {
        try (PreparedStatement pstmt = conn.prepareStatement("SELECT created_by FROM livestock WHERE id = ?")) {
            pstmt.setInt(1, id);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    Ownership ownership = new Ownership();
                    ownership.exists = true;
                    ownership.createdBy = rs.getString("created_by");
                    return ownership;
                }
            }
        }
        Ownership ownership = new Ownership();
        ownership.exists = false;
        return ownership;
    }

    private Integer calculateAgeFromDateOfBirth(String dateOfBirth) {
        if (dateOfBirth == null || dateOfBirth.isBlank()) {
            return null;
        }
        try {
            LocalDate dob = LocalDate.parse(dateOfBirth.trim());
            LocalDate today = LocalDate.now();
            if (dob.isAfter(today)) {
                return null;
            }
            return Period.between(dob, today).getYears();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String getCurrentUserEmail(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : (String) session.getAttribute("userEmail");
    }

    private String getCurrentUserRole(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : (String) session.getAttribute("userRole");
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

    private static class Ownership {
        boolean exists;
        String createdBy;
    }

    private static class Animal {
        int id;
        String species, breed, health_status, gender, classification;
        String date_of_birth, acquisition_date, production_type, vaccination_status, location, id_tag, notes;
        int age;
        double weight;
        Timestamp date;
        String created_by;
        String updated_by;
        Timestamp created_at;
        Timestamp updated_at;

        Animal(int id, String s, String b, int a, double w, String h, String g, String c, Timestamp d,
               String dob, String ad, String pt, String vs, String loc, String it, String n,
               String createdBy, String updatedBy, Timestamp createdAt, Timestamp updatedAt) {
            this.id = id;
            this.species = s;
            this.breed = b;
            this.age = a;
            this.weight = w;
            this.health_status = h;
            this.gender = g;
            this.classification = c;
            this.date = d;
            this.date_of_birth = dob;
            this.acquisition_date = ad;
            this.production_type = pt;
            this.vaccination_status = vs;
            this.location = loc;
            this.id_tag = it;
            this.notes = n;
            this.created_by = createdBy;
            this.updated_by = updatedBy;
            this.created_at = createdAt;
            this.updated_at = updatedAt;
        }
    }
}
