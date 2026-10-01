package com.livestock;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * In-app notifications: the signed-in user lists their own notifications
 * (newest first) and marks them read. Unread counts power the navbar badge.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private static final int MAX_NOTIFICATIONS = 50;

    private final NotificationRepository notificationRepository;
    private final AuthSupport auth;

    public NotificationController(NotificationRepository notificationRepository, AuthSupport auth) {
        this.notificationRepository = notificationRepository;
        this.auth = auth;
    }

    @GetMapping({"", "/"})
    public List<Map<String, Object>> list(HttpSession session) {
        String email = auth.requireEmail(session);
        return notificationRepository.findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc(email)
                .stream()
                .sorted(Comparator.comparing(Notification::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_NOTIFICATIONS)
                .map(this::toJson)
                .collect(Collectors.toList());
    }

    @GetMapping("/unread-count")
    public Map<String, Object> unreadCount(HttpSession session) {
        String email = auth.requireEmail(session);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("unread", notificationRepository.countByRecipientEmailIgnoreCaseAndReadFalse(email));
        return body;
    }

    @PutMapping("/{id}/read")
    public Map<String, Object> markRead(@PathVariable("id") String id, HttpSession session) {
        String email = auth.requireEmail(session);
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        if (notification.getRecipientEmail() == null
                || !notification.getRecipientEmail().equalsIgnoreCase(email.trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only update your own notifications");
        }
        if (!notification.isRead()) {
            notification.setRead(true);
            notificationRepository.save(notification);
        }
        return Map.of("status", "success");
    }

    @PutMapping("/read-all")
    public Map<String, Object> markAllRead(HttpSession session) {
        String email = auth.requireEmail(session);
        List<Notification> unread = notificationRepository
                .findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc(email).stream()
                .filter(n -> !n.isRead())
                .collect(Collectors.toList());
        unread.forEach(n -> n.setRead(true));
        if (!unread.isEmpty()) {
            notificationRepository.saveAll(unread);
        }
        return Map.of("status", "success", "updated", String.valueOf(unread.size()));
    }

    private Map<String, Object> toJson(Notification n) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", n.getId());
        json.put("type", n.getType());
        json.put("title", n.getTitle());
        json.put("message", n.getMessage());
        json.put("link", n.getLink());
        json.put("read", n.isRead());
        json.put("created_at", n.getCreatedAt());
        return json;
    }
}
