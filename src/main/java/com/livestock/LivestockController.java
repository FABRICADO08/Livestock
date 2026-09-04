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
    private final MongoTemplate mongoTemplate;
    private final AuthSupport auth;

    public LivestockController(LivestockRepository livestockRepository, MongoTemplate mongoTemplate, AuthSupport auth) {
        this.livestockRepository = livestockRepository;
        this.mongoTemplate = mongoTemplate;
        this.auth = auth;
    }

    @GetMapping({"", "/"})
    public List<Map<String, Object>> list(@RequestParam(name = "q", required = false) String q,
                                          @RequestParam(name = "filter", required = false) String filter,
                                          @RequestParam(name = "sort", required = false) String sort,
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
                .map(this::toJson)
                .collect(Collectors.toList());
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

        Integer computedAge = calculateAgeFromDateOfBirth(animal.getDateOfBirth());
        if (computedAge == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Date of birth is required in YYYY-MM-DD format and cannot be in the future");
        }

        Date now = new Date();
        animal.setId(null);
        animal.setAge(computedAge);
        animal.setCreatedBy(email);
        animal.setUpdatedBy(email);
        animal.setRegistrationDate(now);
        animal.setCreatedAt(now);
        animal.setUpdatedAt(now);
        livestockRepository.save(animal);

        return success("Record saved successfully", HttpStatus.CREATED.value());
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable("id") String id, @RequestBody Livestock animal, HttpSession session) {
        String email = auth.requireEmail(session);
        Livestock existing = requireOwnedRecord(id, session, email, "edit");

        Integer computedAge = calculateAgeFromDateOfBirth(animal.getDateOfBirth());
        if (computedAge == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Date of birth is required in YYYY-MM-DD format and cannot be in the future");
        }

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
        existing.setUpdatedBy(email);
        existing.setUpdatedAt(new Date());
        livestockRepository.save(existing);

        return success("Record updated successfully", HttpStatus.OK.value());
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable("id") String id, HttpSession session) {
        String email = auth.requireEmail(session);
        Livestock existing = requireOwnedRecord(id, session, email, "delete");
        livestockRepository.delete(existing);
        return success("Record deleted successfully", HttpStatus.OK.value());
    }

    private Livestock requireOwnedRecord(String id, HttpSession session, String email, String action) {
        Optional<Livestock> found = livestockRepository.findById(id);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found");
        }
        Livestock existing = found.get();
        String role = auth.currentUserRole(session);
        if (!"ADMIN".equalsIgnoreCase(role)
                && (existing.getCreatedBy() == null || !email.equalsIgnoreCase(existing.getCreatedBy()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only " + action + " your own records");
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
        json.put("created_at", a.getCreatedAt());
        json.put("updated_at", a.getUpdatedAt());
        json.put("for_sale", a.getForSale() == null || a.getForSale());
        json.put("price", a.getPrice());
        return json;
    }
}
