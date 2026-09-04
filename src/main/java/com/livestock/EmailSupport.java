package com.livestock;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/**
 * Best-effort email notifications for purchase request status changes.
 * Emails are only sent when an SMTP host is configured (MAIL_HOST) and
 * reachable; without working mail configuration every notification is skipped
 * silently so the purchase workflow keeps working. Sending happens on a
 * background thread so a slow or unreachable SMTP server never blocks a
 * request. Note that some hosting platforms (e.g. Render free web services)
 * block outbound SMTP ports, in which case email is disabled automatically.
 */
@Component
public class EmailSupport {

    /** Default sender for all marketplace notification emails. */
    private static final String DEFAULT_FROM = "not-reply.livestockmanegemnt@gmail.com";

    /** SMTP connection/read timeout so an unreachable server fails fast. */
    private static final String SMTP_TIMEOUT_MS = "10000";

    private final AuthSupport auth;
    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final ExecutorService mailExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "email-sender");
        thread.setDaemon(true);
        return thread;
    });

    public EmailSupport(AuthSupport auth,
                        @Value("${spring.mail.host:}") String mailHost,
                        @Value("${spring.mail.port:587}") int mailPort,
                        @Value("${spring.mail.username:}") String mailUsername,
                        @Value("${spring.mail.password:}") String mailPassword,
                        @Value("${spring.mail.from:}") String fromAddress) {
        this.auth = auth;
        String host = firstNonBlank(mailHost, auth.getConfigValue("MAIL_HOST"));
        JavaMailSenderImpl sender = null;
        if (host != null) {
            sender = new JavaMailSenderImpl();
            sender.setHost(host);
            sender.setPort(mailPort);
            String username = firstNonBlank(mailUsername, auth.getConfigValue("MAIL_USERNAME"));
            String password = firstNonBlank(mailPassword, auth.getConfigValue("MAIL_PASSWORD"));
            if (username != null) {
                sender.setUsername(username);
            }
            if (password != null) {
                sender.setPassword(password);
            }
            java.util.Properties props = sender.getJavaMailProperties();
            props.put("mail.smtp.auth", String.valueOf(username != null));
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.connectiontimeout", SMTP_TIMEOUT_MS);
            props.put("mail.smtp.timeout", SMTP_TIMEOUT_MS);
            props.put("mail.smtp.writetimeout", SMTP_TIMEOUT_MS);
            try {
                sender.testConnection();
            } catch (Exception e) {
                System.err.println("Email notifications disabled: cannot reach SMTP server "
                        + host + ":" + mailPort + " (" + e.getMessage() + ")");
                sender = null;
            }
        }
        this.mailSender = sender;
        this.fromAddress = firstNonBlank(fromAddress, System.getenv("MAIL_FROM"),
                auth.getConfigValue("MAIL_FROM"), DEFAULT_FROM);
    }

    public boolean isEnabled() {
        return mailSender != null;
    }

    /** Sends an email asynchronously; failures are logged and never break the caller. */
    public void send(String to, String subject, String text) {
        if (mailSender == null || to == null || to.isBlank()) {
            return;
        }
        String recipient = to.trim();
        mailExecutor.execute(() -> {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom("Animal Marketplace <" + fromAddress + ">");
                message.setTo(recipient);
                message.setSubject(subject);
                message.setText(text);
                mailSender.send(message);
            } catch (Exception e) {
                System.err.println("Email to " + recipient + " failed: " + e.getMessage());
            }
        });
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
