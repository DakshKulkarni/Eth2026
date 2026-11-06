# Stage 1: build the dashboard (React and Vite) into static files.
FROM node:22-slim AS dashboard
WORKDIR /dash
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard ./
RUN npm run build

# Stage 2: the backend, which also serves the built dashboard at the same address.
FROM node:22-slim
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci
COPY procedure ./procedure
COPY backend ./backend
COPY --from=dashboard /dash/dist ./backend/public/app
WORKDIR /app/backend
ENV NODE_ENV=production
CMD ["npm", "start"]
