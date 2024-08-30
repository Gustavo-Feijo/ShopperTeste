FROM node:22

# Work directory.
WORKDIR /usr/src/app

# Copy package for installing the dependencies.
COPY package*.json ./

# Install the dependencies.
RUN npm install

# Copy the remaining files.
COPY . .

RUN npx prisma generate
# Compile the typescript file.
RUN npx tsc

# Expose the port.
EXPOSE 3000

CMD [ "npm","run","deploy" ]