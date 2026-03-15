set dotenv-load := true

DB_URL := "postgres://safeswitch:safeswitch@localhost:5432/safeswitch"

# List available commands
default:
    @just --list

# Start infrastructure (Postgres)
db-up:
    docker compose up -d db
    docker compose run --rm db sh -c 'until pg_isready -h db -U safeswitch; do sleep 1; done'

# Stop containers
db-down:
    docker compose down

# Wipe the database volume
db-reset:
    docker compose down -v

# Start the NestJS backend
server:
    cd backend && pnpm start:dev

# Start the frontend
frontend:
    cd frontend && pnpm dev

# Write backend/.env
env:
    echo 'DATABASE_URL={{DB_URL}}' > backend/.env

# Start everything: db + backend + frontend
dev: db-up env
    @just server & just frontend
