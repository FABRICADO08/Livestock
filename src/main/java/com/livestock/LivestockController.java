package com.livestock;

import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.servlet.http.HttpSession;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/livestock")
public class LivestockController {

    private final LivestockRepository livestockRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final AuthSupport auth;

    public LivestockController(LivestockRepository livestockRepository, UserRepository userRepository,
                               MongoTemplate mongoTemplate, AuthSupport auth) {
        this.livestockRepository = livestockRepository;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
        this.auth = auth;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "ACTIVE";
        }
        String normalized = status.trim().toUpperCase();
        if ("SOLD".equals(normalized) || "DEAD".equals(normalized)) {
            return normalized;
        }
        return "ACTIVE";
    }

    private String statusOrDefault(Livestock animal) {
        return animal.getStatus() == null || animal.getStatus().isBlank()
                ? "ACTIVE" : animal.getStatus().trim().toUpperCase();
    }

    private boolean isActive(Livestock animal) {
        return "ACTIVE".equals(statusOrDefault(animal));
    }

    private String displayName(String email) {
        if (email == null || email.isBlank()) {
            return email;
        }
        Pattern exact = Pattern.compile("^" + Pattern.quote(email.trim()) + "$", Pattern.CASE_INSENSITIVE);
        return mongoTemplate.find(new Query(Criteria.where("email").regex(exact)), User.class).stream()
                .map(User::getName)
                .filter(n -> n != null && !n.isBlank())
                .findFirst()
                .orElse(email);
    }

    private void ensureIdTagAvailable(String idTag, String excludeId) {
        if (idTag == null || idTag.isBlank()) {
            return;
        }
        String normalized = idTag.trim();
        boolean taken = livestockRepository.findAll().stream()
                .anyMatch(a -> a.getIdTag() != null
                        && a.getIdTag().trim().equalsIgnoreCase(normalized)
                        && (excludeId == null || !excludeId.equals(a.getId())));
        if (taken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "An animal with ID tag '" + normalized + "' already exists. ID tags must be unique.");
        }
    }

    private void requireNonBuyer(HttpSession session) {
        String role = auth.currentUserRole(session);
        if ("BUYER".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Buyers cannot manage livestock records");
        }
    }

    @GetMapping({"", "/"})
    public List<Map<String, Object>> list(@RequestParam(name = "q", required = false) String q,
                                          @RequestParam(name = "filter", required = false) String filter,
                                          @RequestParam(name = "sort", required = false) String sort,
                                          @RequestParam(name = "status", required = false) String status,
                                          @RequestParam(name = "page", defaultValue = "0") int page,
                                          @RequestParam(name = "limit", defaultValue = "50") int limit,
                                          HttpSession session) {
        auth.requireEmail(session);

        Query query = new Query();
        if (q != null && !q.trim().isEmpty()) {
            Pattern pattern = Pattern.compile(Pattern.quote(q.trim()), Pattern.CASE_INSENSITIVE);
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where("species").regex(pattern),
                    Criteria.where("breed").regex(pattern),
                    Criteria.where("id_tag").regex(pattern)));
        }
        if ("healthy".equalsIgnoreCase(filter)) {
            query.addCriteria(Criteria.where("health_status").is("Healthy"));
        } else if ("sick".equalsIgnoreCase(filter)) {
            query.addCriteria(Criteria.where("health_status").ne("Healthy"));
        }

        // By default the list only shows live (ACTIVE) animals; Sold/Dead are
        // separated out and only returned when explicitly requested.
        String statusFilter = status == null ? "" : status.trim().toUpperCase();
        if ("SOLD".equals(statusFilter) || "DEAD".equals(statusFilter)) {
            query.addCriteria(Criteria.where("status").is(statusFilter));
        } else if (!"ALL".equals(statusFilter)) {
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where("status").is("ACTIVE"),
                    Criteria.where("status").exists(false),
                    Criteria.where("status").is(null),
                    Criteria.where("status").is("")));
        }

        List<Livestock> all = mongoTemplate.find(query, Livestock.class);
        Comparator<Livestock> comparator = comparatorFor(sort);
        if (comparator != null) {
            all.sort(comparator);
        }

        int safeLimit = Math.max(1, limit);
        int from = Math.min(Math.max(0, page) * safeLimit, all.size());
        int to = Math.min(from + safeLimit, all.size());

        return all.subList(from, to).stream().map(this::toJson).collect(Collectors.toList());
    }

    @GetMapping("/marketplace")
    public List<Map<String, Object>> marketplace(HttpSession session) {
        auth.requireEmail(session);
        Query query = new Query();
        query.addCriteria(Criteria.where("for_sale").ne(Boolean.FALSE));
        return mongoTemplate.find(query, Livestock.class).stream()
                .filter(this::isActive)
                .map(this::toJson)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public Map<String, Object> getById(@PathVariable("id") String id, HttpSession session) {
        auth.requireEmail(session);
        Livestock animal = livestockRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found"));
        return toJson(animal);
    }

    @GetMapping("/stats")
    public Map<String, Object> stats(HttpSession session) {
        auth.requireEmail(session);

        List<Livestock> all = livestockRepository.findAll();
        long healthy = all.stream().filter(a -> "Healthy".equals(a.getHealthStatus())).count();
        long sick = all.stream().filter(a -> a.getHealthStatus() != null && !"Healthy".equals(a.getHealthStatus())).count();
        long speciesCount = all.stream().map(Livestock::getSpecies).filter(Objects::nonNull).distinct().count();
        double avgAge = all.stream().filter(a -> a.getAge() != null).mapToInt(Livestock::getAge).average().orElse(0);
        double avgWeight = all.stream().filter(a -> a.getWeight() != null).mapToDouble(Livestock::getWeight).average().orElse(0);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", all.size());
        stats.put("healthy", healthy);
        stats.put("sick", sick);
        stats.put("species_count", speciesCount);
        stats.put("avg_age", round2(avgAge));
        stats.put("avg_weight", round2(avgWeight));
        return stats;
    }

    @PostMapping({"", "/"})
    public Map<String, Object> create(@RequestBody Livestock animal, HttpSession session) {
        String email = auth.requireEmail(session);
        requireNonBuyer(session);

        Integer computedAge = calculateAgeFromDateOfBirth(animal.getDateOfBirth());
        if (computedAge == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Date of birth is required in YYYY-MM-DD format and cannot be in the future");
        }
        ensureIdTagAvailable(animal.getIdTag(), null);

        // An admin must assign the animal to a seller (a USER account); everyone
        // else owns the records they create.
        String creatorEmail = email;
        String creatorName = displayName(email);
        if ("ADMIN".equalsIgnoreCase(auth.currentUserRole(session))) {
            User seller = requireSeller(animal.getOwnerEmail());
            creatorEmail = seller.getEmail();
            creatorName = seller.getName() != null && !seller.getName().isBlank()
                    ? seller.getName() : seller.getEmail();
        }

        Date now = new Date();
        animal.setId(null);
        animal.setAge(computedAge);
        animal.setStatus(normalizeStatus(animal.getStatus()));
        animal.setCreatedBy(creatorName);
        animal.setUpdatedBy(creatorName);
        animal.setCreatedByEmail(creatorEmail);
        animal.setUpdatedByEmail(creatorEmail);
        animal.setRegistrationDate(now);
        animal.setCreatedAt(now);
        animal.setUpdatedAt(now);
        livestockRepository.save(animal);

        return success("Record saved successfully", HttpStatus.CREATED.value());
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable("id") String id, @RequestBody Livestock animal, HttpSession session) {
        String email = auth.requireEmail(session);
        requireNonBuyer(session);
        Livestock existing = requireOwnedRecord(id, session, email);

        Integer computedAge = calculateAgeFromDateOfBirth(animal.getDateOfBirth());
        if (computedAge == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Date of birth is required in YYYY-MM-DD format and cannot be in the future");
        }
        ensureIdTagAvailable(animal.getIdTag(), existing.getId());

        existing.setSpecies(animal.getSpecies());
        existing.setBreed(animal.getBreed());
        existing.setAge(computedAge);
        existing.setWeight(animal.getWeight());
        existing.setHealthStatus(animal.getHealthStatus());
        existing.setGender(animal.getGender());
        existing.setClassification(animal.getClassification());
        existing.setDateOfBirth(animal.getDateOfBirth());
        existing.setAcquisitionDate(animal.getAcquisitionDate());
        existing.setProductionType(animal.getProductionType());
        existing.setVaccinationStatus(animal.getVaccinationStatus());
        existing.setLocation(animal.getLocation());
        existing.setIdTag(animal.getIdTag());
        existing.setNotes(animal.getNotes());
        if (animal.getForSale() != null) {
            existing.setForSale(animal.getForSale());
        }
        existing.setPrice(animal.getPrice());
        existing.setStatus(normalizeStatus(animal.getStatus()));

        // An admin may reassign the record to a different seller (USER account)
        if ("ADMIN".equalsIgnoreCase(auth.currentUserRole(session))
                && animal.getOwnerEmail() != null && !animal.getOwnerEmail().isBlank()) {
            User seller = requireSeller(animal.getOwnerEmail());
            existing.setCreatedByEmail(seller.getEmail());
            existing.setCreatedBy(seller.getName() != null && !seller.getName().isBlank()
                    ? seller.getName() : seller.getEmail());
        }

        existing.setUpdatedBy(displayName(email));
        existing.setUpdatedByEmail(email);
        existing.setUpdatedAt(new Date());
        livestockRepository.save(existing);

        return success("Record updated successfully", HttpStatus.OK.value());
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable("id") String id, HttpSession session) {
        String email = auth.requireEmail(session);
        requireNonBuyer(session);
        Livestock existing = requireOwnedRecord(id, session, email);
        livestockRepository.delete(existing);
        return success("Record deleted successfully", HttpStatus.OK.value());
    }

    private User requireSeller(String ownerEmail) {
        if (ownerEmail == null || ownerEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Admins must assign the animal to a seller (owner_email is required)");
        }
        String normalized = ownerEmail.trim();
        Optional<User> seller = userRepository.findAll().stream()
                .filter(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase(normalized))
                .findFirst();
        if (seller.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Seller '" + normalized + "' was not found. The user must sign in at least once.");
        }
        String role = auth.normalizeRole(seller.get().getRole());
        if (!"USER".equals(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Animals can only be assigned to sellers (users with the USER role)");
        }
        return seller.get();
    }

    private Livestock requireOwnedRecord(String id, HttpSession session, String email) {        Optional<Livestock> found = livestockRepository.findById(id);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found");
        }
        Livestock existing = found.get();
        String role = auth.currentUserRole(session);
        String ownerEmail = existing.getCreatedByEmail() != null ? existing.getCreatedByEmail() : existing.getCreatedBy();
        if (!"ADMIN".equalsIgnoreCase(role)
                && (ownerEmail == null || !email.equalsIgnoreCase(ownerEmail))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only modify your own records");
        }
        return existing;
    }

    private Comparator<Livestock> comparatorFor(String sort) {
        if ("age_desc".equals(sort)) {
            return Comparator.comparing(Livestock::getAge, Comparator.nullsLast(Comparator.reverseOrder()));
        }
        if ("weight_desc".equals(sort)) {
            return Comparator.comparing(Livestock::getWeight, Comparator.nullsLast(Comparator.reverseOrder()));
        }
        return null; // default: insertion order
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

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private Map<String, Object> success(String message, int status) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "success");
        body.put("message", message);
        body.put("code", status);
        return body;
    }

    private Map<String, Object> toJson(Livestock a) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", a.getId());
        json.put("species", a.getSpecies());
        json.put("breed", a.getBreed());
        json.put("age", a.getAge());
        json.put("weight", a.getWeight());
        json.put("health_status", a.getHealthStatus());
        json.put("gender", a.getGender() != null ? a.getGender() : "N/A");
        json.put("classification", a.getClassification() != null ? a.getClassification() : "N/A");
        json.put("date", a.getRegistrationDate());
        json.put("date_of_birth", a.getDateOfBirth());
        json.put("acquisition_date", a.getAcquisitionDate());
        json.put("production_type", a.getProductionType());
        json.put("vaccination_status", a.getVaccinationStatus());
        json.put("location", a.getLocation());
        json.put("id_tag", a.getIdTag());
        json.put("notes", a.getNotes());
        json.put("created_by", a.getCreatedBy());
        json.put("updated_by", a.getUpdatedBy());
        json.put("created_by_email", a.getCreatedByEmail());
        json.put("updated_by_email", a.getUpdatedByEmail());
        json.put("created_at", a.getCreatedAt());
        json.put("updated_at", a.getUpdatedAt());
        json.put("for_sale", a.getForSale() == null || a.getForSale());
        json.put("price", a.getPrice());
        json.put("status", statusOrDefault(a));
        return json;
    }
}
