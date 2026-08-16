# Production Deployment & Infrastructure Guide

## Docker Compose Deployment
```bash
cd infrastructure
docker-compose up -d --build
```

Verify services health:
- Fastify Backend: `http://localhost:4000/api/v1/health`
- PostgreSQL DB: `5432`
- Redis: `6379`
- Coturn TURN: `3478` / `5349`
