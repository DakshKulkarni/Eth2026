FROM node:22-slim
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci
COPY procedure ./procedure
COPY backend ./backend
WORKDIR /app/backend
ENV NODE_ENV=production
CMD ["npm", "start"]
