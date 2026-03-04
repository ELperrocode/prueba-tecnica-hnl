# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Final stage - nginx to serve static files
FROM nginx:alpine-slim

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config for SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
