import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

@WebServlet("/api/auth/*")
public class AuthServlet extends HttpServlet {
    private static final Gson GSON = new Gson();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        String pathInfo = request.getPathInfo();

        if (pathInfo == null || "/session".equals(pathInfo)) {
            sendSession(response, request.getSession(false));
            return;
        }

        if ("/config".equals(pathInfo)) {
            String googleClientId = getConfigValue("GOOGLE_CLIENT_ID");
            if (googleClientId == null || googleClientId.isBlank()) {
                response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                sendError(response, "GOOGLE_CLIENT_ID is not configured");
                return;
            }
            sendAsJson(response, Map.of("googleClientId", googleClientId));
            return;
        }

        if ("/users".equals(pathInfo)) {
            HttpSession session = request.getSession(false);
            if (!isAdmin(session)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                sendError(response, "Administrator access required");
                return;
            }

            try (Connection conn = Connect.getConnection()) {
                if (conn == null) {
                    response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                    sendError(response, "Database connection failed");
                    return;
                }

                List<Map<String, Object>> users = new ArrayList<>();
                try (PreparedStatement ps = conn.prepareStatement(
                        "SELECT id, email, role, created_at, last_login FROM users ORDER BY email ASC");
                     ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> user = new HashMap<>();
                        user.put("id", rs.getInt("id"));
                        user.put("email", rs.getString("email"));
                        user.put("role", rs.getString("role"));
                        user.put("created_at", rs.getTimestamp("created_at"));
                        user.put("last_login", rs.getTimestamp("last_login"));
                        users.add(user);
                    }
                }
                sendAsJson(response, users);
                return;
            } catch (SQLException e) {
                System.err.println("Failed to load users: " + e.getMessage());
                response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                sendError(response, "Failed to load users");
                return;
            }
        }

        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        sendError(response, "Not found");
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        String pathInfo = request.getPathInfo();

        if ("/logout".equals(pathInfo)) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            sendAsJson(response, Map.of("status", "success"));
            return;
        }

        if (pathInfo != null && !"/google".equals(pathInfo)) {
            response.setStatus(HttpServletResponse.SC_NOT_FOUND);
            sendError(response, "Not found");
            return;
        }

        String clientId = getConfigValue("GOOGLE_CLIENT_ID");
        if (clientId == null || clientId.isBlank()) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            sendError(response, "GOOGLE_CLIENT_ID is not configured");
            return;
        }

        try {
            BufferedReader reader = request.getReader();
            JsonObject input = JsonParser.parseReader(reader).getAsJsonObject();
            String credential = input.has("credential") ? input.get("credential").getAsString() : null;

            if (credential == null || credential.isBlank()) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                sendError(response, "Missing Google credential token");
                return;
            }

            GoogleTokenInfo tokenInfo = validateToken(credential, clientId);
            if (tokenInfo == null || tokenInfo.email == null || tokenInfo.email.isBlank()) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                sendError(response, "Invalid Google token");
                return;
            }

            try (Connection conn = Connect.getConnection()) {
                if (conn == null) {
                    response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                    sendError(response, "Database connection failed");
                    return;
                }

                String role = upsertUserAndResolveRole(conn, tokenInfo.email, tokenInfo.sub);

                HttpSession session = request.getSession(true);
                session.setAttribute("userEmail", tokenInfo.email);
                session.setAttribute("userRole", role);

                Map<String, String> auth = new HashMap<>();
                auth.put("email", tokenInfo.email);
                auth.put("role", role);
                sendAsJson(response, auth);
            }
        } catch (Exception e) {
            System.err.println("Authentication failed: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Authentication failed");
        }
    }

    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
        response.setContentType("application/json;charset=UTF-8");
        HttpSession session = request.getSession(false);
        if (!isAdmin(session)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            sendError(response, "Administrator access required");
            return;
        }

        String pathInfo = request.getPathInfo();
        if (pathInfo == null || !pathInfo.startsWith("/users/")) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "Path must be /api/auth/users/{email}");
            return;
        }

        String email = URLDecoder.decode(pathInfo.substring("/users/".length()), StandardCharsets.UTF_8);
        if (email.isBlank()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            sendError(response, "User email is required");
            return;
        }

        try {
            BufferedReader reader = request.getReader();
            JsonObject input = JsonParser.parseReader(reader).getAsJsonObject();
            String role = input.has("role") ? input.get("role").getAsString() : "";
            role = role == null ? "" : role.trim().toUpperCase();

            if (!"ADMIN".equals(role) && !"USER".equals(role)) {
                response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                sendError(response, "Role must be ADMIN or USER");
                return;
            }

            try (Connection conn = Connect.getConnection()) {
                if (conn == null) {
                    response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                    sendError(response, "Database connection failed");
                    return;
                }

                try (PreparedStatement ps = conn.prepareStatement("UPDATE users SET role = ? WHERE email = ?")) {
                    ps.setString(1, role);
                    ps.setString(2, email);
                    int rows = ps.executeUpdate();
                    if (rows == 0) {
                        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                        sendError(response, "User not found");
                        return;
                    }
                }
            }

            sendAsJson(response, Map.of("status", "success"));
        } catch (Exception e) {
            System.err.println("Failed to update user role: " + e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            sendError(response, "Failed to update user role");
        }
    }

    private GoogleTokenInfo validateToken(String idToken, String expectedAudience) throws Exception {
        String encoded = URLEncoder.encode(idToken, StandardCharsets.UTF_8);
        URI uri = URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=" + encoded);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(uri)
                .GET()
                .build();

        HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            return null;
        }

        JsonObject obj = JsonParser.parseString(response.body()).getAsJsonObject();
        String aud = obj.has("aud") ? obj.get("aud").getAsString() : null;
        String email = obj.has("email") ? obj.get("email").getAsString() : null;
        String verified = obj.has("email_verified") ? obj.get("email_verified").getAsString() : "false";
        String sub = obj.has("sub") ? obj.get("sub").getAsString() : null;

        if (!expectedAudience.equals(aud) || !"true".equalsIgnoreCase(verified)) {
            return null;
        }

        GoogleTokenInfo info = new GoogleTokenInfo();
        info.email = email;
        info.sub = sub;
        return info;
    }

    private String upsertUserAndResolveRole(Connection conn, String email, String googleId) throws SQLException {
        boolean isAdminEmail = isAdminEmail(email);

        try (PreparedStatement select = conn.prepareStatement("SELECT role FROM users WHERE email = ?")) {
            select.setString(1, email);
            try (ResultSet rs = select.executeQuery()) {
                if (rs.next()) {
                    String existingRole = rs.getString("role");
                    String roleToUse = existingRole == null || existingRole.isBlank() ? "USER" : existingRole.toUpperCase();
                    if (isAdminEmail && !"ADMIN".equals(roleToUse)) {
                        roleToUse = "ADMIN";
                        try (PreparedStatement updateRole = conn.prepareStatement("UPDATE users SET role = ?, google_id = COALESCE(?, google_id), last_login = ? WHERE email = ?")) {
                            updateRole.setString(1, roleToUse);
                            updateRole.setString(2, googleId);
                            updateRole.setTimestamp(3, new Timestamp(System.currentTimeMillis()));
                            updateRole.setString(4, email);
                            updateRole.executeUpdate();
                        }
                    } else {
                        try (PreparedStatement updateLogin = conn.prepareStatement("UPDATE users SET google_id = COALESCE(?, google_id), last_login = ? WHERE email = ?")) {
                            updateLogin.setString(1, googleId);
                            updateLogin.setTimestamp(2, new Timestamp(System.currentTimeMillis()));
                            updateLogin.setString(3, email);
                            updateLogin.executeUpdate();
                        }
                    }
                    return roleToUse;
                }
            }
        }

        String role = isAdminEmail ? "ADMIN" : "USER";
        try {
            insertNewUser(conn, email, googleId, role);
        } catch (SQLException e) {
            // A legacy users table may still carry a NOT NULL / PRIMARY KEY on
            // google_id (or an unexpected column ordering). Re-run the schema
            // reconciliation once and retry before giving up on the login.
            Connect.reconcileSchema(conn);
            insertNewUser(conn, email, googleId, role);
        }
        return role;
    }

    private void insertNewUser(Connection conn, String email, String googleId, String role) throws SQLException {
        try (PreparedStatement insert = conn.prepareStatement("INSERT INTO users (email, google_id, role, last_login) VALUES (?, ?, ?, ?)") ) {
            insert.setString(1, email);
            insert.setString(2, googleId);
            insert.setString(3, role);
            insert.setTimestamp(4, new Timestamp(System.currentTimeMillis()));
            insert.executeUpdate();
        }
    }

    private boolean isAdminEmail(String email) {
        String adminEmails = getConfigValue("ADMIN_EMAILS");
        if (adminEmails == null || adminEmails.isBlank() || email == null) {
            return false;
        }

        String normalized = email.trim().toLowerCase();
        String[] configured = adminEmails.split(",");
        for (String candidate : configured) {
            if (normalized.equals(candidate.trim().toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    private String getConfigValue(String key) {
        String value = System.getenv(key);
        if (value != null && !value.isBlank()) {
            return value;
        }

        Properties props = new Properties();
        try (FileInputStream fis = new FileInputStream("local.properties")) {
            props.load(fis);
            value = props.getProperty(key);
            if (value == null) {
                return null;
            }
            value = value.trim();
            if (!value.isEmpty()) {
                return value;
            }
        } catch (Exception e) {
            // Ignore and fall back to database-backed config
        }

        return getConfigValueFromDatabase(key);
    }

    private String getConfigValueFromDatabase(String key) {
        String[] queries = new String[] {
                "SELECT value FROM app_config WHERE key = ?",
                "SELECT config_value FROM app_config WHERE config_key = ?",
                "SELECT value FROM settings WHERE key = ?",
                "SELECT config_value FROM settings WHERE config_key = ?"
        };

        try (Connection conn = Connect.getConnection()) {
            if (conn == null) {
                return null;
            }

            for (String query : queries) {
                try (PreparedStatement statement = conn.prepareStatement(query)) {
                    statement.setString(1, key);
                    try (ResultSet rs = statement.executeQuery()) {
                        if (!rs.next()) {
                            continue;
                        }
                        String value = rs.getString(1);
                        if (value != null && !value.trim().isEmpty()) {
                            return value.trim();
                        }
                    }
                } catch (SQLException ignored) {
                    // Try the next query/table naming variant
                }
            }
        } catch (SQLException ignored) {
            return null;
        }

        return null;
    }

    private boolean isAdmin(HttpSession session) {
        if (session == null) {
            return false;
        }
        String role = (String) session.getAttribute("userRole");
        return "ADMIN".equalsIgnoreCase(role);
    }

    private void sendSession(HttpServletResponse response, HttpSession session) throws IOException {
        if (session == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            sendError(response, "Not authenticated");
            return;
        }

        String email = (String) session.getAttribute("userEmail");
        String role = (String) session.getAttribute("userRole");
        if (email == null || role == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            sendError(response, "Not authenticated");
            return;
        }

        sendAsJson(response, Map.of("email", email, "role", role));
    }

    private void sendAsJson(HttpServletResponse response, Object obj) throws IOException {
        response.getWriter().print(GSON.toJson(obj));
    }

    private void sendError(HttpServletResponse response, String message) throws IOException {
        response.getWriter().print("{\"error\":\"" + escapeJson(message) + "\"}");
    }

    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private static class GoogleTokenInfo {
        String email;
        String sub;
    }
}
