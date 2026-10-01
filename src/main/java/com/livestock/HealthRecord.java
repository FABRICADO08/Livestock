package com.livestock;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Date;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * A health event for one animal: a vaccination, treatment or checkup.
 * Records with a next_due_date drive the due/overdue vaccination reminders
 * on the dashboard and in notifications.
 */
@Document(collection = "health_records")
public class HealthRecord {

    public static final String TYPE_VACCINATION = "Vaccination";
    public static final String TYPE_TREATMENT = "Treatment";
    public static final String TYPE_CHECKUP = "Checkup";

    @Id
    private String id;

    @Indexed
    @JsonProperty("livestock_id")
    @Field("livestock_id")
    private String livestockId;

    // Vaccination, Treatment or Checkup
    private String type;

    // Date the event happened, YYYY-MM-DD
    @JsonProperty("record_date")
    @Field("record_date")
    private String recordDate;

    @JsonAlias("vet")
    private String vet;

    private String notes;

    // Optional follow-up date (YYYY-MM-DD) used for vaccination reminders
    @JsonProperty("next_due_date")
    @Field("next_due_date")
    private String nextDueDate;

    @JsonAlias("created_by_email")
    @Field("created_by_email")
    private String createdByEmail;

    @Field("created_at")
    private Date createdAt = new Date();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getLivestockId() {
        return livestockId;
    }

    public void setLivestockId(String livestockId) {
        this.livestockId = livestockId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getRecordDate() {
        return recordDate;
    }

    public void setRecordDate(String recordDate) {
        this.recordDate = recordDate;
    }

    public String getVet() {
        return vet;
    }

    public void setVet(String vet) {
        this.vet = vet;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getNextDueDate() {
        return nextDueDate;
    }

    public void setNextDueDate(String nextDueDate) {
        this.nextDueDate = nextDueDate;
    }

    public String getCreatedByEmail() {
        return createdByEmail;
    }

    public void setCreatedByEmail(String createdByEmail) {
        this.createdByEmail = createdByEmail;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }
}
