package com.livestock;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface HealthRecordRepository extends MongoRepository<HealthRecord, String> {

    List<HealthRecord> findByLivestockId(String livestockId);

    void deleteByLivestockId(String livestockId);
}
