# Multi-stage Dockerfile for unified full-stack QuantFlow deployment on free container hosts (Render / Koyeb / Fly.io / Railway)

# --- Stage 1: Build Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:20-slim AS backend-builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci
COPY backend/ ./
RUN npm run build

# --- Stage 3: Production Runner ---
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy Backend production build & dependencies
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/prisma ./backend/prisma

# Copy Frontend static dist to app/frontend/dist so backend can serve React SPA
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 5000
ENV PORT=5000
ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
