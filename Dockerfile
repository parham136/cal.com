FROM node:18

ARG NEXT_PUBLIC_API_V2_URL
ENV NEXT_PUBLIC_API_V2_URL=${NEXT_PUBLIC_API_V2_URL}

WORKDIR /app
COPY . .

RUN yarn install
WORKDIR /app/apps/web
RUN yarn build

EXPOSE 3000
CMD ["yarn", "start"]
