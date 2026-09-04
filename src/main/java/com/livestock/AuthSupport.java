package com.livestock;

import java.io.FileInputStream;
import java.util.Properties;
import javax.servlet.http.HttpSession;
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
        String role = currentUserRole(session);
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
        return "USER";
    }
}
