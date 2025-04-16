# FROM ghcr.io/calcom/docker:latest
FROM node:18

WORKDIR /app
COPY . .

RUN yarn install --frozen-lockfile
WORKDIR /app/apps/web
RUN yarn build

EXPOSE 3000
CMD ["yarn", "start"]
