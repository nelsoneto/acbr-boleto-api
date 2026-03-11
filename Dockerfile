FROM node:22-slim

# Instala TODAS as dependências que a ACBrLib LINUX
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
    x11-utils \
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
ENV LD_LIBRARY_PATH=/app/bin:/app/bin/dep:/usr/lib/x86_64-linux-gnu

# Inicia o Xvfb e só sobe o servidor quando o display estiver realmente acessível
CMD ["/bin/sh", "-c", "rm -f /tmp/.X1-lock; Xvfb :1 -screen 0 1024x768x16 & i=0; while ! xdpyinfo -display :1 >/dev/null 2>&1 && [ \"$i\" -lt 60 ]; do i=$((i+1)); sleep 0.25; done; if ! xdpyinfo -display :1 >/dev/null 2>&1; then echo 'Xvfb nao ficou pronto a tempo'; exit 1; fi; tries=0; max=5; while [ \"$tries\" -lt \"$max\" ]; do npm start; code=$?; if [ \"$code\" -ne 139 ]; then exit \"$code\"; fi; tries=$((tries+1)); echo 'ACBr segfault 139 no boot, tentando novamente...'; sleep 2; done; exit 139"]
