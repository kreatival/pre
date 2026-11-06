FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev && npx prisma --version >/dev/null
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY assets ./assets
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh
USER node
EXPOSE 4000
CMD ["./entrypoint.sh"]
