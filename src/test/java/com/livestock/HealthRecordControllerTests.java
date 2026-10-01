package com.livestock;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HealthRecordController.class)
class HealthRecordControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private HealthRecordRepository healthRecordRepository;

    @MockBean
    private LivestockRepository livestockRepository;

    @MockBean
    private AuthSupport auth;

    @MockBean
    private NotificationSupport notifications;

    private MockHttpSession sessionAs(String email) {
        MockHttpSession session = new MockHttpSession();
        when(auth.requireEmail(session)).thenReturn(email);
        when(auth.currentUserRole(session)).thenReturn("USER");
        return session;
    }

    private Livestock ownedAnimal(String email) {
        Livestock animal = new Livestock();
        animal.setId("a1");
        animal.setSpecies("Cattle");
        animal.setCreatedByEmail(email);
        return animal;
    }

    @Test
    void listReturnsRecordsForAnimal() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");
        when(livestockRepository.findById("a1")).thenReturn(Optional.of(ownedAnimal("user@example.com")));

        HealthRecord record = new HealthRecord();
        record.setId("h1");
        record.setLivestockId("a1");
        record.setType("Vaccination");
        record.setRecordDate("2026-09-01");
        record.setNextDueDate("2027-09-01");
        when(healthRecordRepository.findByLivestockId("a1")).thenReturn(List.of(record));

        mockMvc.perform(get("/api/livestock/a1/health-records").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id", is("h1")))
                .andExpect(jsonPath("$[0].type", is("Vaccination")))
                .andExpect(jsonPath("$[0].next_due_date", is("2027-09-01")));
    }

    @Test
    void createSavesRecordAndMarksVaccinated() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");
        Livestock animal = ownedAnimal("user@example.com");
        when(livestockRepository.findById("a1")).thenReturn(Optional.of(animal));
        when(healthRecordRepository.save(any(HealthRecord.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        String body = "{"
                + "\"type\":\"Vaccination\","
                + "\"record_date\":\"2026-09-30\","
                + "\"next_due_date\":\"2027-09-30\","
                + "\"vet\":\"Dr. Smith\","
                + "\"notes\":\"Annual vaccine\""
                + "}";

        mockMvc.perform(post("/api/livestock/a1/health-records")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")))
                .andExpect(jsonPath("$.record.type", is("Vaccination")));

        ArgumentCaptor<HealthRecord> captor = ArgumentCaptor.forClass(HealthRecord.class);
        verify(healthRecordRepository).save(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().getLivestockId()).isEqualTo("a1");
        org.assertj.core.api.Assertions.assertThat(captor.getValue().getCreatedByEmail())
                .isEqualTo("user@example.com");

        // A vaccination updates the animal's vaccination status
        verify(livestockRepository).save(animal);
        org.assertj.core.api.Assertions.assertThat(animal.getVaccinationStatus()).isEqualTo("Vaccinated");
    }

    @Test
    void createRejectsInvalidType() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");
        when(livestockRepository.findById("a1")).thenReturn(Optional.of(ownedAnimal("user@example.com")));

        String body = "{\"type\":\"Surgery\",\"record_date\":\"2026-09-30\"}";

        mockMvc.perform(post("/api/livestock/a1/health-records")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("Type must be Vaccination, Treatment or Checkup")));
    }

    @Test
    void createRejectsMissingDate() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");
        when(livestockRepository.findById("a1")).thenReturn(Optional.of(ownedAnimal("user@example.com")));

        String body = "{\"type\":\"Checkup\"}";

        mockMvc.perform(post("/api/livestock/a1/health-records")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createRejectsOtherUsersAnimal() throws Exception {
        MockHttpSession session = sessionAs("intruder@example.com");
        when(livestockRepository.findById("a1")).thenReturn(Optional.of(ownedAnimal("owner@example.com")));

        String body = "{\"type\":\"Checkup\",\"record_date\":\"2026-09-30\"}";

        mockMvc.perform(post("/api/livestock/a1/health-records")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void buyerCannotAddHealthRecord() throws Exception {
        MockHttpSession session = new MockHttpSession();
        when(auth.requireEmail(session)).thenReturn("buyer@example.com");
        when(auth.currentUserRole(session)).thenReturn("BUYER");
        when(livestockRepository.findById("a1")).thenReturn(Optional.of(ownedAnimal("owner@example.com")));

        String body = "{\"type\":\"Checkup\",\"record_date\":\"2026-09-30\"}";

        mockMvc.perform(post("/api/livestock/a1/health-records")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void reminderCandidateLogic() {
        HealthRecord due = new HealthRecord();
        due.setNextDueDate(java.time.LocalDate.now().toString());
        org.assertj.core.api.Assertions.assertThat(HealthRecordController.isReminderCandidate(due)).isTrue();
        org.assertj.core.api.Assertions.assertThat(HealthRecordController.daysUntilDue(due)).isZero();

        HealthRecord overdue = new HealthRecord();
        overdue.setNextDueDate(java.time.LocalDate.now().minusDays(5).toString());
        org.assertj.core.api.Assertions.assertThat(HealthRecordController.isReminderCandidate(overdue)).isTrue();
        org.assertj.core.api.Assertions.assertThat(HealthRecordController.daysUntilDue(overdue)).isEqualTo(-5);

        HealthRecord future = new HealthRecord();
        future.setNextDueDate(java.time.LocalDate.now().plusDays(90).toString());
        org.assertj.core.api.Assertions.assertThat(HealthRecordController.isReminderCandidate(future)).isFalse();

        HealthRecord none = new HealthRecord();
        org.assertj.core.api.Assertions.assertThat(HealthRecordController.isReminderCandidate(none)).isFalse();
        org.assertj.core.api.Assertions.assertThat(HealthRecordController.daysUntilDue(none)).isNull();
    }
}
