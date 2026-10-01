package com.livestock;

import java.util.Date;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * Creates in-app notifications. Failures are logged and never break the
 * surrounding workflow (mirrors EmailSupport's best-effort behaviour) so a
 * notification problem can never block a purchase or health record.
 */
@Component
public class NotificationSupport {

    private static final Logger log = LoggerFactory.getLogger(NotificationSupport.class);

    private final NotificationRepository notificationRepository;
    private final MongoTemplate mongoTemplate;

    public NotificationSupport(NotificationRepository notificationRepository, MongoTemplate mongoTemplate) {
        this.notificationRepository = notificationRepository;
        this.mongoTemplate = mongoTemplate;
    }

    /** Stores a notification for a single recipient; no-op on blank email. */
    public void notify(String recipientEmail, String type, String title, String message, String link) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return;
        }
        try {
            Notification notification = new Notification();
            notification.setRecipientEmail(recipientEmail.trim().toLowerCase());
            notification.setType(type);
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setLink(link);
            notification.setCreatedAt(new Date());
            notificationRepository.save(notification);
        } catch (Exception e) {
            log.warn("Could not store notification for {}: {}", recipientEmail, e.getMessage());
        }
    }

    /**
     * Stores a vaccination reminder for the owner unless an unread reminder
     * for the same animal already exists (avoids duplicating reminders).
     */
    public void notifyVaccinationDue(String recipientEmail, String animalSummary, String link) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return;
        }
        try {
            Pattern exactLink = Pattern.compile("^" + Pattern.quote(link == null ? "" : link) + "$");
            boolean exists = mongoTemplate.exists(
                    new Query(Criteria.where("recipient_email").is(recipientEmail.trim().toLowerCase())
                            .and("type").is(Notification.TYPE_VACCINATION_DUE)
                            .and("read_flag").is(false)
                            .and("link").regex(exactLink)),
                    Notification.class);
            if (exists) {
                return;
            }
            notify(recipientEmail, Notification.TYPE_VACCINATION_DUE,
                    "Vaccination due: " + animalSummary,
                    "A vaccination for " + animalSummary + " is due or overdue.",
                    link);
        } catch (Exception e) {
            log.warn("Could not store vaccination reminder for {}: {}", recipientEmail, e.getMessage());
        }
    }
}
