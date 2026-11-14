# API Documentation

## 1. Overview

This document describes the HTTP endpoints exposed by the AI API Resilience Evaluation system.

The project contains two separate Express applications:

1. Main API — handles client requests and applies resilience strategies.
2. Mock Model Service — simulates an external AI model dependency.

Both applications run locally during development.

## 2. Base URLs

| Application | Base URL |
|---|---|
| Main API | `http://localhost:3000` |
| Mock Model Service | `http://localhost:4001` |

## 3. Main API Endpoints

### 3.1 Get API Information

**Endpoint:** `GET /`

Returns basic information about the main API.

**Example:**

```http
GET http://localhost:3000/
```

### 3.2 Health Check

**Endpoint:** `GET /health`

Checks whether the main API is running.

**Example:**

```http
GET http://localhost:3000/health
```

### 3.3 Generate Response

**Endpoint:** `POST /api/generate`

Sends a generation request through the main API to the mock model service.

The main API applies its configured resilience mechanisms when communicating with the upstream dependency.

**Request body:**

| Field | Type | Description |
|---|---|---|
| `prompt` | String | Input text sent to the simulated model |
| `mode` | String | Selects the mock model service behaviour |
| `delayMs` | Number | Optional delay duration for delay simulation |

**Example request:**

```json
{
  "prompt": "Explain artificial intelligence",
  "mode": "normal"
}
```

**Supported simulation modes:**

| Mode | Description |
|---|---|
| `normal` | Simulates a successful model response |
| `delay` | Simulates a delayed model response |
| `error` | Simulates an upstream HTTP 503 error |

For delay simulation:

```json
{
  "prompt": "Test delayed response",
  "mode": "delay",
  "delayMs": 3000
}
```

For upstream error simulation:

```json
{
  "prompt": "Test service failure",
  "mode": "error"
}
```

**Possible response status codes:**

| HTTP status | Meaning |
|---|---|
| `200` | Request processed successfully |
| `400` | Invalid client request or upstream request error |
| `502` | Upstream connection or gateway error |
| `503` | Model service unavailable or circuit breaker open |
| `504` | Upstream request timed out |

The exact response body depends on the outcome and the resilience mechanism involved.

### 3.4 Circuit Breaker Status

**Endpoint:** `GET /api/circuit-breaker`

Returns the current circuit breaker state and its configuration information.

**Example:**

```http
GET http://localhost:3000/api/circuit-breaker
```

**Response structure:**

```json
{
  "state": "CLOSED",
  "failureCount": 0,
  "failureThreshold": 3,
  "resetTimeoutMs": 10000,
  "probeInProgress": false
}
```

| Field | Description |
|---|---|
| `state` | Current circuit breaker state |
| `failureCount` | Number of recorded failures |
| `failureThreshold` | Number of failures required to open the circuit |
| `resetTimeoutMs` | Waiting period before recovery is attempted |
| `probeInProgress` | Indicates whether a recovery probe is currently running |

## 4. Mock Model Service Endpoints

The mock model service represents the external dependency used during controlled experiments.

### 4.1 Health Check

**Endpoint:** `GET /health`

Checks whether the mock model service is running.

**Example:**

```http
GET http://localhost:4001/health
```

### 4.2 Generate Simulated Model Response

**Endpoint:** `POST /generate`

Receives a generation request and returns a simulated response according to the selected mode.

**Example request:**

```json
{
  "prompt": "Explain artificial intelligence",
  "mode": "normal"
}
```

The service supports normal responses, artificial delays, and simulated HTTP errors.

## 5. Running the Applications

Open two PowerShell terminals in the project directory.

**Terminal 1 — Start the mock model service:**

```powershell
npm run dev:mock
```

**Terminal 2 — Start the main API:**

```powershell
npm run dev
```

The main API is available at:

`http://localhost:3000`

The mock model service is available at:

`http://localhost:4001`

## 6. Testing the API

The API can be tested using:

- PowerShell HTTP requests.
- Postman or another API testing client.
- Automated tests using Node.js and Supertest.

Run the automated test suite:

```powershell
npm test
```

## 7. Related Documentation

- [System Architecture](architecture.md)
- [Resilience Strategies](resilience-strategies.md)

## 8. Documentation Scope

This document describes the current API implementation.

As the project develops, endpoint behaviour, request validation, response structures, and experimental configuration may be updated. This documentation should be maintained alongside those changes.