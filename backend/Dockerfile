# Base image
FROM node:20-slim AS builder

# Install openssl for Prisma engines
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --registry=https://registry.npmmirror.com

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev dependencies for production-like size
RUN npm prune --production

# Final runner stage
FROM node:20-slim AS runner

# Install openssl for Prisma engines in running container
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Run database setup and start the server
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
