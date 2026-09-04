package com.livestock;

import java.util.Map;
import javax.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pricing")
public class PricingController {

    private final LivestockRepository livestockRepository;
    private final PriceSupport priceSupport;
    private final AuthSupport auth;

    public PricingController(LivestockRepository livestockRepository, PriceSupport priceSupport, AuthSupport auth) {
        this.livestockRepository = livestockRepository;
        this.priceSupport = priceSupport;
        this.auth = auth;
    }

    @GetMapping("/suggestions")
    public Map<String, Object> suggestions(@RequestParam(name = "species", required = false) String species,
                                           HttpSession session) {
        auth.requireEmail(session);
        PriceSupport.Suggestion suggestion = priceSupport.suggest(livestockRepository.findAll(), species);
        return priceSupport.toJson(suggestion);
    }
}
