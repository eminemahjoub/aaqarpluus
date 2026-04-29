FROM node:20-alpine

WORKDIR /app

# pnpm via corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

COPY . .

EXPOSE 2000

CMD ["pnpm", "dev", "-H", "0.0.0.0", "-p", "2000"]
