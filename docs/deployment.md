# Ameo AI — Deployment Guide

This guide covers deploying Ameo AI to production using Docker, Vercel, or self-hosted bare-metal/VM setups.

---

## Production Build

```bash
# Install production dependencies
bun install --production

# Generate Prisma client
bun run db:generate

# Build the Next.js application (standalone output)
bun run build
```

The build process generates a self-contained output in `.next/standalone/` with:

- Optimized server bundle (minified, tree-shaken)
- Static assets copied into the standalone directory
- No `node_modules` required at runtime

The standalone server is started with:

```bash
NODE_ENV=production bun .next/standalone/server.js
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM oven/bun:1 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run db:generate
RUN bun run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Create database directory
RUN mkdir -p /app/prisma/db && chown nextjs:nextjs /app/prisma/db

USER nextjs

EXPOSE 3000

CMD ["bun", "server.js"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  ameo-ai:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./db/production.db
      - NEXTAUTH_URL=https://your-domain.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - GROQ_API_KEY=${GROQ_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - ameo-data:/app/prisma/db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  ameo-data:
```

### Commands

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f ameo-ai

# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build --force-recreate
```

---

## Vercel Deployment

Ameo AI uses `output: "standalone"` in `next.config.ts`. For Vercel deployment:

### Configuration

1. **Remove standalone output** for Vercel (it has its own optimization):

   ```javascript
   // next.config.ts — comment out standalone for Vercel
   const nextConfig: NextConfig = {
     // output: "standalone",  // NOT needed for Vercel
     typescript: { ignoreBuildErrors: false },
     reactStrictMode: true,
   };
   ```

2. **Add a build script** in `package.json`:

   ```json
   {
     "scripts": {
       "vercel-build": "npx prisma generate && next build"
     }
   }
   ```

3. **Configure environment variables** in the Vercel dashboard under **Settings > Environment Variables**:

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | Use a managed PostgreSQL or Turso (SQLite) URL |
   | `NEXTAUTH_URL` | Your Vercel deployment URL |
   | `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
   | `OPENROUTER_API_KEY` | Your OpenRouter key |
   | `GROQ_API_KEY` | Your Groq key |
   | `GEMINI_API_KEY` | Your Gemini key |

4. **Deploy** via Git push or Vercel CLI:

   ```bash
   vercel --prod
   ```

### Vercel Limitations

- **SQLite file database** is not persistent on Vercel serverless. Use an external database (PostgreSQL via Prisma) or Turso (managed SQLite).
- **Runtime engine timeout** — Vercel serverless functions have a 10s (Hobby) or 60s (Pro) timeout. For longer AI operations, consider a dedicated backend.
- **Singleton instances** (RuntimeEngine, EventBus, etc.) work within a single serverless invocation but do not persist between requests.

---

## Self-Hosted Deployment

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 512 MB | 2 GB |
| Disk | 1 GB | 10 GB SSD |
| OS | Ubuntu 22.04 / Debian 12 | Latest LTS |

### Setup Steps

```bash
# 1. Clone and build
git clone <repo-url> /opt/ameo-ai
cd /opt/ameo-ai
bun install --production
bun run db:generate
bun run build

# 2. Configure environment
cp .env.example .env
# Edit .env with production values

# 3. Initialize database
bun run db:push

# 4. Test the server
NODE_ENV=production bun .next/standalone/server.js
```

### Systemd Service

Create `/etc/systemd/system/ameo-ai.service`:

```ini
[Unit]
Description=Ameo AI Platform
After=network.target

[Service]
Type=simple
User=ameo
WorkingDirectory=/opt/ameo-ai
ExecStart=/usr/bin/bun .next/standalone/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/ameo-ai/.env

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ameo-ai
sudo systemctl start ameo-ai

# Check status
sudo systemctl status ameo-ai

# View logs
sudo journalctl -u ameo-ai -f
```

---

## Environment Variables for Production

```env
# Required
NODE_ENV=production
DATABASE_URL="file:./db/production.db"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="<generate-with-openssl>"

# AI Providers (at least one required)
OPENROUTER_API_KEY="sk-or-v1-..."
GROQ_API_KEY="gsk_..."
GEMINI_API_KEY="AIza..."

# Optional
PORT=3000
OLLAMA_BASE_URL="http://localhost:11434"
```

### Security Checklist

- [ ] Generate a strong `NEXTAUTH_SECRET` (32+ random bytes)
- [ ] Set `NODE_ENV=production`
- [ ] Restrict API keys to your production domain/IP
- [ ] Enable HTTPS via reverse proxy (Caddy/Nginx)
- [ ] Restrict database file permissions (`chmod 600`)
- [ ] Set up automated backups for the SQLite database
- [ ] Configure firewall rules (only expose port 80/443)

---

## Caddy Reverse Proxy

Caddy provides automatic HTTPS with Let's Encrypt. Create a `Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:3000

    # Security headers
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    # Compression
    encode gzip zstd

    # Logging
    log {
        output file /var/log/caddy/ameo-ai.log
        format console
    }
}
```

```bash
# Start Caddy
sudo caddy run

# Or reload after changes
sudo caddy reload
```

---

## Database Backup Strategy

### SQLite Backup

Since Ameo AI uses SQLite, backups are file-level operations:

```bash
# Manual backup (atomic copy)
sqlite3 /opt/ameo-ai/prisma/db/production.db \
  ".backup '/opt/backups/ameo-$(date +%Y%m%d-%H%M%S).db'"

# Using the .backup command (safe for running databases)
sqlite3 /opt/ameo-ai/prisma/db/production.db \
  ".backup /opt/backups/ameo-latest.db"
```

### Automated Backup (Cron)

Add to `/etc/cron.daily/ameo-backup`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/ameo-ai"
DB_PATH="/opt/ameo-ai/prisma/db/production.db"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Atomic backup using SQLite .backup command
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/ameo-$(date +%Y%m%d-%H%M%S).db'"

# Clean up old backups
find "$BACKUP_DIR" -name "ameo-*.db" -mtime +$RETENTION_DAYS -delete
```

```bash
chmod +x /etc/cron.daily/ameo-backup
```

### Restore from Backup

```bash
# Stop the application
sudo systemctl stop ameo-ai

# Replace the database
cp /opt/backups/ameo-ai/ameo-YYYYMMDD-HHMMSS.db \
   /opt/ameo-ai/prisma/db/production.db

# Verify and restart
sqlite3 /opt/ameo-ai/prisma/db/production.db "PRAGMA integrity_check;"
sudo systemctl start ameo-ai
```

---

## Performance Optimization

### Database

- **WAL mode** — Enable Write-Ahead Logging for better concurrent read performance:

  ```bash
  sqlite3 /opt/ameo-ai/prisma/db/production.db "PRAGMA journal_mode=WAL;"
  ```

- **Regular cleanup** — Purge old execution queue items, health metrics, and events:

  ```bash
  # Via API or scheduled task
  curl -X POST http://localhost:3000/api/queue/purge
  ```

### Application

- **Enable Bun runtime** in production for ~2-3x faster server startup and lower memory usage:

  ```bash
  bun .next/standalone/server.js
  ```

- **Set worker concurrency** if handling high traffic:

  ```bash
  # Increase queue manager concurrency (default: 3)
  # Configure via environment variable or code
  ```

- **Monitor health metrics** — The System Health Dashboard provides real-time scores across all subsystems (queue, runtime, workflow, verification, recovery, agent, event bus).

### Network

- **Enable gzip/zstd compression** at the reverse proxy level (Caddy handles this automatically)
- **Set appropriate timeout values** — AI provider requests default to 30 seconds (`DEFAULT_TIMEOUT_MS`)
- **Rate limit API endpoints** at the reverse proxy if exposing to the public internet

### Monitoring

- **Health endpoint** — `GET /api/health` returns application health status
- **Logs** — Application logs are written to `server.log` in production
- **Observability API** — `GET /api/observability` returns system health summary with subsystem scores
