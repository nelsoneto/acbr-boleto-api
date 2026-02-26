FROM node:20-slim

# Instalando TODAS as dependências que a ACBrLib precisa no Linux
RUN apt-get update && apt-get install -y \
    libssl-dev \
    libxml2 \
    libgtk2.0-0 \
    libgdk-pixbuf2.0-0 \
    libfontconfig1 \
    libxrender1 \
    libsm6 \
    libice6 \
    libglib2.0-0 \
    xvfb \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# Instalando as dependências de produção e dev para garantir o tsx
RUN npm install

COPY . .

# Garante que a pasta bin e a lib .so existam e tenham permissão
RUN chmod -R 777 /app/bin /app/temp /app/logs

EXPOSE 3001

# Garante que o Node procure o monitor virtual na porta :1
ENV DISPLAY=:1

# Inicia o Xvfb, espera 2 segundos para ele ligar, e roda o servidor
CMD rm -f /tmp/.X99-lock && Xvfb :1 -screen 0 1024x768x16 & sleep 2 && npm run dev
