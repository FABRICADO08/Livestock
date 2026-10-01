package com.livestock;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface NotificationRepository extends MongoRepository<Notification, String> {

    List<Notification> findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc(String recipientEmail);

    long countByRecipientEmailIgnoreCaseAndReadFalse(String recipientEmail);
}
