package com.livestock;

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(LivestockController.class)
class LivestockControllerValidationTests {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LivestockRepository livestockRepository;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private MongoTemplate mongoTemplate;

    @MockBean
    private AuthSupport auth;

    private MockHttpSession sessionAs(String email) {
        MockHttpSession session = new MockHttpSession();
        when(auth.requireEmail(session)).thenReturn(email);
        when(auth.currentUserRole(session)).thenReturn("USER");
        return session;
    }

    @Test
    void createAcceptsSnakeCaseDateOfBirth() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");
        when(livestockRepository.save(any(Livestock.class))).thenAnswer(invocation -> {
            Livestock saved = invocation.getArgument(0);
            saved.setId("abc123");
            return saved;
        });

        String body = "{"
                + "\"species\":\"Cattle\","
                + "\"breed\":\"Angus\","
                + "\"weight\":250.5,"
                + "\"health_status\":\"Healthy\","
                + "\"gender\":\"Female\","
                + "\"classification\":\"Cow\","
                + "\"date_of_birth\":\"2020-01-15\""
                + "}";

        mockMvc.perform(post("/api/livestock/")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")))
                .andExpect(jsonPath("$.message", is("Record saved successfully")));

        ArgumentCaptor<Livestock> captor = ArgumentCaptor.forClass(Livestock.class);
        verify(livestockRepository).save(captor.capture());
        Livestock saved = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(saved.getDateOfBirth()).isEqualTo("2020-01-15");
        org.assertj.core.api.Assertions.assertThat(saved.getHealthStatus()).isEqualTo("Healthy");
        org.assertj.core.api.Assertions.assertThat(saved.getAge()).isNotNull();
    }

    @Test
    void createRejectsFutureDateOfBirth() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        String body = "{\"species\":\"Cattle\",\"date_of_birth\":\"2999-01-01\"}";

        mockMvc.perform(post("/api/livestock/")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error",
                        is("Date of birth is required in YYYY-MM-DD format and cannot be in the future")));
    }

    @Test
    void updateAcceptsSnakeCaseDateOfBirth() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        Livestock existing = new Livestock();
        existing.setId("abc123");
        existing.setCreatedByEmail("user@example.com");
        when(livestockRepository.findById("abc123")).thenReturn(Optional.of(existing));
        when(livestockRepository.save(any(Livestock.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String body = "{\"species\":\"Sheep\",\"breed\":\"Merino\",\"date_of_birth\":\"2019-06-01\"}";

        mockMvc.perform(put("/api/livestock/abc123")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")))
                .andExpect(jsonPath("$.message", is("Record updated successfully")));

        ArgumentCaptor<Livestock> captor = ArgumentCaptor.forClass(Livestock.class);
        verify(livestockRepository).save(captor.capture());
        Livestock saved = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(saved.getDateOfBirth()).isEqualTo("2019-06-01");
        org.assertj.core.api.Assertions.assertThat(saved.getAge()).isNotNull();
    }

    @Test
    void createRejectsDuplicateIdTag() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        Livestock existing = new Livestock();
        existing.setId("other1");
        existing.setIdTag("APP-321");
        when(livestockRepository.findAll()).thenReturn(java.util.List.of(existing));

        String body = "{\"species\":\"Cattle\",\"date_of_birth\":\"2025-05-06\",\"id_tag\":\"app-321\"}";

        mockMvc.perform(post("/api/livestock/")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error",
                        is("An animal with ID tag 'app-321' already exists. ID tags must be unique.")));
    }

    @Test
    void updateAllowsSameIdTagOnSameRecord() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        Livestock existing = new Livestock();
        existing.setId("abc123");
        existing.setIdTag("APP-321");
        existing.setCreatedByEmail("user@example.com");
        when(livestockRepository.findById("abc123")).thenReturn(Optional.of(existing));
        when(livestockRepository.findAll()).thenReturn(java.util.List.of(existing));
        when(livestockRepository.save(any(Livestock.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String body = "{\"species\":\"Cattle\",\"date_of_birth\":\"2025-05-06\",\"id_tag\":\"APP-321\"}";

        mockMvc.perform(put("/api/livestock/abc123")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")));
    }

    @Test
    void getByIdReturnsRecord() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        Livestock existing = new Livestock();
        existing.setId("abc123");
        existing.setSpecies("Cattle");
        existing.setBreed("Angus");
        when(livestockRepository.findById("abc123")).thenReturn(Optional.of(existing));

        mockMvc.perform(get("/api/livestock/abc123").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("abc123")))
                .andExpect(jsonPath("$.species", is("Cattle")))
                .andExpect(jsonPath("$.breed", is("Angus")));
    }

    @Test
    void getByIdReturnsNotFoundForUnknownId() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");
        when(livestockRepository.findById("missing")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/livestock/missing").session(session))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("Record not found")));
    }

    @Test
    void buyerCannotCreateLivestock() throws Exception {
        MockHttpSession session = new MockHttpSession();
        when(auth.requireEmail(session)).thenReturn("buyer@example.com");
        when(auth.currentUserRole(session)).thenReturn("BUYER");

        String body = "{\"species\":\"Cattle\",\"date_of_birth\":\"2025-05-06\"}";

        mockMvc.perform(post("/api/livestock/")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", is("Buyers cannot manage livestock records")));
    }

    @Test
    void createByAdminRequiresSellerAssignment() throws Exception {
        MockHttpSession session = new MockHttpSession();
        when(auth.requireEmail(session)).thenReturn("admin@example.com");
        when(auth.currentUserRole(session)).thenReturn("ADMIN");

        String body = "{\"species\":\"Cattle\",\"date_of_birth\":\"2020-01-15\"}";

        mockMvc.perform(post("/api/livestock/")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error",
                        is("Admins must assign the animal to a seller (owner_email is required)")));
    }

    @Test
    void createByAdminAssignsAnimalToSeller() throws Exception {
        MockHttpSession session = new MockHttpSession();
        when(auth.requireEmail(session)).thenReturn("admin@example.com");
        when(auth.currentUserRole(session)).thenReturn("ADMIN");

        User seller = new User();
        seller.setId("u1");
        seller.setEmail("seller@example.com");
        seller.setName("Sam Seller");
        seller.setRole("USER");
        when(userRepository.findAll()).thenReturn(java.util.List.of(seller));
        when(auth.normalizeRole("USER")).thenReturn("USER");
        when(livestockRepository.save(any(Livestock.class))).thenAnswer(invocation -> {
            Livestock saved = invocation.getArgument(0);
            saved.setId("abc123");
            return saved;
        });

        String body = "{"
                + "\"species\":\"Cattle\","
                + "\"breed\":\"Angus\","
                + "\"date_of_birth\":\"2020-01-15\","
                + "\"owner_email\":\"seller@example.com\""
                + "}";

        mockMvc.perform(post("/api/livestock/")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")));

        ArgumentCaptor<Livestock> captor = ArgumentCaptor.forClass(Livestock.class);
        verify(livestockRepository).save(captor.capture());
        Livestock saved = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(saved.getCreatedByEmail()).isEqualTo("seller@example.com");
        org.assertj.core.api.Assertions.assertThat(saved.getCreatedBy()).isEqualTo("Sam Seller");
        org.assertj.core.api.Assertions.assertThat(saved.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void getByIdIncludesStatusInResponse() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        Livestock existing = new Livestock();
        existing.setId("abc123");
        existing.setSpecies("Cattle");
        existing.setStatus("SOLD");
        when(livestockRepository.findById("abc123")).thenReturn(Optional.of(existing));

        mockMvc.perform(get("/api/livestock/abc123").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SOLD")));
    }

    @Test
    void updatePersistsStatusChange() throws Exception {
        MockHttpSession session = sessionAs("user@example.com");

        Livestock existing = new Livestock();
        existing.setId("abc123");
        existing.setCreatedByEmail("user@example.com");
        existing.setStatus("ACTIVE");
        when(livestockRepository.findById("abc123")).thenReturn(Optional.of(existing));
        when(livestockRepository.save(any(Livestock.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String body = "{\"species\":\"Cattle\",\"date_of_birth\":\"2020-01-15\",\"status\":\"SOLD\"}";

        mockMvc.perform(put("/api/livestock/abc123")
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")));

        ArgumentCaptor<Livestock> captor = ArgumentCaptor.forClass(Livestock.class);
        verify(livestockRepository).save(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().getStatus()).isEqualTo("SOLD");
    }
}
