FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY src/ ./src/

RUN mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE 3003

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
