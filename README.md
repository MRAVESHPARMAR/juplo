# Boisterous — HTML, CSS, JavaScript + Node.js + MariaDB

A responsive custom menswear storefront for coats, shirts and jeans. The browser UI is written in plain HTML, CSS and JavaScript. A small Node.js/Express API is included because browser-only JavaScript must not connect directly to MariaDB or contain private API credentials.

## What is included

- Responsive storefront, product filters, six starter designs and product details.
- Personalization preview: name/initials, short text, size, colour, placement and style.
- Shopping bag saved in browser local storage, quantity controls, shipping calculation and Cash on Delivery checkout.
- Email/password sign-up and sign-in, session-based account, order history and optional admin order status page.
- Optional Google OAuth sign-in, Twilio Verify mobile OTP, SMTP order/support emails, and OpenAI-powered AI stylist.
- Customer support ticket form and MariaDB schema/seed products.
- Demo mode if MariaDB is not configured or unavailable. Demo user/order/support records live only in server memory and are lost when the server restarts; the cart remains in browser local storage.

## Requirements

- Node.js 18 or newer and npm.
- MariaDB for persistent users, products, orders and support tickets (recommended).
- A modern browser.

Check your versions:

```bash
node --version
npm --version
```

## Run on Kali Linux in VS Code

Open the extracted `boisterous-web` folder (not the ZIP itself) in VS Code.

### 1. Install Node.js if needed

```bash
sudo apt update
sudo apt install nodejs npm mariadb-server
```

Kali repositories can provide different Node.js versions. This project requires Node.js 18 or newer. Re-check with `node --version`; if it is older than 18, install a current supported Node.js release before proceeding.

### 2. Install the project dependencies

In VS Code choose **Terminal → New Terminal**. Make sure the terminal is in this project folder, then run:

```bash
npm install
```

### 3. Prepare MariaDB (recommended)

Start MariaDB:

```bash
sudo systemctl enable --now mariadb
```

Create the database user and import the schema:

```bash
sudo mariadb
```

Paste these SQL commands at the MariaDB prompt. Replace the example password with a private password you choose:

```sql
CREATE DATABASE IF NOT EXISTS boisterous
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'boisterous_user'@'localhost'
  IDENTIFIED BY 'ChangeThisPassword123!';
CREATE USER IF NOT EXISTS 'boisterous_user'@'127.0.0.1'
  IDENTIFIED BY 'ChangeThisPassword123!';
GRANT ALL PRIVILEGES ON boisterous.* TO 'boisterous_user'@'localhost';
GRANT ALL PRIVILEGES ON boisterous.* TO 'boisterous_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

Back in the VS Code terminal, while still at the project root:

```bash
sudo mariadb < database/schema.sql
```

The schema seeds the coat, shirt and jeans catalogue. It is safe to rerun for updating the sample products, but it does not delete existing orders or user data.

### 4. Configure the app

```bash
cp .env.example .env
nano .env
```

Make sure the database settings use the exact password created above:

```dotenv
PORT=3000
NODE_ENV=development
SESSION_SECRET=change-this-to-a-long-private-random-value
ADMIN_EMAIL=your-admin-email@example.com
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=boisterous
DB_USER=boisterous_user
DB_PASSWORD=your-database-password
```

Save Nano with **Ctrl+O**, Enter, then **Ctrl+X**. Choose an admin email you control. Register that email through the website to use the starter admin order panel. Do not expose this starter app publicly without reviewing the auth and deployment configuration first.

If you leave the DB settings blank or MariaDB is unavailable, the app starts in temporary demo mode instead. Visit `/api/health` to see whether it says `connected` or `demo-mode`.

### 5. Start the website

```bash
npm start
```

Open this address in Firefox:

<http://localhost:3000>

Keep the terminal open while using the app. Press **Ctrl+C** in the terminal to stop it. After changing server files, restart the server.

**Do not use VS Code Live Server for the full app.** Live Server only serves files; it does not run the Node.js API, handle account sessions, connect MariaDB or send orders. Use `npm start` and open `http://localhost:3000`.

## Optional integrations

Configure these only when you are ready to use the live provider:

- **Google sign-in:** create a Web OAuth client in Google Cloud Console. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and set the authorized redirect URI to `http://localhost:3000/api/auth/google/callback` for local development. The URL must match exactly.
- **Mobile OTP:** add Twilio Account SID, Auth Token and Verify Service SID. Use an E.164 phone number format such as `+919876543210`.
- **Transactional email:** add SMTP host, port, username, password and sender in `.env`. Without SMTP credentials, orders and support tickets are still saved, but no email is delivered.
- **AI stylist:** add an OpenAI API key and optionally `OPENAI_MODEL`. Keep this key on the server in `.env`, never in `public/app.js`. Without a key, the stylist gives a few demo responses.

Restart `npm start` after changing `.env`.

## Main folders

```text
boisterous-web/
├── public/
│   ├── index.html       # page and dialogs
│   ├── styles.css       # responsive visual design
│   └── app.js           # browser interactions and API calls
├── database/
│   └── schema.sql       # MariaDB tables and sample products
├── server.js            # Node.js API, auth, orders, chat, email hooks
├── package.json
├── .env.example
└── README.md
```

## Notes and limitations

- This is a starter implementation, not a production-audited commerce system.
- Cash on Delivery is the only checkout option. Card and UPI payments are not connected.
- Product photography is loaded from Unsplash over the internet; a local connection is required to load those remote images. Replace image URLs with licensed product photos before launch.
- The personalization design is a visual preview. It is not a manufacturing-ready embroidery/printing file.
- When no MariaDB connection is available, demo account/order/support data is held in memory and disappears on restart.
- Express's default in-memory session store is suitable only for local development. Before deployment, use a production session store, HTTPS, secure secret management, monitoring, backups, stricter access controls, data retention rules, and an appropriate privacy/returns policy.
- Review applicable consumer-protection, privacy, tax, and ecommerce obligations before accepting real customer orders.
