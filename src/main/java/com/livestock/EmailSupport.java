package com.livestock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/**
 * Best-effort email notifications for purchase request status changes.
 * Emails are only sent when an SMTP host is configured (MAIL_HOST); without
 * mail configuration every notification is skipped silently so the purchase
 * workflow keeps working.
 */
@Component
public class EmailSupport {

    private final AuthSupport auth;
    private final JavaMailSender mailSender;
    private final String fromAddress;

    public EmailSupport(AuthSupport auth,
                        @Value("${spring.mail.host:}") String mailHost,
                        @Value("${spring.mail.port:587}") int mailPort,
                        @Value("${spring.mail.username:}") String mailUsername,
                        @Value("${spring.mail.password:}") String mailPassword,
                        @Value("${MAIL_FROM:}") String fromAddress) {
        this.auth = auth;
        String host = firstNonBlank(mailHost, auth.getConfigValue("MAIL_HOST"));
        if (host == null) {
            this.mailSender = null;
        } else {
            JavaMailSenderImpl sender = new JavaMailSenderImpl();
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
            this.mailSender = sender;
        }
        this.fromAddress = firstNonBlank(fromAddress, auth.getConfigValue("MAIL_FROM"),
                firstNonBlank(mailUsername, auth.getConfigValue("MAIL_USERNAME")));
    }

    public boolean isEnabled() {
        return mailSender != null;
    }

    /** Sends an email; failures are logged and never break the caller. */
    public void send(String to, String subject, String text) {
        if (mailSender == null || to == null || to.isBlank()) {
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            if (fromAddress != null) {
                message.setFrom(fromAddress);
            }
            message.setTo(to.trim());
            message.setSubject(subject);
            message.setText(text);
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("Email to " + to + " failed: " + e.getMessage());
        }
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
