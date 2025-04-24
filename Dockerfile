# Builder stage
FROM node:20-alpine AS builder
WORKDIR /workspace

# Copy all files and install dependencies for the Supabase package
COPY ./packages/mcp-server-supabase/package.json ./packages/mcp-server-supabase/package-lock.json ./packages/mcp-server-supabase/tsconfig.json ./packages/mcp-server-supabase/tsup.config.ts ./
COPY ./packages/mcp-server-supabase/src ./packages/mcp-server-supabase/src

# Install and build in the subpackage
WORKDIR /workspace/packages/mcp-server-supabase
RUN npm install
RUN npm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts and dependencies
COPY --from=builder /workspace/packages/mcp-server-supabase/dist ./dist
COPY --from=builder /workspace/packages/mcp-server-supabase/node_modules ./node_modules

# Expose application port
EXPOSE 3000

# Run the HTTP SSE server with required env vars
CMD ["sh", "-c", "node dist/http-server.js --access-token \"$SUPABASE_ACCESS_TOKEN\" --api-url \"$API_URL\" --port $PORT"] 