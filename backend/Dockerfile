# Build stage
FROM golang:1.26-bookworm AS builder

WORKDIR /app

# Install build dependencies for CGO (needed by tigerbeetle-go)
RUN apt-get update && apt-get install -y gcc libc6-dev && rm -rf /var/lib/apt/lists/*

# Copy go.mod and go.sum first for dependency caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build with CGO enabled
RUN CGO_ENABLED=1 GOOS=linux go build -o server ./cmd/server/

# Final stage
FROM debian:bookworm-slim

WORKDIR /app

# Install necessary runtime libraries
RUN apt-get update && apt-get install -y ca-certificates libc6 && rm -rf /var/lib/apt/lists/*

# Copy the binary
COPY --from=builder /app/server .

EXPOSE 8080

# Enable io_uring at runtime (required by TigerBeetle client on Docker Desktop macOS)
# Then start the server
CMD ["sh", "-c", "sysctl -w kernel.io_uring_disabled=0 2>/dev/null || true; exec ./server"]
