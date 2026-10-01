package com.livestock;

import java.util.Date;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * An in-app notification for a user (purchase request events, vaccination
 * reminders). Rendered in the dashboard notification bell so users stay
 * informed even when email delivery is unavailable.
 */
@Document(collection = "notifications")
@CompoundIndex(name = "recipient_read_idx", def = "{'recipient_email': 1, 'read_flag': 1}")
public class Notification {

    public static final String TYPE_PURCHASE_CREATED = "PURCHASE_CREATED";
    public static final String TYPE_PURCHASE_APPROVED = "PURCHASE_APPROVED";
    public static final String TYPE_PURCHASE_DECLINED = "PURCHASE_DECLINED";
    public static final String TYPE_PURCHASE_CANCELLED = "PURCHASE_CANCELLED";
    public static final String TYPE_SALE_COMPLETED = "SALE_COMPLETED";
    public static final String TYPE_VACCINATION_DUE = "VACCINATION_DUE";

    @Id
    private String id;

    @Indexed
    @Field("recipient_email")
    private String recipientEmail;

    private String type;

    private String title;

    private String message;

    @Field("link")
    private String link;

    @Field("read_flag")
    private boolean read = false;

    @Field("created_at")
    private Date createdAt = new Date();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public void setRecipientEmail(String recipientEmail) {
        this.recipientEmail = recipientEmail;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    public boolean isRead() {
        return read;
    }

    public void setRead(boolean read) {
        this.read = read;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}
