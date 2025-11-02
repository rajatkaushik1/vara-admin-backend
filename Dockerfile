# Use an official lightweight Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container to /app
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install only the production dependencies
RUN npm install --only=production

# Copy the rest of your application's source code
COPY . .

# Google Cloud Run will set its own PORT, but we default to 8080
ENV PORT=8080

# The command to run your application
CMD ["node", "server.cjs"]
