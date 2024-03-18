FROM node:20 AS build-env
COPY . /app
WORKDIR /app

RUN npm i

FROM gcr.io/distroless/nodejs20-debian11
COPY --from=build-env /app /app
WORKDIR /app
CMD ["node_modules/jest/bin/jest.js", "-c", "jest.e2e.config.js"]