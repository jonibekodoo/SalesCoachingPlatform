# ---- Admin panel build (Vite) -------------------------------------------
FROM node:24-alpine AS admin
WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY admin/ ./
RUN npm run build

# ---- API server + static admin ------------------------------------------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=admin /app/admin/dist /app/admin/dist

ENV PORT=4000 \
    DATA_DIR=/app/server/data \
    ADMIN_DIST=/app/admin/dist
RUN mkdir -p /app/server/data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "src/index.js"]
