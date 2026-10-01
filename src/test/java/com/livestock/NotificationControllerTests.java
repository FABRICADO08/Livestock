package com.livestock;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(NotificationController.class)
class NotificationControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NotificationRepository notificationRepository;

    @MockBean
    private AuthSupport auth;

    private MockHttpSession sessionAs(String email) {
        MockHttpSession session = new MockHttpSession();
        when(auth.requireEmail(session)).thenReturn(email);
        return session;
    }

    @Test
    void listReturnsOwnNotifications() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        Notification notification = new Notification();
        notification.setId("n1");
        notification.setRecipientEmail("user@example.com");
        notification.setType(Notification.TYPE_PURCHASE_CREATED);
        notification.setTitle("New purchase request");
        notification.setMessage("A buyer wants your animal");
        when(notificationRepository.findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc("user@example.com"))
                .thenReturn(List.of(notification));

        mockMvc.perform(get("/api/notifications/").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id", is("n1")))
                .andExpect(jsonPath("$[0].title", is("New purchase request")))
                .andExpect(jsonPath("$[0].read", is(false)));
    }

    @Test
    void unreadCountReturnsCount() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");
        when(notificationRepository.countByRecipientEmailIgnoreCaseAndReadFalse("user@example.com"))
                .thenReturn(3L);

        mockMvc.perform(get("/api/notifications/unread-count").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread", is(3)));
    }

    @Test
    void markReadUpdatesNotification() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        Notification notification = new Notification();
        notification.setId("n1");
        notification.setRecipientEmail("user@example.com");
        when(notificationRepository.findById("n1")).thenReturn(Optional.of(notification));

        mockMvc.perform(put("/api/notifications/n1/read").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")));

        verify(notificationRepository).save(any(Notification.class));
        org.assertj.core.api.Assertions.assertThat(notification.isRead()).isTrue();
    }

    @Test
    void markReadRejectsOtherUsersNotification() throws Exception {
        MockHttpSession session = sessionAs("intruder@example.com");

        Notification notification = new Notification();
        notification.setId("n1");
        notification.setRecipientEmail("owner@example.com");
        when(notificationRepository.findById("n1")).thenReturn(Optional.of(notification));

        mockMvc.perform(put("/api/notifications/n1/read").session(session))
                .andExpect(status().isForbidden());

        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    void markReadMissingNotificationReturns404() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");
        when(notificationRepository.findById("missing")).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/notifications/missing/read").session(session))
                .andExpect(status().isNotFound());
    }
}
