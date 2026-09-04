package com.livestock;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface LivestockRepository extends MongoRepository<Livestock, String> {
}
