package com.livestock;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Per-animal health records (vaccinations, treatments, checkups). Records
 * belong to a livestock record and can only be managed by the animal's owner
 * or an admin. Vaccination records with a next_due_date produce due/overdue
 * reminders on the dashboard and in-app notifications.
 */
@RestController
@RequestMapping("/api/livestock/{livestockId}/health-records")
public class HealthRecordController {

    // Reminders start this many days before the next due date
    private static final int REMINDER_WINDOW_DAYS = 30;

    private final HealthRecordRepository healthRecordRepository;
    private final LivestockRepository livestockRepository;
    private final AuthSupport auth;
    private final NotificationSupport notifications;

    public HealthRecordController(HealthRecordRepository healthRecordRepository,
                                  LivestockRepository livestockRepository,
                                  AuthSupport auth,
                                  NotificationSupport notifications) {
        this.healthRecordRepository = healthRecordRepository;
        this.livestockRepository = livestockRepository;
        this.auth = auth;
        this.notifications = notifications;
    }

    @GetMapping({"", "/"})
    public List<Map<String, Object>> list(@PathVariable("livestockId") String livestockId, HttpSession session) {
        auth.requireEmail(session);
        requireAnimal(livestockId);
        return healthRecordRepository.findByLivestockId(livestockId).stream()
                .sorted(Comparator.comparing(HealthRecord::getRecordDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toJson)
                .collect(Collectors.toList());
    }

    @PostMapping({"", "/"})
    public Map<String, Object> create(@PathVariable("livestockId") String livestockId,
                                      @RequestBody HealthRecord record,
                                      HttpSession session) {
        String email = auth.requireEmail(session);
        requireNonBuyer(session);
        Livestock animal = requireOwnedAnimal(livestockId, session, email);

        validate(record);

        record.setId(null);
        record.setLivestockId(animal.getId());
        record.setCreatedByEmail(email);
        record.setCreatedAt(new Date());
        healthRecordRepository.save(record);

        // A vaccination records the animal as vaccinated right away
        if (isVaccination(record.getType())) {
            animal.setVaccinationStatus("Vaccinated");
            animal.setUpdatedAt(new Date());
            livestockRepository.save(animal);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "success");
        body.put("message", "Health record saved");
        body.put("record", toJson(record));
        return body;
    }

    @DeleteMapping("/{recordId}")
    public Map<String, Object> delete(@PathVariable("livestockId") String livestockId,
                                      @PathVariable("recordId") String recordId,
                                      HttpSession session) {
        String email = auth.requireEmail(session);
        requireNonBuyer(session);
        requireOwnedAnimal(livestockId, session, email);

        HealthRecord record = healthRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Health record not found"));
        if (!livestockId.equals(record.getLivestockId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Health record not found for this animal");
        }
        healthRecordRepository.delete(record);
        return Map.of("status", "success", "message", "Health record deleted");
    }

    private void validate(HealthRecord record) {
        if (record == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A health record is required");
        }
        String type = record.getType() == null ? "" : record.getType().trim();
        if (!HealthRecord.TYPE_VACCINATION.equalsIgnoreCase(type)
                && !HealthRecord.TYPE_TREATMENT.equalsIgnoreCase(type)
                && !HealthRecord.TYPE_CHECKUP.equalsIgnoreCase(type)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Type must be Vaccination, Treatment or Checkup");
        }
        record.setType(capitalize(type));
        if (!isValidDate(record.getRecordDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A valid record date (YYYY-MM-DD) is required");
        }
        if (record.getNextDueDate() != null && !record.getNextDueDate().isBlank()
                && !isValidDate(record.getNextDueDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Next due date must be a valid date (YYYY-MM-DD)");
        }
    }

    private boolean isVaccination(String type) {
        return type != null && HealthRecord.TYPE_VACCINATION.equalsIgnoreCase(type.trim());
    }

    private String capitalize(String value) {
        String trimmed = value.trim().toLowerCase();
        return Character.toUpperCase(trimmed.charAt(0)) + trimmed.substring(1);
    }

    private boolean isValidDate(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            LocalDate.parse(value.trim());
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private void requireNonBuyer(HttpSession session) {
        if ("BUYER".equalsIgnoreCase(auth.currentUserRole(session))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Buyers cannot manage health records");
        }
    }

    private Livestock requireAnimal(String id) {
        return livestockRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Animal not found"));
    }

    private Livestock requireOwnedAnimal(String id, HttpSession session, String email) {
        Livestock animal = requireAnimal(id);
        String role = auth.currentUserRole(session);
        String ownerEmail = animal.getCreatedByEmail() != null ? animal.getCreatedByEmail() : animal.getCreatedBy();
        if (!"ADMIN".equalsIgnoreCase(role)
                && (ownerEmail == null || !ownerEmail.equalsIgnoreCase(email))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only manage health records for your own animals");
        }
        return animal;
    }

    private Map<String, Object> toJson(HealthRecord r) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", r.getId());
        json.put("livestock_id", r.getLivestockId());
        json.put("type", r.getType());
        json.put("record_date", r.getRecordDate());
        json.put("vet", r.getVet());
        json.put("notes", r.getNotes());
        json.put("next_due_date", r.getNextDueDate());
        json.put("created_by_email", r.getCreatedByEmail());
        json.put("created_at", r.getCreatedAt());
        return json;
    }

    /** Days until the record's next due date; null when no due date is set. */
    public static Integer daysUntilDue(HealthRecord record) {
        if (record.getNextDueDate() == null || record.getNextDueDate().isBlank()) {
            return null;
        }
        try {
            LocalDate due = LocalDate.parse(record.getNextDueDate().trim());
            return (int) java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), due);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Whether a record counts for due/overdue vaccination reminders. */
    public static boolean isReminderCandidate(HealthRecord record) {
        Integer days = daysUntilDue(record);
        return days != null && days <= REMINDER_WINDOW_DAYS;
    }
}
