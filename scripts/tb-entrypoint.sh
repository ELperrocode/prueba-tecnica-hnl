#!/bin/sh
set -e

# Enable io_uring on macOS Docker Desktop (requires privileged: true in compose)
# This is needed because Docker Desktop's Linux VM disables io_uring by default
sysctl -w kernel.io_uring_disabled=0 2>/dev/null || true

DATA_FILE="/data/tigerbeetle.tigerbeetle"

if [ ! -f "$DATA_FILE" ]; then
    echo "Initializing TigerBeetle data file for the first time..."
    /bin/tigerbeetle format \
        --cluster=0 \
        --replica=0 \
        --replica-count=1 \
        "$DATA_FILE"
    echo "TigerBeetle data file initialized."
fi

echo "Starting TigerBeetle..."
exec /bin/tigerbeetle start \
    --addresses=0.0.0.0:3000 \
    "$DATA_FILE"
