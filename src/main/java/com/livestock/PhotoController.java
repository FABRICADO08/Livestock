package com.livestock;

import com.mongodb.client.gridfs.model.GridFSFile;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.bson.types.ObjectId;
import jakarta.servlet.http.HttpSession;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Animal photo uploads stored in MongoDB GridFS. Photos belong to a livestock
 * record: only the record owner (or an admin) can add or remove them, while
 * any signed-in user can view them (buyers see them on the marketplace).
 */
@RestController
@RequestMapping("/api/livestock")
public class PhotoController {

    private static final long MAX_PHOTO_BYTES = 5L * 1024 * 1024; // 5 MB
    private static final int MAX_PHOTOS_PER_ANIMAL = 5;
    private static final Map<String, MediaType> ALLOWED_TYPES = Map.of(
            "image/jpeg", MediaType.IMAGE_JPEG,
            "image/png", MediaType.IMAGE_PNG,
            "image/webp", MediaType.valueOf("image/webp"),
            "image/gif", MediaType.IMAGE_GIF);

    private final GridFsTemplate gridFsTemplate;
    private final LivestockRepository livestockRepository;
    private final AuthSupport auth;

    public PhotoController(GridFsTemplate gridFsTemplate,
                           LivestockRepository livestockRepository,
                           AuthSupport auth) {
        this.gridFsTemplate = gridFsTemplate;
        this.livestockRepository = livestockRepository;
        this.auth = auth;
    }

    @PostMapping("/{id}/photos")
    public Map<String, Object> upload(@PathVariable("id") String id,
                                      @RequestParam("file") MultipartFile file,
                                      HttpSession session) throws IOException {
        String email = auth.requireEmail(session);
        requireNonBuyer(session);
        Livestock animal = requireOwnedAnimal(id, session, email);

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please choose an image file to upload");
        }
        String contentType = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_TYPES.containsKey(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only JPEG, PNG, WebP or GIF images can be uploaded");
        }
        if (file.getSize() > MAX_PHOTO_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Photos must be 5 MB or smaller");
        }
        List<String> photos = photoUrls(animal);
        if (photos.size() >= MAX_PHOTOS_PER_ANIMAL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "An animal can have at most " + MAX_PHOTOS_PER_ANIMAL + " photos - remove one first");
        }

        Object photoId;
        try (InputStream data = file.getInputStream()) {
            photoId = gridFsTemplate.store(data, file.getOriginalFilename(), contentType);
        }
        photos.add("/api/livestock/photos/" + photoId.toString());
        animal.setPhotoUrls(photos);
        livestockRepository.save(animal);

        return Map.of("status", "success",
                "photo_urls", photos,
                "message", "Photo uploaded");
    }

    @GetMapping("/photos/{photoId}")
    public ResponseEntity<byte[]> download(@PathVariable("photoId") String photoId, HttpSession session)
            throws IOException {
        auth.requireEmail(session);
        if (!ObjectId.isValid(photoId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found");
        }
        GridFSFile file = gridFsTemplate.findOne(new Query(Criteria.where("_id").is(new ObjectId(photoId))));
        if (file == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found");
        }
        GridFsResource resource = gridFsTemplate.getResource(file);
        String contentType = file.getMetadata() != null && file.getMetadata().containsKey("_contentType")
                ? String.valueOf(file.getMetadata().get("_contentType")) : "image/jpeg";
        MediaType mediaType = ALLOWED_TYPES.getOrDefault(contentType.toLowerCase(Locale.ROOT),
                MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(resource.contentLength())
                .body(resource.getInputStream().readAllBytes());
    }

    @DeleteMapping("/{id}/photos/{photoId}")
    public Map<String, Object> delete(@PathVariable("id") String id,
                                      @PathVariable("photoId") String photoId,
                                      HttpSession session) {
        String email = auth.requireEmail(session);
        requireNonBuyer(session);
        Livestock animal = requireOwnedAnimal(id, session, email);

        String url = "/api/livestock/photos/" + photoId;
        List<String> photos = new ArrayList<>(photoUrls(animal));
        if (!photos.remove(url)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This photo does not belong to the animal");
        }
        animal.setPhotoUrls(photos);
        livestockRepository.save(animal);
        if (ObjectId.isValid(photoId)) {
            gridFsTemplate.delete(new Query(Criteria.where("_id").is(new ObjectId(photoId))));
        }
        return Map.of("status", "success", "photo_urls", photos, "message", "Photo removed");
    }

    private List<String> photoUrls(Livestock animal) {
        List<String> photos = animal.getPhotoUrls();
        return photos == null ? new ArrayList<>() : new ArrayList<>(photos);
    }

    private void requireNonBuyer(HttpSession session) {
        if ("BUYER".equalsIgnoreCase(auth.currentUserRole(session))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Buyers cannot manage animal photos");
        }
    }

    private Livestock requireOwnedAnimal(String id, HttpSession session, String email) {
        Optional<Livestock> found = livestockRepository.findById(id);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Animal not found");
        }
        Livestock animal = found.get();
        String role = auth.currentUserRole(session);
        String ownerEmail = animal.getCreatedByEmail() != null ? animal.getCreatedByEmail() : animal.getCreatedBy();
        if (!"ADMIN".equalsIgnoreCase(role)
                && (ownerEmail == null || !ownerEmail.equalsIgnoreCase(email))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You can only manage photos for your own animals");
        }
        return animal;
    }
}
