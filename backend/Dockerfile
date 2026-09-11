FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

COPY prisma ./prisma

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$RUN_SEED\" = \"true\" ]; then npm run seed; fi && node dist/src/index.js"]