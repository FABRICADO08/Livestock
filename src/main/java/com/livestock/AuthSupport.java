package com.livestock;

import java.io.FileInputStream;
import java.util.Optional;
import java.util.Properties;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Shared helpers for session-based authentication and configuration lookup.
 * Configuration values are resolved from environment variables first, then
 * from the optional local.properties file at the application root.
 */
@Component
public class AuthSupport {

    private final ObjectProvider<UserRepository> userRepository;

    public AuthSupport(ObjectProvider<UserRepository> userRepository) {
        this.userRepository = userRepository;
    }

    public String getConfigValue(String key) {
        String value = System.getenv(key);
        if (value != null && !value.isBlank()) {
            return value;
        }

        Properties props = new Properties();
        try (FileInputStream fis = new FileInputStream("local.properties")) {
            props.load(fis);
            value = props.getProperty(key);
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        } catch (Exception e) {
            // Ignore: local.properties is optional
        }

        return null;
    }

    public String currentUserEmail(HttpSession session) {
        Object email = session == null ? null : session.getAttribute("userEmail");
        return email instanceof String ? (String) email : null;
    }

    public String currentUserRole(HttpSession session) {
        Object role = session == null ? null : session.getAttribute("userRole");
        return role instanceof String ? (String) role : null;
    }

    public String requireEmail(HttpSession session) {
        String email = currentUserEmail(session);
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return email;
    }

    public void requireAdmin(HttpSession session) {
        String email = currentUserEmail(session);
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        // Resolve the role from the database rather than trusting the session
        // attribute, so role changes (or a stale session) do not lock admins
        // out of the sellers list.
        String role = resolveRole(email, currentUserRole(session));
        session.setAttribute("userRole", role);
        if (!"ADMIN".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access required");
        }
    }

    public String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "USER";
        }
        String normalized = role.trim().toUpperCase();
        if ("ADMIN".equals(normalized) || "ADMINISTRATOR".equals(normalized)) {
            return "ADMIN";
        }
        if ("BUYER".equals(normalized) || "CUSTOMER".equals(normalized)) {
            return "BUYER";
        }
        return "USER";
    }

    public boolean isValidRole(String role) {
        if (role == null || role.isBlank()) {
            return false;
        }
        String normalized = role.trim().toUpperCase();
        return "ADMIN".equals(normalized) || "USER".equals(normalized) || "BUYER".equals(normalized);
    }

    private String resolveRole(String email, String fallbackRole) {
        UserRepository repo = userRepository.getIfAvailable();
        if (repo != null) {
            Optional<User> user = repo.findAll().stream()
                    .filter(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase(email))
                    .findFirst();
            if (user.isPresent()) {
                return normalizeRole(user.get().getRole());
            }
        }
        return normalizeRole(fallbackRole);
    }
}
