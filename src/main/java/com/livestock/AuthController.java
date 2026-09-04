package com.livestock;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import javax.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final AuthSupport auth;

    public AuthController(UserRepository userRepository, AuthSupport auth) {
        this.userRepository = userRepository;
        this.auth = auth;
    }

    @GetMapping({"", "/", "/session"})
    public Map<String, String> session(HttpSession session) {
        String email = auth.currentUserEmail(session);
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        String role = resolveRoleFromDatabase(email, auth.currentUserRole(session));
        session.setAttribute("userRole", role);
        String picture = (String) session.getAttribute("userPicture");

        Map<String, String> body = new HashMap<>();
        body.put("email", email);
        body.put("role", role);
        if (picture != null && !picture.isBlank()) {
            body.put("picture", picture);
        }
        return body;
    }

    @GetMapping("/config")
    public Map<String, String> config() {
        String googleClientId = auth.getConfigValue("GOOGLE_CLIENT_ID");
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "GOOGLE_CLIENT_ID is not configured");
        }
        return Map.of("googleClientId", googleClientId);
    }

    @GetMapping("/users")
    public List<Map<String, Object>> users(HttpSession session) {
        auth.requireAdmin(session);
        return userRepository.findAll().stream()
                .sorted((a, b) -> {
                    String ea = a.getEmail() == null ? "" : a.getEmail();
                    String eb = b.getEmail() == null ? "" : b.getEmail();
                    return ea.compareToIgnoreCase(eb);
                })
                .map(u -> {
                    Map<String, Object> json = new HashMap<>();
                    json.put("id", u.getId());
                    json.put("email", u.getEmail());
                    json.put("role", u.getRole());
                    json.put("created_at", u.getCreatedAt());
                    json.put("last_login", u.getLastLogin());
                    return json;
                })
                .collect(Collectors.toList());
    }

    @PostMapping({"/google", "", "/"})
    public Map<String, String> google(@RequestBody Map<String, String> input, HttpSession session) {
        String clientId = auth.getConfigValue("GOOGLE_CLIENT_ID");
        if (clientId == null || clientId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "GOOGLE_CLIENT_ID is not configured");
        }

        String credential = input.get("credential");
        if (credential == null || credential.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing Google credential token");
        }

        GoogleTokenInfo tokenInfo = validateToken(credential, clientId);
        if (tokenInfo == null || tokenInfo.email == null || tokenInfo.email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google token");
        }

        String role = upsertUserAndResolveRole(tokenInfo.email, tokenInfo.sub);

        session.setAttribute("userEmail", tokenInfo.email);
        session.setAttribute("userRole", role);
        session.setAttribute("userPicture", tokenInfo.picture);

        Map<String, String> body = new HashMap<>();
        body.put("email", tokenInfo.email);
        body.put("role", role);
        if (tokenInfo.picture != null && !tokenInfo.picture.isBlank()) {
            body.put("picture", tokenInfo.picture);
        }
        return body;
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpSession session) {
        if (session != null) {
            session.invalidate();
        }
        return Map.of("status", "success");
    }

    @PutMapping("/users/{email}")
    public Map<String, String> updateRole(@PathVariable("email") String email,
                                          @RequestBody Map<String, String> input,
                                          HttpSession session) {
        auth.requireAdmin(session);
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User email is required");
        }

        String role = input.getOrDefault("role", "");
        role = role == null ? "" : role.trim().toUpperCase();
        if (!"ADMIN".equals(role) && !"USER".equals(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role must be ADMIN or USER");
        }

        Optional<User> user = findByEmail(email);
        if (user.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        User existing = user.get();
        existing.setRole(role);
        userRepository.save(existing);
        return Map.of("status", "success");
    }

    private GoogleTokenInfo validateToken(String idToken, String expectedAudience) {
        try {
            String encoded = URLEncoder.encode(idToken, StandardCharsets.UTF_8);
            URI uri = URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=" + encoded);

            HttpRequest request = HttpRequest.newBuilder().uri(uri).GET().build();
            HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return null;
            }

            JsonObject obj = JsonParser.parseString(response.body()).getAsJsonObject();
            String aud = obj.has("aud") ? obj.get("aud").getAsString() : null;
            String email = obj.has("email") ? obj.get("email").getAsString() : null;
            String verified = obj.has("email_verified") ? obj.get("email_verified").getAsString() : "false";
            String sub = obj.has("sub") ? obj.get("sub").getAsString() : null;
            String picture = obj.has("picture") ? obj.get("picture").getAsString() : null;

            if (!expectedAudience.equals(aud) || !"true".equalsIgnoreCase(verified)) {
                return null;
            }

            GoogleTokenInfo info = new GoogleTokenInfo();
            info.email = email;
            info.sub = sub;
            info.picture = picture;
            return info;
        } catch (Exception e) {
            System.err.println("Google token validation failed: " + e.getMessage());
            return null;
        }
    }

    private String upsertUserAndResolveRole(String email, String googleId) {
        boolean isAdminEmail = isAdminEmail(email);
        Date now = new Date();

        Optional<User> existing = findByEmail(email);
        if (existing.isPresent()) {
            User user = existing.get();
            String roleToUse = isAdminEmail ? "ADMIN" : auth.normalizeRole(user.getRole());
            user.setRole(roleToUse);
            if (user.getGoogleId() == null || user.getGoogleId().isBlank()) {
                user.setGoogleId(googleId);
            }
            user.setLastLogin(now);
            userRepository.save(user);
            return roleToUse;
        }

        User user = new User();
        user.setEmail(email);
        user.setGoogleId(googleId);
        user.setRole(isAdminEmail ? "ADMIN" : "USER");
        user.setCreatedAt(now);
        user.setLastLogin(now);
        userRepository.save(user);
        return user.getRole();
    }

    private Optional<User> findByEmail(String email) {
        if (email == null) {
            return Optional.empty();
        }
        return userRepository.findAll().stream()
                .filter(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase(email))
                .findFirst();
    }

    private String resolveRoleFromDatabase(String email, String fallbackRole) {
        return findByEmail(email)
                .map(u -> auth.normalizeRole(u.getRole()))
                .orElse(auth.normalizeRole(fallbackRole));
    }

    private boolean isAdminEmail(String email) {
        String adminEmails = auth.getConfigValue("ADMIN_EMAILS");
        if (adminEmails == null || adminEmails.isBlank() || email == null) {
            return false;
        }
        String normalized = email.trim().toLowerCase();
        for (String candidate : adminEmails.split(",")) {
            if (normalized.equals(candidate.trim().toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    private static class GoogleTokenInfo {
        String email;
        String sub;
        String picture;
    }
}
