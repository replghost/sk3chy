FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose the signaling server port
EXPOSE 4444

# Run the server
CMD ["bun", "start"]
