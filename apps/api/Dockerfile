FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace @uaiw/api

FROM deps AS build
COPY apps/api apps/api
RUN npm run build --workspace @uaiw/api

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --omit=dev --workspace @uaiw/api
COPY --from=build /app/apps/api/dist apps/api/dist
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@uaiw/api"]
