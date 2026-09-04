package com.livestock;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PurchaseRequestRepository extends MongoRepository<PurchaseRequest, String> {

    List<PurchaseRequest> findByStatus(String status);

    List<PurchaseRequest> findByBuyerEmailIgnoreCase(String buyerEmail);

    List<PurchaseRequest> findBySellerEmailIgnoreCase(String sellerEmail);

    List<PurchaseRequest> findByLivestockIdAndStatus(String livestockId, String status);

    boolean existsByLivestockIdAndStatus(String livestockId, String status);

    boolean existsByLivestockIdAndBuyerEmailIgnoreCaseAndStatus(String livestockId, String buyerEmail, String status);
}
