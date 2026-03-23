FROM node:20-bookworm-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV HTTP_PORT=3000
ENV HTTPS_PORT=3443

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY views ./views
COPY public ./public
COPY migrations ./migrations

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000 3443

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const http=require('http');const req=http.get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',(res)=>process.exit(res.statusCode<500?0:1));req.on('error',()=>process.exit(1));req.setTimeout(4000,()=>{req.destroy();process.exit(1);});"

CMD ["node", "src/server.js"]
