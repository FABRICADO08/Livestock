package com.livestock;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Date;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * A buyer's request to buy an animal. Requests start PENDING and are approved
 * or declined by the seller (record owner) or an admin.
 */
@Document(collection = "purchase_requests")
public class PurchaseRequest {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_DECLINED = "DECLINED";

    @Id
    private String id;

    @JsonProperty("livestock_id")
    @Field("livestock_id")
    private String livestockId;

    // Denormalized snapshot so requests stay readable even if the animal
    // record changes later.
    @Field("animal_summary")
    private String animalSummary;

    @JsonProperty("seller_email")
    @Field("seller_email")
    private String sellerEmail;

    @Field("seller_name")
    private String sellerName;

    @JsonProperty("buyer_email")
    @Field("buyer_email")
    private String buyerEmail;

    @Field("buyer_name")
    private String buyerName;

    // The price the buyer offered; falls back to the asking price.
    private Double price;

    // PENDING, APPROVED or DECLINED
    private String status = STATUS_PENDING;

    @Field("created_at")
    private Date createdAt;

    @Field("resolved_at")
    private Date resolvedAt;

    @JsonProperty("resolved_by")
    @Field("resolved_by")
    private String resolvedBy;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getLivestockId() {
        return livestockId;
    }

    public void setLivestockId(String livestockId) {
        this.livestockId = livestockId;
    }

    public String getAnimalSummary() {
        return animalSummary;
    }

    public void setAnimalSummary(String animalSummary) {
        this.animalSummary = animalSummary;
    }

    public String getSellerEmail() {
        return sellerEmail;
    }

    public void setSellerEmail(String sellerEmail) {
        this.sellerEmail = sellerEmail;
    }

    public String getSellerName() {
        return sellerName;
    }

    public void setSellerName(String sellerName) {
        this.sellerName = sellerName;
    }

    public String getBuyerEmail() {
        return buyerEmail;
    }

    public void setBuyerEmail(String buyerEmail) {
        this.buyerEmail = buyerEmail;
    }

    public String getBuyerName() {
        return buyerName;
    }

    public void setBuyerName(String buyerName) {
        this.buyerName = buyerName;
    }

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Date resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public String getResolvedBy() {
        return resolvedBy;
    }

    public void setResolvedBy(String resolvedBy) {
        this.resolvedBy = resolvedBy;
    }
}
