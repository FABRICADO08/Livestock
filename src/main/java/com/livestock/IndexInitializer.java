package com.livestock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.stereotype.Component;

/**
 * Ensures the MongoDB indexes the application relies on. Created on startup
 * (create-index is idempotent in MongoDB). The unique id_tag index closes the
 * race where two concurrent creates could otherwise pass the application-level
 * uniqueness check with the same tag.
 */
@Component
public class IndexInitializer {

    private static final Logger log = LoggerFactory.getLogger(IndexInitializer.class);

    private final MongoTemplate mongoTemplate;

    public IndexInitializer(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        try {
            IndexOperations livestockOps = mongoTemplate.indexOps(Livestock.class);
            livestockOps.ensureIndex(new Index().on("status", Sort.Direction.ASC));
            livestockOps.ensureIndex(new Index().on("created_by_email", Sort.Direction.ASC));
            livestockOps.ensureIndex(new Index().on("id_tag", Sort.Direction.ASC)
                    .named("id_tag_unique_idx")
                    .unique()
                    .sparse());
            mongoTemplate.indexOps(HealthRecord.class)
                    .ensureIndex(new Index().on("livestock_id", Sort.Direction.ASC));
            mongoTemplate.indexOps(Notification.class)
                    .ensureIndex(new Index().on("recipient_email", Sort.Direction.ASC)
                            .on("read_flag", Sort.Direction.ASC));
        } catch (Exception e) {
            // A conflicting legacy index definition or duplicate data must not
            // stop the app from booting; the application-level checks still apply.
            log.warn("Could not ensure MongoDB indexes: {}", e.getMessage());
        }
    }
}
