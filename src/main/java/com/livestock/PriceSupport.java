package com.livestock;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Suggests an asking price for an animal based on the average price of
 * previously listed animals of the same species (falling back to all
 * listings). Used to pre-fill the price field in buy/add flows.
 */
@Component
public class PriceSupport {

    public static final class Suggestion {
        public final Double price;
        public final String currency;
        public final String basis;
        public final int sampleSize;

        Suggestion(Double price, String currency, String basis, int sampleSize) {
            this.price = price;
            this.currency = currency;
            this.basis = basis;
            this.sampleSize = sampleSize;
        }
    }

    public Suggestion suggest(List<Livestock> animals, String species) {
        List<Livestock> priced = animals == null ? List.of() : animals.stream()
                .filter(a -> a.getPrice() != null && a.getPrice() > 0)
                .collect(Collectors.toList());

        String normalizedSpecies = species == null ? "" : species.trim();
        List<Livestock> sameSpecies = priced.stream()
                .filter(a -> a.getSpecies() != null
                        && a.getSpecies().equalsIgnoreCase(normalizedSpecies))
                .collect(Collectors.toList());

        if (!normalizedSpecies.isEmpty() && !sameSpecies.isEmpty()) {
            return new Suggestion(round2(avg(sameSpecies)), "ZAR",
                    "average_price_same_species", sameSpecies.size());
        }
        if (!priced.isEmpty()) {
            return new Suggestion(round2(avg(priced)), "ZAR",
                    "average_price_all_species", priced.size());
        }
        return new Suggestion(null, "ZAR", "no_price_data", 0);
    }

    public Map<String, Object> toJson(Suggestion suggestion) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("suggested_price", suggestion.price);
        json.put("currency", suggestion.currency);
        json.put("basis", suggestion.basis);
        json.put("sample_size", suggestion.sampleSize);
        return json;
    }

    private double avg(List<Livestock> animals) {
        return animals.stream()
                .map(Livestock::getPrice)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0);
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
