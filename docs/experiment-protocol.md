# Experimental Protocol

## 1. Introduction

This document defines the experimental methodology for evaluating lightweight resilience strategies in an AI-powered web API under controlled model-service failures.

The experiments investigate the effectiveness of timeout handling, bounded retries, and circuit breaker mechanisms individually and in combination.

A separate mock model service is used to simulate controlled upstream operating conditions, allowing experiments to be conducted without depending on an external AI provider.

## 2. Research Objective

The primary objective is to empirically evaluate how lightweight resilience strategies influence the reliability and performance of an AI-powered web API when its dependent model service experiences failures.

The evaluation focuses on:

- Request success and failure rates.
- Response latency.
- Upstream request attempts.
- Circuit breaker behaviour.
- Recovery behaviour following service failures.

## 3. Experimental Environment

### 3.1 Application Components

| Component | Technology | Responsibility |
|---|---|---|
| Main API | Node.js and Express | Handles client requests and applies resilience mechanisms |
| Mock Model Service | Node.js and Express | Simulates model-service behaviour and failures |
| Automated Testing | Node.js test runner and Supertest | Verifies application behaviour |
| Data Analysis | Python, pandas and Matplotlib | Processes experimental data and generates charts |

### 3.2 Default Configuration

The current implementation uses the following default configuration:

| Parameter | Value |
|---|---:|
| Main API port | 3000 |
| Mock model service port | 4001 |
| Upstream timeout | 2,000 ms |
| Maximum additional retries | 2 |
| Maximum total attempts | 3 |
| Retry delay | 250 ms |
| Circuit failure threshold | 3 |
| Circuit reset timeout | 10,000 ms |

These values describe the current implementation defaults. Experimental configurations may use different values when investigating parameter sensitivity.

## 4. Independent Variables

The independent variables are the resilience strategies applied to the main API.

The planned experimental configurations are:

| Configuration | Timeout | Retries | Circuit breaker |
|---|---|---|---|
| Baseline | Disabled | Disabled | Disabled |
| Timeout only | Enabled | Disabled | Disabled |
| Retries only | Disabled | Enabled | Disabled |
| Circuit breaker only | Disabled | Disabled | Enabled |
| Timeout + retries | Enabled | Enabled | Disabled |
| Timeout + circuit breaker | Enabled | Disabled | Enabled |
| Retries + circuit breaker | Disabled | Enabled | Enabled |
| Combined | Enabled | Enabled | Enabled |

**Implementation requirement:** The baseline and individual configurations require controllable mechanism settings in the main API. They must be implemented and verified before the comparative experiments begin. The current implementation should not be assumed to support every configuration yet.

## 5. Controlled Failure Scenarios

The mock model service provides controlled conditions for evaluating API behaviour.

### Scenario 1 — Normal Operation

The model service responds successfully without artificial delay.

Purpose:

Establish normal operating behaviour and provide a reference for comparing other scenarios.

### Scenario 2 — Delayed Response

The model service introduces an artificial delay longer than the configured API timeout.

Example:

- Configured API timeout: 2,000 ms.
- Simulated model-service delay: 3,000 ms.

Purpose:

Evaluate timeout handling and the impact of delayed upstream responses.

### Scenario 3 — Temporary Upstream Errors

The model service returns simulated HTTP 503 responses.

Purpose:

Evaluate how bounded retries and the circuit breaker respond to temporary upstream failures.

### Scenario 4 — Complete Service Unavailability

The mock model service is stopped while the main API remains running.

Purpose:

Evaluate how the API handles connection failures and prevents repeated requests to an unavailable dependency.

### Scenario 5 — Service Recovery

The mock model service is restarted after a period of unavailability.

Purpose:

Evaluate recovery behaviour, including the circuit breaker's transition through its recovery state.

## 6. Dependent Variables and Evaluation Metrics

The dependent variables are the measurable outcomes collected during experiments.

| Metric | Measurement | Purpose |
|---|---|---|
| Success rate | Successful requests / total requests × 100 | Measures request reliability |
| Failure rate | Failed requests / total requests × 100 | Measures unsuccessful requests |
| Average latency | Mean response time | Measures average API response time |
| Median latency | 50th percentile | Represents typical response time |
| 95th percentile latency | 95th percentile | Measures slower response behaviour |
| Upstream attempts | Total upstream attempts | Measures additional request activity |
| Recovery time | Time between service recovery and successful API recovery | Measures recovery behaviour |

Latency should be recorded from the client's perspective, including the time spent waiting for retries and handling failures.

## 7. Experimental Procedure

Each experimental configuration should follow a consistent procedure.

1. Start the mock model service.
2. Start the main API with the selected experimental configuration.
3. Verify that both applications are running.
4. Confirm the circuit breaker starts in the expected state, where applicable.
5. Apply the selected failure scenario.
6. Send the defined set of API requests.
7. Record response status, response latency, request attempts, and relevant circuit breaker state changes.
8. Restore the mock model service when necessary.
9. Observe and record recovery behaviour.
10. Save the collected results in the appropriate experiment directory.

For experiments involving circuit breaker state, reset the application or use a verified reset procedure between independent trials to prevent previous failures from influencing subsequent results.

## 8. Repetitions and Experimental Consistency

Each experimental condition should be repeated to reduce the influence of random variation.

The initial target is 30 requests per condition, subject to practical feasibility and the behaviour being investigated.

For circuit breaker and recovery experiments, additional controlled trials should be performed to capture state transitions and recovery outcomes.

The following conditions should remain consistent across comparable experiments:

- Same hardware and local execution environment.
- Same request payloads.
- Same failure scenario and simulated delay.
- Same configuration values.
- Same request volume and execution procedure.
- Same data collection approach.

Record the actual number of requests and repetitions completed. Do not discard unsuccessful requests from the results.

## 9. Data Collection

Experimental observations should be saved as structured CSV files.

Suggested structure:

```text
results/
├── raw/
│   ├── normal-operation.csv
│   ├── delayed-response.csv
│   ├── temporary-errors.csv
│   ├── service-unavailability.csv
│   └── service-recovery.csv
├── processed/
├── charts/
└── summary/
```

Suggested raw data fields:

| Field | Description |
|---|---|
| experiment_id | Unique experiment identifier |
| timestamp | Time the request was performed |
| configuration | Active resilience configuration |
| scenario | Failure scenario |
| request_number | Request sequence number |
| status_code | HTTP response status |
| success | Whether the request succeeded |
| latency_ms | Total client-observed response time |
| upstream_attempts | Number of upstream attempts |
| circuit_state | Observed circuit breaker state |

Additional fields may be introduced where necessary to capture retry outcomes and recovery events.

## 10. Data Analysis

The collected data will be processed using Python.

The analysis will include:

- Comparing success and failure rates across configurations.
- Comparing average, median, and 95th percentile latency.
- Evaluating upstream request attempts.
- Examining circuit breaker state transitions.
- Comparing recovery behaviour across relevant scenarios.

Charts will be used to communicate differences between experimental configurations.

The analysis should report observed results rather than assume that a particular resilience strategy will always perform better.

## 11. Validity and Limitations

### 11.1 Controlled Environment

Using a mock model service allows repeatable failure simulation. However, it cannot fully reproduce the variability of real external AI services.

### 11.2 Local Execution

Running both applications on the same machine introduces limitations when generalising performance results to distributed production environments.

### 11.3 Experimental Configuration

Results depend on selected timeout values, retry limits, failure thresholds, and simulated failure conditions. These settings must be reported alongside the findings.

### 11.4 Scope

The research evaluates API-level reliability and resilience. It does not evaluate the accuracy, intelligence, or quality of an actual AI model.

## 12. Expected Research Contribution

The project aims to provide empirical evidence about the effectiveness and trade-offs of lightweight resilience strategies in AI-powered web APIs under controlled model-service failures.

The findings will identify how individual and combined strategies influence reliability, latency, upstream request activity, and recovery behaviour.