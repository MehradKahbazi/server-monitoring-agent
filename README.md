# Server Monitor

A lightweight Linux server monitoring agent built with Node.js,
TypeScript, pnpm, Telegram Bot API and PM2.

## Features

- CPU usage
- CPU cores
- Load average
- CPU temperature when supported
- RAM usage
- Available RAM
- Swap usage
- Disk usage
- Process count
- Linux systemd service monitoring
- HTTP endpoint monitoring
- Telegram alerts
- Telegram commands
- Consecutive failure detection
- Recovery notifications
- Alert cooldown
- PM2 deployment

---

## Requirements

- Linux server
- Node.js 20+
- pnpm
- PM2
- Telegram account

---

## Installation

Clone/copy the project:

```bash
mkdir -p ~/server-monitor
cd ~/server-monitor
```

Install dependencies:

```bash
pnpm install
```

Create environment file:

```bash
cp .env.example .env
```

Edit it:

```bash
nano .env
```

---

# Telegram Bot

Create a bot using BotFather.

You need:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

The bot accepts commands only from the configured chat ID.

Available commands:

```text
/status
/services
/disk
/help
```

---

# Configuration

Example:

```env
MONITOR_INTERVAL_MS=30000

CPU_WARNING_THRESHOLD=85
RAM_WARNING_THRESHOLD=85
SWAP_WARNING_THRESHOLD=50
DISK_WARNING_THRESHOLD=90

LOAD_WARNING_MULTIPLIER=1.5

ALERT_AFTER_CONSECUTIVE_FAILURES=3

RECOVERY_THRESHOLD=75

ALERT_COOLDOWN_MS=900000
```

With this configuration:

- CPU must exceed 85%
- RAM must exceed 85%
- Disk must exceed 90%
- The condition must occur 3 times consecutively
- The alert cooldown is 15 minutes

---

# Service Monitoring

Configure systemd services:

```env
CHECK_SERVICES=true

SERVICES=nginx,mysql,redis
```

The application executes:

```bash
systemctl is-active nginx
systemctl is-active mysql
systemctl is-active redis
```

---

# Endpoint Monitoring

Configure local HTTP services:

```env
CHECK_ENDPOINTS=true

ENDPOINTS=RagaShop API|http://127.0.0.1:9005,RagaShop Web|http://127.0.0.1:3000
```

A request timeout is 5 seconds.

---

# Development

Run:

```bash
pnpm dev
```

---

# Type checking

```bash
pnpm typecheck
```

---

# Build

```bash
pnpm build
```

---

# Production

After building:

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

Save the process list:

```bash
pm2 save
```

---

# Restart after changes

```bash
pnpm build
pm2 restart server-monitor
```

---

# PM2 startup

If PM2 startup has not been configured on the server:

```bash
pm2 startup
```

Run the command PM2 prints.

Then:

```bash
pm2 save
```

---

# Example Alert

The bot can send:

```text
🚨 SERVER RESOURCE ALERT

Host: ubuntu-16gb-hel1-1

CPU
Usage: 94.7%
Load: 7.82 / 6.91 / 5.43
Cores: 8

MEMORY
Used: 13.1 GB / 15.6 GB
Usage: 84.0%

SWAP
Used: 1.2 GB / 4 GB
Usage: 30%

DISK
/: 92.1%

SERVICES
✅ nginx
✅ mysql
❌ redis

REASONS
• CPU usage is above 85%
• / usage is above 90%
```

---

# Recovery

When the resource returns below the recovery threshold:

```text
✅ SERVER RECOVERED

Host: ubuntu-16gb-hel1-1

Recovered: cpu

CPU: 42.3%
RAM: 63.1%
```

---

# Project Structure

```text
server-monitor/
│
├── src/
│   ├── config/
│   │   └── config.ts
│   │
│   ├── health/
│   │   ├── endpoint.health.ts
│   │   ├── health.service.ts
│   │   └── service.health.ts
│   │
│   ├── metrics/
│   │   └── system.metrics.ts
│   │
│   ├── rules/
│   │   └── threshold.engine.ts
│   │
│   ├── services/
│   │   └── monitor.service.ts
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
├── tsconfig.json
└── README.md
```

```

```
