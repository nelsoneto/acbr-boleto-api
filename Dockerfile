FROM node:20-slim

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
    fonts-liberation2 \
    fonts-freefont-ttf \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# Instala dependencias de forma reproduzivel e mais rapida em CI/build
RUN npm ci --no-audit --no-fund

COPY . .

# Garante que a pasta bin e os diretorios de runtime existam e tenham permissao
RUN mkdir -p /app/temp/pdf /app/logs \
    && chmod -R 777 /app/bin /app/temp /app/logs

EXPOSE 3001

# Garante que o Node procure o monitor virtual na porta :1
ENV DISPLAY=:1
ENV LD_LIBRARY_PATH=/app/bin:/app/bin/dep:/usr/lib/x86_64-linux-gnu
ENV GDK_BACKEND=x11
ENV NO_AT_BRIDGE=1

# Inicia o Xvfb e sobe o servidor; em segfault 139 reinicia display e tenta de novo.
CMD ["/bin/sh", "-c", "tries=0; max=8; while [ \"$tries\" -lt \"$max\" ]; do pkill Xvfb >/dev/null 2>&1 || true; rm -f /tmp/.X1-lock; Xvfb :1 -screen 0 1024x768x16 & xvfb_pid=$!; i=0; while ! xdpyinfo -display :1 >/dev/null 2>&1 && [ \"$i\" -lt 60 ]; do i=$((i+1)); sleep 0.25; done; if ! xdpyinfo -display :1 >/dev/null 2>&1; then echo 'Xvfb not ready in time'; kill \"$xvfb_pid\" >/dev/null 2>&1 || true; exit 1; fi; sleep 1; npm start; code=$?; kill \"$xvfb_pid\" >/dev/null 2>&1 || true; if [ \"$code\" -ne 139 ]; then exit \"$code\"; fi; tries=$((tries+1)); echo 'ACBr segfault 139 on boot, retrying...'; sleep 2; done; exit 139"]
