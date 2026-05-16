## 1) Запуск проекта (macOS / Linux / Windows)

### 1.1 Установка зависимостей

```bash
cd server
npm i
```

### 1.2 HTTPS сертификаты (обязательно)

Service Worker и Push требуют **secure context**, поэтому проект запускается на **https://localhost**. Это было в прошлом репо (ПР 15-16). Здесь для повторения (п 2-3).

Нужны файлы:

- `server/certs/localhost-key.pem`
- `server/certs/localhost-cert.pem`

#### Вариант A: mkcert (рекомендуется)

```bash
# 1) установка mkcert (пример для macOS)
brew install mkcert
mkcert -install

# 2) генерация сертификатов
cd server
mkdir -p certs
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost-cert.pem localhost
```

#### Вариант B: OpenSSL (если mkcert нет)

```bash
cd server
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/localhost-key.pem \
  -out certs/localhost-cert.pem \
  -days 365 \
  -subj "/CN=localhost"
```

> Если сертификат самоподписанный — браузер предупредит. Это нормально для учебного проекта.

---

## 2) Настройка Push (VAPID) — один раз

### 2.1 Сгенерировать VAPID ключи

```bash
cd server
npm run vapid
```

В выводе будут две строки:

- `VAPID_PUBLIC_KEY=...`
- `VAPID_PRIVATE_KEY=...`

### 2.2 Создать `server/.env`

Создайте файл `server/.env` (имя начинается с точки) и вставьте:

```env
PORT=3443
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
# необязательно, но можно:
VAPID_SUBJECT=mailto:teacher@example.com
```

---

## 3) Запуск сервера

```bash
cd server
npm run dev
```

Открыть в браузере:

- `https://localhost:3443`

Проверка здоровья:

- `https://localhost:3443/api/health`

