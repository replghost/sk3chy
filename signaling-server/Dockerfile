FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source code
COPY src ./src

# Expose the signaling server port
EXPOSE 4444

# Run the server
CMD ["npm", "start"]
