package com.livestock;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Simple in-memory fixed-window rate limiter for sensitive endpoints
 * (authentication, purchase requests). Buckets reset after the window
 * elapses; excess requests are rejected with HTTP 429.
 */
@Component
public class RateLimitSupport {

    private static class Bucket {
        volatile long windowStartMillis;
        volatile long windowMillis;
        final AtomicInteger count = new AtomicInteger(0);
    }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicInteger checks = new AtomicInteger();

    /**
     * Allows up to {@code maxRequests} per {@code windowMillis} for the key;
     * throws 429 when the limit is exceeded.
     */
    public void check(String key, int maxRequests, long windowMillis) {
        if (key == null || key.isBlank()) {
            key = "anonymous";
        }
        long now = System.currentTimeMillis();
        if (checks.incrementAndGet() % 256 == 0) {
            buckets.entrySet().removeIf(entry -> {
                Bucket candidate = entry.getValue();
                synchronized (candidate) {
                    return now - candidate.windowStartMillis >= candidate.windowMillis;
                }
            });
        }
        Bucket bucket = buckets.computeIfAbsent(key, k -> {
            Bucket b = new Bucket();
            b.windowStartMillis = now;
            b.windowMillis = windowMillis;
            return b;
        });
        synchronized (bucket) {
            if (now - bucket.windowStartMillis >= windowMillis) {
                bucket.windowStartMillis = now;
                bucket.windowMillis = windowMillis;
                bucket.count.set(0);
            }
            if (bucket.count.incrementAndGet() > maxRequests) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Too many requests - please wait a moment and try again");
            }
        }
    }
}
