# Server Monitor

A lightweight Linux server monitoring agent built with **Node.js + TypeScript** that monitors system resources, services, databases, HTTP endpoints, and sends alerts through Telegram.

The agent is designed to run continuously on a Linux server using **PM2**.

---

## Features

### System Monitoring

The monitor currently tracks:

* CPU usage
* CPU load average
* CPU core count
* CPU temperature
* RAM usage
* Swap usage
* Disk usage
* System uptime
* Process count

### Service Monitoring

Services are configured through the `.env` file.

The monitor supports two health-check strategies:

* **systemd** — for Linux services such as Nginx and Apache
* **TCP** — for services that expose a network port such as databases and Redis

Supported services include:

| Service              | Check   |           Default |
| -------------------- | ------- | ----------------: |
| Nginx                | systemd |           `nginx` |
| Apache               | systemd |         `apache2` |
| MySQL                | TCP     |  `127.0.0.1:3306` |
| MariaDB              | TCP     |  `127.0.0.1:3306` |
| PostgreSQL           | TCP     |  `127.0.0.1:5432` |
| MongoDB              | TCP     | `127.0.0.1:27017` |
| Microsoft SQL Server | TCP     |  `127.0.0.1:1433` |
| Redis                | TCP     |  `127.0.0.1:6379` |

No database credentials are required for TCP health checks.

For example, if MySQL is listening on port `3306`, the monitor considers its TCP endpoint reachable even if the `mysql.service` systemd unit reports `inactive`.

### HTTP Endpoint Monitoring

Custom HTTP endpoints can also be monitored.

Example:

```env
ENDPOINTS=Sample API|http://127.0.0.1:9005,Sample Web|http://127.0.0.1:3000
```

Each endpoint is checked independently.

The monitor records:

* HTTP status code
* Response time
* Connection failures
* Timeout errors

### Telegram

Telegram is used for:

* Server status
* Metrics
* Service health
* Disk status
* Alerts
* Recovery notifications

Current commands:

```text
/status
/metrics
/services
/disk
/help
```

---

# Architecture

```text
                        ┌──────────────────────┐
                        │    Server Monitor    │
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
       System Metrics        Service Health       HTTP Health
              │                    │                    │
       ┌──────┼──────┐       ┌─────┴─────┐             │
       │      │      │       │           │             │
      CPU    RAM    Disk   systemd       TCP        Endpoints
                           │             │
                       Nginx/Apache   DB/Redis
                                     │
                    ┌────────────────┼─────────────────┐
                    │                │                 │
                  MySQL          PostgreSQL         MongoDB
                                     │
                                  MSSQL
                                     │
                                   Redis
              │
              ▼
       Threshold Engine
              │
              ▼
       Telegram Alerts
```

---

# Project Structure

```text
server-monitor/
├── src/
│   ├── config/
│   │   └── config.ts
│   │
│   ├── health/
│   │   ├── endpoint.health.ts
│   │   ├── health.service.ts
│   │   ├── service.health.ts
│   │   ├── service.registry.ts
│   │   └── tcp.health.ts
│   │
│   ├── metrics/
│   │   └── system.metrics.ts
│   │
│   ├── rules/
│   │   └── threshold.engine.ts
│   │
│   ├── telegram/
│   │   └── telegram.service.ts
│   │
│   ├── types/
│   │   └── metrics.ts
│   │
│   ├── utils/
│   │   └── format.ts
│   │
│   └── main.ts
│
├── .env
├── .env.example
├── .gitignore
├── ecosystem.config.cjs
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

---

# Requirements

* Linux server
* Node.js `>= 20`
* pnpm `>= 10`
* Telegram Bot
* PM2 for production deployment

The application uses Linux-specific functionality such as:

* `systemctl`
* Linux process information
* Linux filesystem information

Therefore the production target is Linux.

---

# Installation

## 1. Clone the project

```bash
git clone <repository-url>
cd server-monitor
```

---

## 2. Install dependencies

```bash
pnpm install
```

---

## 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit it:

```bash
nano .env
```

---

# Environment Configuration

Example:

```env
NODE_ENV=production

HOST_NAME=
MONITOR_INTERVAL_MS=30000

CPU_WARNING_THRESHOLD=85
RAM_WARNING_THRESHOLD=85
SWAP_WARNING_THRESHOLD=50
DISK_WARNING_THRESHOLD=90
LOAD_WARNING_MULTIPLIER=1.5
CPU_TEMP_WARNING_THRESHOLD=80

ALERT_AFTER_CONSECUTIVE_FAILURES=3
RECOVERY_THRESHOLD=75
ALERT_COOLDOWN_MS=900000

MONITORED_FILESYSTEMS=/

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

CHECK_SERVICES=true
SERVICES=nginx,mysql,redis

CHECK_ENDPOINTS=true
ENDPOINTS=Sample API|http://127.0.0.1:9005,Sample Web|http://127.0.0.1:3000

LOG_LEVEL=info
```

---

# Service Configuration

The `SERVICES` variable determines which services are monitored on the server.

Only services listed here are checked.

## Example: Nginx + MySQL + Redis

```env
SERVICES=nginx,mysql,redis
```

## Example: Apache + PostgreSQL

```env
SERVICES=apache,postgresql
```

## Example: Nginx + MongoDB

```env
SERVICES=nginx,mongodb
```

## Example: Nginx + Microsoft SQL Server

```env
SERVICES=nginx,mssql
```

Multiple services can be configured:

```env
SERVICES=nginx,mysql,redis,postgresql,mongodb
```

---

# How Service Checks Work

The monitor determines the check type from the service registry.

## systemd Services

Services such as Nginx and Apache are checked using:

```bash
systemctl is-active <service>
```

For example:

```text
nginx → systemctl is-active nginx
apache → systemctl is-active apache2
```

The result is reported as the systemd service state.

---

## TCP Services

Databases and Redis are checked through TCP.

For example:

```text
mysql      → 127.0.0.1:3306
postgresql → 127.0.0.1:5432
mongodb    → 127.0.0.1:27017
mssql      → 127.0.0.1:1433
redis      → 127.0.0.1:6379
```

The monitor attempts to establish a TCP connection and records:

* Reachability
* Response time
* Timeout
* Connection errors

No credentials are required.

### Why TCP instead of systemd?

A service can be operational even when its expected systemd unit is not the one currently controlling the process.

For example:

```text
mysql.service → inactive
mysqld         → running
127.0.0.1:3306 → listening
```

In this situation, checking the TCP endpoint provides a more useful application-level health signal than relying only on the systemd unit.

---

# Adding a New Service

Services are defined in:

```text
src/health/service.registry.ts
```

For example:

```ts
myservice: {
  name: "myservice",
  type: "tcp",
  host: "127.0.0.1",
  port: 1234
}
```

Then add it to `.env`:

```env
SERVICES=myservice
```

For a systemd service:

```ts
myservice: {
  name: "myservice",
  type: "systemd",
  systemdName: "myservice"
}
```

This makes the service system extensible without changing the main health-check logic.

---

# Thresholds

Resource alerts are controlled through environment variables.

## CPU

```env
CPU_WARNING_THRESHOLD=85
```

Alert when CPU usage exceeds 85%.

## RAM

```env
RAM_WARNING_THRESHOLD=85
```

Alert when RAM usage exceeds 85%.

## Swap

```env
SWAP_WARNING_THRESHOLD=50
```

Alert when swap usage exceeds 50%.

## Disk

```env
DISK_WARNING_THRESHOLD=90
```

Alert when a monitored filesystem exceeds 90%.

## Load

```env
LOAD_WARNING_MULTIPLIER=1.5
```

The load threshold is calculated relative to the number of CPU cores.

## CPU Temperature

```env
CPU_TEMP_WARNING_THRESHOLD=80
```

Alert when the CPU temperature exceeds 80°C.

---

# Consecutive Failures

To avoid alerts caused by a single temporary spike:

```env
ALERT_AFTER_CONSECUTIVE_FAILURES=3
```

For example, with a 30-second monitoring interval:

```text
Check 1 → CPU 92% → no alert
Check 2 → CPU 94% → no alert
Check 3 → CPU 91% → alert
```

This prevents transient events from generating unnecessary notifications.

---

# Alert Cooldown

```env
ALERT_COOLDOWN_MS=900000
```

The default is 15 minutes.

This prevents the same condition from repeatedly generating Telegram messages.

---

# Recovery Alerts

When an alert condition returns to normal, the monitor can send a recovery notification.

Example:

```text
🚨 CPU Alert

Usage: 94.2%
Threshold: 85%
```

After recovery:

```text
✅ CPU Recovered

Usage: 54.1%
Recovery threshold: 75%
```

---

# Monitored Filesystems

Configure which filesystems should be checked:

```env
MONITORED_FILESYSTEMS=/
```

Multiple mount points:

```env
MONITORED_FILESYSTEMS=/,/home,/var
```

Only configured mount points are included in disk monitoring.

---

# HTTP Endpoints

Configure endpoints using:

```text
Name|URL
```

Example:

```env
ENDPOINTS=Sample API|http://127.0.0.1:9005,Sample Web|http://127.0.0.1:3000
```

Multiple endpoints are separated by commas.

The monitor checks them concurrently.

An endpoint is considered healthy when it returns an HTTP status in the `200–499` range.

A connection failure or timeout is considered unhealthy.

---

# Telegram Commands

## `/status`

Shows a general server status including:

* CPU
* RAM
* Swap
* Disk
* Uptime
* Process count

---

## `/metrics`

Shows detailed system metrics.

Includes:

* CPU usage
* CPU load
* CPU cores
* CPU temperature
* RAM
* Swap
* Filesystems

---

## `/services`

Shows configured service health.

Example:

```text
🏥 Service Health

⚙️ Services

🟢 nginx — active
🟢 mysql — 127.0.0.1:3306 (1 ms)
🟢 redis — 127.0.0.1:6379 (1 ms)

🌐 HTTP Endpoints

🟢 Sample API — 404 (3 ms)
🟢 Sample Web — 200 (8 ms)
```

---

## `/disk`

Shows monitored filesystem usage.

---

## `/help`

Shows the available Telegram commands.

---

# Development

Run the monitor in development mode:

```bash
pnpm dev
```

This uses `tsx` watch mode.

---

# Build

Compile TypeScript:

```bash
pnpm build
```

The compiled application is generated in:

```text
dist/
```

---

# Type Checking

Run TypeScript without generating files:

```bash
pnpm typecheck
```

---

# Production

Build the project:

```bash
pnpm build
```

Start directly:

```bash
pnpm start
```

For production, PM2 is recommended.

---

# PM2

The project includes:

```text
ecosystem.config.cjs
```

Start:

```bash
pm2 start ecosystem.config.cjs
```

Check:

```bash
pm2 status
```

Logs:

```bash
pm2 logs server-monitor
```

Restart:

```bash
pm2 restart server-monitor
```

Stop:

```bash
pm2 stop server-monitor
```

Delete:

```bash
pm2 delete server-monitor
```

Save the PM2 process list:

```bash
pm2 save
```

Configure startup:

```bash
pm2 startup
```

Follow the command printed by PM2.

---

# Security

## Telegram credentials

Never commit `.env` to Git.

The `.gitignore` already includes:

```text
.env
```

The Telegram bot token should be treated as a secret.

## Telegram chat restriction

The monitor validates incoming Telegram commands against:

```env
TELEGRAM_CHAT_ID=...
```

Only the configured chat ID is allowed to control the monitor.

## Database credentials

The current service health checks do not require database credentials.

TCP checks only verify that the service is reachable.

---

# Monitoring Philosophy

The monitor intentionally separates different levels of health:

```text
System Health
     │
     ├── CPU
     ├── RAM
     ├── Swap
     ├── Disk
     ├── Load
     └── Temperature

Service Health
     │
     ├── systemd services
     │      ├── Nginx
     │      └── Apache
     │
     └── TCP services
            ├── MySQL
            ├── PostgreSQL
            ├── MongoDB
            ├── MSSQL
            └── Redis

Application Health
     │
     └── HTTP endpoints
            ├── API
            └── Web
```

This allows infrastructure checks to remain independent from application-specific credentials.

---

# Future Improvements

The current architecture is intentionally designed so additional monitoring features can be added without changing the core monitoring loop.

Potential future checks include:

* PM2 process monitoring
* Process CPU usage
* Process memory usage
* Network traffic
* Network errors
* Disk I/O
* Top CPU-consuming processes
* Top memory-consuming processes
* Docker containers
* MySQL protocol/query health
* PostgreSQL protocol/query health
* MongoDB ping
* Redis `PING`
* MSSQL connection/query health
* Nginx/Apache HTTP health
* SSL certificate expiration
* Automatic service failure alerts
* Automatic endpoint failure alerts
* Per-service recovery notifications
* Telegram `/pm2`
* Telegram `/network`
* Telegram `/top`
* Telegram `/all`

---

# License

Private project.

Not intended for redistribution without permission.
