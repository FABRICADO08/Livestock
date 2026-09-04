package com.livestock;

import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.servlet.http.HttpSession;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Purchase requests: a buyer requests to buy an animal, and the seller
 * (record owner) or an admin approves or declines the request. While a
 * request is PENDING the animal is flagged on the marketplace so other
 * buyers can see a purchase is already in progress.
 */
@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

    private final PurchaseRequestRepository purchaseRepository;
    private final LivestockRepository livestockRepository;
    private final MongoTemplate mongoTemplate;
    private final AuthSupport auth;
    private final EmailSupport email;

    public PurchaseController(PurchaseRequestRepository purchaseRepository,
                              LivestockRepository livestockRepository,
                              MongoTemplate mongoTemplate,
                              AuthSupport auth,
                              EmailSupport email) {
        this.purchaseRepository = purchaseRepository;
        this.livestockRepository = livestockRepository;
        this.mongoTemplate = mongoTemplate;
        this.auth = auth;
        this.email = email;
    }

    public static class CreateRequest {
        @com.fasterxml.jackson.annotation.JsonProperty("livestock_id")
        public String livestockId;
        public Double price;
    }

    @PostMapping({"", "/"})
    public Map<String, Object> create(@RequestBody CreateRequest body, HttpSession session) {
        String email = auth.requireEmail(session);
        if (!"BUYER".equalsIgnoreCase(auth.currentUserRole(session))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only buyers can submit purchase requests");
        }
        if (body == null || body.livestockId == null || body.livestockId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "livestock_id is required");
        }
        if (body.price != null && body.price < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Offer price cannot be negative");
        }

        Livestock animal = livestockRepository.findById(body.livestockId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Animal not found"));

        String status = animal.getStatus() == null || animal.getStatus().isBlank()
                ? "ACTIVE" : animal.getStatus().trim().toUpperCase();
        if (!"ACTIVE".equals(status) || Boolean.FALSE.equals(animal.getForSale())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This animal is no longer available for sale");
        }
        if (purchaseRepository.existsByLivestockIdAndStatus(animal.getId(), PurchaseRequest.STATUS_PENDING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A purchase request for this animal is already awaiting approval");
        }

        PurchaseRequest request = new PurchaseRequest();
        request.setLivestockId(animal.getId());
        request.setAnimalSummary(animalSummary(animal));
        request.setSpecies(animal.getSpecies());
        request.setBreed(animal.getBreed());
        String sellerEmail = animal.getCreatedByEmail() != null ? animal.getCreatedByEmail() : animal.getCreatedBy();
        request.setSellerEmail(sellerEmail);
        request.setSellerName(animal.getCreatedBy());
        request.setBuyerEmail(email);
        request.setBuyerName(displayName(email));
        request.setPrice(body.price != null ? body.price : animal.getPrice());
        request.setCreatedAt(new Date());
        purchaseRepository.save(request);

        notifyOwnerNewRequest(request);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "success");
        response.put("message", "Purchase request submitted. Waiting for the seller's approval.");
        response.put("code", HttpStatus.CREATED.value());
        response.put("request", toJson(request));
        return response;
    }

    @GetMapping("/mine")
    public List<Map<String, Object>> mine(HttpSession session) {
        String email = auth.requireEmail(session);
        // Trim-tolerant, case-insensitive match so requests stored with a
        // padded or differently-cased buyer email still show up for the buyer.
        Pattern exact = Pattern.compile("^\\s*" + Pattern.quote(email.trim()) + "\\s*$", Pattern.CASE_INSENSITIVE);
        return mongoTemplate.find(new Query(Criteria.where("buyer_email").regex(exact)), PurchaseRequest.class)
                .stream()
                .sorted(Comparator.comparing(PurchaseRequest::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toJson)
                .collect(Collectors.toList());
    }

    @GetMapping("/pending")
    public List<Map<String, Object>> pending(HttpSession session) {
        String email = auth.requireEmail(session);
        String role = auth.currentUserRole(session);
        if ("BUYER".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Buyers cannot review purchase requests");
        }
        List<PurchaseRequest> requests = "ADMIN".equalsIgnoreCase(role)
                ? purchaseRepository.findByStatus(PurchaseRequest.STATUS_PENDING)
                : purchaseRepository.findBySellerEmailIgnoreCase(email).stream()
                        .filter(r -> PurchaseRequest.STATUS_PENDING.equals(r.getStatus()))
                        .collect(Collectors.toList());
        return requests.stream()
                .sorted(Comparator.comparing(PurchaseRequest::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toJson)
                .collect(Collectors.toList());
    }

    @PutMapping("/{id}/approve")
    public Map<String, Object> approve(@PathVariable("id") String id, HttpSession session) {
        return resolve(id, session, true);
    }

    @PutMapping("/{id}/decline")
    public Map<String, Object> decline(@PathVariable("id") String id, HttpSession session) {
        return resolve(id, session, false);
    }

    @PutMapping("/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable("id") String id, HttpSession session) {
        String email = auth.requireEmail(session);
        PurchaseRequest request = purchaseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase request not found"));
        if (request.getBuyerEmail() == null || !request.getBuyerEmail().equalsIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own purchase requests");
        }
        ensurePending(request);
        request.setStatus(PurchaseRequest.STATUS_DECLINED);
        request.setResolvedAt(new Date());
        request.setResolvedBy(displayName(email));
        purchaseRepository.save(request);
        this.email.send(request.getSellerEmail(),
                "Purchase Request Cancelled: " + request.getAnimalSummary(),
                "Hello" + namePart(request.getSellerName()) + ",\n\n"
                + "This is to inform you that the purchase request below has been cancelled by the buyer.\n\n"
                + "Purchase Details:\n"
                + "- Animal: " + request.getAnimalSummary() + "\n"
                + "- Buyer: " + request.getBuyerName() + "\n"
                + "- Buyer Email: " + request.getBuyerEmail() + "\n\n"
                + "Your listing is now available for other buyers on the marketplace.\n\n"
                + "Thank you for using our Animal Marketplace.\n\n"
                + "Best regards,\n"
                + "Animal Marketplace Team");
        return success("Purchase request cancelled");
    }

    private Map<String, Object> resolve(String id, HttpSession session, boolean approve) {
        String email = auth.requireEmail(session);
        String role = auth.currentUserRole(session);
        if ("BUYER".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Buyers cannot approve or decline purchase requests");
        }

        PurchaseRequest request = purchaseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase request not found"));
        if (!"ADMIN".equalsIgnoreCase(role)
                && (request.getSellerEmail() == null || !request.getSellerEmail().equalsIgnoreCase(email))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only review requests for your own animals");
        }
        ensurePending(request);

        Date now = new Date();
        String resolver = displayName(email);
        request.setStatus(approve ? PurchaseRequest.STATUS_APPROVED : PurchaseRequest.STATUS_DECLINED);
        request.setResolvedAt(now);
        request.setResolvedBy(resolver);

        if (approve) {
            Optional<Livestock> found = livestockRepository.findById(request.getLivestockId());
            if (found.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "The animal record no longer exists");
            }
            Livestock animal = found.get();
            String animalStatus = animal.getStatus() == null || animal.getStatus().isBlank()
                    ? "ACTIVE" : animal.getStatus().trim().toUpperCase();
            if (!"ACTIVE".equals(animalStatus)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This animal is no longer available for sale");
            }

            animal.setStatus("SOLD");
            animal.setForSale(Boolean.FALSE);
            if (request.getPrice() != null) {
                animal.setPrice(request.getPrice());
            }
            animal.setUpdatedBy(resolver);
            animal.setUpdatedByEmail(email);
            animal.setUpdatedAt(now);
            livestockRepository.save(animal);

            purchaseRepository.save(request);
            // Every other pending request for the same animal is declined now
            // that the animal has been sold.
            for (PurchaseRequest other
                    : purchaseRepository.findByLivestockIdAndStatus(animal.getId(), PurchaseRequest.STATUS_PENDING)) {
                other.setStatus(PurchaseRequest.STATUS_DECLINED);
                other.setResolvedAt(now);
                other.setResolvedBy(resolver);
                purchaseRepository.save(other);
                notifyBuyerDeclined(other);
            }
            notifyApproved(request);
            return success("Purchase approved. The animal has been marked as sold.");
        }

        purchaseRepository.save(request);
        notifyBuyerDeclined(request);
        return success("Purchase request declined");
    }

    private void notifyOwnerNewRequest(PurchaseRequest request) {
        email.send(request.getSellerEmail(),
                "New Purchase Request: " + request.getAnimalSummary(),
                "Hello" + namePart(request.getSellerName()) + ",\n\n"
                + "Good news! A buyer has submitted a purchase request for your animal listing.\n\n"
                + "Purchase Details:\n"
                + "- Animal: " + animalName(request) + "\n"
                + "- Breed: " + valueOr(request.getBreed()) + "\n"
                + "- Buyer: " + request.getBuyerName() + "\n"
                + "- Buyer Email: " + request.getBuyerEmail() + "\n"
                + "- Offered Price: " + priceText(request) + "\n"
                + "- Request Date: " + dateText(request.getCreatedAt()) + "\n\n"
                + "Please review the request and choose whether to approve or reject it. "
                + "Sign in and open 'Purchase Requests' to respond.\n\n"
                + "If approved, the buyer will be notified and can proceed with the purchase process.\n\n"
                + "Thank you for using our Animal Marketplace.\n\n"
                + "Best regards,\n"
                + "Animal Marketplace Team");
    }

    private void notifyApproved(PurchaseRequest request) {
        User owner = findUserByEmail(request.getSellerEmail());
        StringBuilder body = new StringBuilder();
        body.append("Hello").append(namePart(request.getBuyerName())).append(",\n\n")
                .append("Congratulations!\n\n")
                .append("Your purchase request for the following animal has been approved by the owner.\n\n")
                .append("Animal Details:\n")
                .append("- Animal: ").append(animalName(request)).append("\n")
                .append("- Breed: ").append(valueOr(request.getBreed())).append("\n")
                .append("- Price: ").append(priceText(request)).append("\n\n")
                .append("The owner has accepted your request and will contact you shortly regarding the next steps.\n\n")
                .append("Owner Contact Details:\n")
                .append("- Name: ").append(ownerName(request, owner)).append("\n")
                .append("- Email: ").append(valueOr(request.getSellerEmail())).append("\n");
        if (owner != null && owner.getPhone() != null && !owner.getPhone().isBlank()) {
            body.append("- Phone: ").append(owner.getPhone().trim()).append("\n");
        }
        body.append("\n")
                .append("Thank you for using our Animal Marketplace.\n\n")
                .append("Best regards,\n")
                .append("Animal Marketplace Team");
        email.send(request.getBuyerEmail(),
                "Purchase Request Approved: " + request.getAnimalSummary(), body.toString());
        email.send(request.getSellerEmail(),
                "Sale Completed: " + request.getAnimalSummary(),
                "Hello" + namePart(request.getSellerName()) + ",\n\n"
                + "This confirms that the purchase request below has been approved"
                + (request.getResolvedBy() != null ? " by " + request.getResolvedBy() : "")
                + ". The animal has been marked as sold.\n\n"
                + "Sale Details:\n"
                + "- Animal: " + animalName(request) + "\n"
                + "- Buyer: " + request.getBuyerName() + "\n"
                + "- Buyer Email: " + request.getBuyerEmail() + "\n"
                + "- Price: " + priceText(request) + "\n\n"
                + "The buyer has been notified and has received your contact details "
                + "to arrange the next steps.\n\n"
                + "Thank you for using our Animal Marketplace.\n\n"
                + "Best regards,\n"
                + "Animal Marketplace Team");
    }

    private void notifyBuyerDeclined(PurchaseRequest request) {
        email.send(request.getBuyerEmail(),
                "Purchase Request Declined: " + request.getAnimalSummary(),
                "Hello" + namePart(request.getBuyerName()) + ",\n\n"
                + "Thank you for your interest in purchasing the following animal:\n\n"
                + "- Animal: " + animalName(request) + "\n"
                + "- Breed: " + valueOr(request.getBreed()) + "\n\n"
                + "Unfortunately, the owner has declined your purchase request.\n\n"
                + "This may be because the animal is no longer available or the owner chose another buyer.\n\n"
                + "We encourage you to browse other available listings on the platform.\n\n"
                + "Thank you for using our Animal Marketplace.\n\n"
                + "Best regards,\n"
                + "Animal Marketplace Team");
    }

    private User findUserByEmail(String emailAddress) {
        if (emailAddress == null || emailAddress.isBlank()) {
            return null;
        }
        Pattern exact = Pattern.compile("^" + Pattern.quote(emailAddress.trim()) + "$", Pattern.CASE_INSENSITIVE);
        return mongoTemplate.find(new Query(Criteria.where("email").regex(exact)), User.class)
                .stream().findFirst().orElse(null);
    }

    private String ownerName(PurchaseRequest request, User owner) {
        if (owner != null && owner.getName() != null && !owner.getName().isBlank()) {
            return owner.getName().trim();
        }
        return valueOr(request.getSellerName());
    }

    private String animalName(PurchaseRequest request) {
        String name = request.getAnimalSummary();
        return name == null || name.isBlank() ? "Animal listing" : name;
    }

    private String valueOr(String value) {
        return value == null || value.isBlank() ? "Not specified" : value.trim();
    }

    private String priceText(PurchaseRequest request) {
        return request.getPrice() != null
                ? "R" + String.format("%,.2f", request.getPrice()) : "Not specified";
    }

    private String dateText(Date date) {
        if (date == null) {
            return "Not specified";
        }
        return new java.text.SimpleDateFormat("dd MMM yyyy, HH:mm").format(date);
    }

    private String namePart(String name) {
        return name == null || name.isBlank() ? "" : " " + name;
    }

    private void ensurePending(PurchaseRequest request) {
        if (!PurchaseRequest.STATUS_PENDING.equals(request.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This request has already been " +
                    (request.getStatus() == null ? "resolved" : request.getStatus().toLowerCase()));
        }
    }

    private String animalSummary(Livestock animal) {
        StringBuilder summary = new StringBuilder();
        if (animal.getSpecies() != null) {
            summary.append(animal.getSpecies());
        }
        if (animal.getBreed() != null && !animal.getBreed().isBlank()) {
            summary.append(summary.length() == 0 ? "" : " - ").append(animal.getBreed());
        }
        String tag = animal.getIdTag() != null && !animal.getIdTag().isBlank() ? animal.getIdTag() : animal.getId();
        if (tag != null) {
            summary.append(" (").append(tag).append(")");
        }
        return summary.length() == 0 ? "Animal " + animal.getId() : summary.toString();
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

    private Map<String, Object> success(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "success");
        body.put("message", message);
        body.put("code", HttpStatus.OK.value());
        return body;
    }

    private Map<String, Object> toJson(PurchaseRequest r) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", r.getId());
        json.put("livestock_id", r.getLivestockId());
        json.put("animal_summary", r.getAnimalSummary());
        json.put("seller_email", r.getSellerEmail());
        json.put("seller_name", r.getSellerName());
        json.put("buyer_email", r.getBuyerEmail());
        json.put("buyer_name", r.getBuyerName());
        json.put("price", r.getPrice());
        json.put("status", r.getStatus());
        json.put("created_at", r.getCreatedAt());
        json.put("resolved_at", r.getResolvedAt());
        json.put("resolved_by", r.getResolvedBy());
        return json;
    }
}
