# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy configs and source
COPY package.json package-lock.json tsup.config.ts tsconfig.json ./
COPY src/ src/

# Install and build
RUN npm install
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Expose the port
EXPOSE 3000

# Start the SSE HTTP server, reading env vars at runtime
CMD ["sh", "-c", "node dist/http-server.js --access-token \"$SUPABASE_ACCESS_TOKEN\" --api-url \"$API_URL\" --port $PORT"] 