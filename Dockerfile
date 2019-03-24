FROM node:11

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .

CMD [ "node", "dist/index.js" ]
