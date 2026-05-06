FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM deps AS seed
COPY . .
CMD ["npm", "run", "seed"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=staging
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY app.js ./app.js
EXPOSE 3000
CMD ["node", "dist/main.js"]
