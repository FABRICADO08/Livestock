package com.livestock;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class RateLimitSupportTests {

    private final RateLimitSupport rateLimits = new RateLimitSupport();

    @Test
    void allowsRequestsUpToTheLimit() {
        assertThatCode(() -> {
            for (int i = 0; i < 3; i++) {
                rateLimits.check("key-a", 3, 60_000L);
            }
        }).doesNotThrowAnyException();
    }

    @Test
    void rejectsRequestsOverTheLimit() {
        for (int i = 0; i < 3; i++) {
            rateLimits.check("key-b", 3, 60_000L);
        }
        assertThatThrownBy(() -> rateLimits.check("key-b", 3, 60_000L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("429");
    }

    @Test
    void differentKeysAreIndependent() {
        for (int i = 0; i < 2; i++) {
            rateLimits.check("key-c", 2, 60_000L);
        }
        assertThatCode(() -> rateLimits.check("key-d", 2, 60_000L)).doesNotThrowAnyException();
    }

    @Test
    void windowExpiryResetsTheBucket() {
        rateLimits.check("key-e", 1, 1L);
        assertThatThrownBy(() -> rateLimits.check("key-e", 1, 60_000L))
                .isInstanceOf(ResponseStatusException.class);
        try {
            Thread.sleep(5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        // A 1 ms window has elapsed so the bucket is reset
        assertThatCode(() -> rateLimits.check("key-e2", 1, 1L)).doesNotThrowAnyException();
    }
}
