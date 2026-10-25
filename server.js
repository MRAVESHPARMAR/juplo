require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = Number(process.env.PORT || 3000);
let pool = null;
let dbReady = false;
const memory = { users: [], orders: [], tickets: [] };
let nextUserId = 1;
let nextOrderId = 1;
let nextTicketId = 1;

const products = [
  { id: 1, slug: 'atelier-wool-coat', name: 'The Atelier Wool Coat', category: 'Coats', price: 14900, compare_at: 17900, description: 'A clean, architectural silhouette with a soft structure and a considered finish.', image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1100&q=85', badge: 'BESTSELLER', colors: ['Black', 'Camel', 'Charcoal'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { id: 2, slug: 'double-breasted-coat', name: 'The Double-Breasted', category: 'Coats', price: 16900, compare_at: null, description: 'A timeless double-breasted layer made for sharp everyday dressing.', image_url: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1100&q=85', badge: 'SIGNATURE', colors: ['Black', 'Camel', 'Navy'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { id: 3, slug: 'everyday-oxford-shirt', name: 'The Everyday Oxford', category: 'Shirts', price: 5900, compare_at: null, description: 'A crisp, easy-to-wear shirt, ready for a name or a small signature detail.', image_url: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1100&q=85', badge: 'CUSTOM FAVOURITE', colors: ['White', 'Sky Blue', 'Black'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { id: 4, slug: 'linen-weekend-shirt', name: 'The Linen Weekend', category: 'Shirts', price: 4900, compare_at: 5500, description: 'Relaxed texture and a breathable feel for slower days and warm evenings.', image_url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1100&q=85', badge: null, colors: ['White', 'Olive', 'Sand'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { id: 5, slug: 'straight-fit-denim', name: 'The Straight-Fit Denim', category: 'Jeans', price: 6900, compare_at: null, description: 'A versatile straight fit with a clean wash that makes every outfit feel intentional.', image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1100&q=85', badge: 'EVERYDAY ICON', colors: ['Indigo', 'Black', 'Light Blue'], sizes: ['28', '30', '32', '34', '36', '38'] },
  { id: 6, slug: 'selvedge-denim', name: 'The Selvedge Denim', category: 'Jeans', price: 8900, compare_at: 9900, description: 'A refined denim essential with a deeper tone and a premium, pared-back finish.', image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1100&q=85', badge: 'PREMIUM', colors: ['Dark Indigo', 'Black'], sizes: ['28', '30', '32', '34', '36', '38'] }
];

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    scriptSrc: ["'self'"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com']
  } }
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({
  name: 'boisterous.sid',
  secret: process.env.SESSION_SECRET || 'development-only-change-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public')));

const money = value => Number(Number(value || 0).toFixed(2));
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const safeUser = row => row ? ({ id: row.id, name: row.name, email: row.email || null, phone: row.phone || null, isAdmin: Boolean(row.is_admin ?? row.isAdmin) }) : null;
const parseArray = value => {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
};
function makeOrderNumber() { return `BOI-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }
function makeTicketNumber() { return `HELP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function userForSession(user) { return { id: user.id, name: user.name, email: user.email || null, phone: user.phone || null, isAdmin: Boolean(user.is_admin ?? user.isAdmin) }; }
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.isAdmin) return res.status(403).json({ error: 'Administrator access is required.' });
  next();
}

async function getProducts() {
  if (!dbReady) return products;
  const [rows] = await pool.query('SELECT id, slug, name, category, price, compare_at, description, image_url, badge, colors, sizes FROM products WHERE active = 1 ORDER BY id');
  return rows.map(row => ({ ...row, id: Number(row.id), price: Number(row.price), compare_at: row.compare_at == null ? null : Number(row.compare_at), colors: parseArray(row.colors), sizes: parseArray(row.sizes) }));
}
async function findUserByEmail(email) {
  if (dbReady) { const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]); return rows[0] || null; }
  return memory.users.find(user => user.email && user.email.toLowerCase() === email) || null;
}
async function findUserByPhone(phone) {
  if (dbReady) { const [rows] = await pool.query('SELECT * FROM users WHERE phone = ? LIMIT 1', [phone]); return rows[0] || null; }
  return memory.users.find(user => user.phone === phone) || null;
}
async function findUserById(id) {
  if (dbReady) { const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]); return rows[0] || null; }
  return memory.users.find(user => Number(user.id) === Number(id)) || null;
}
async function upsertGoogleUser(profile) {
  const email = normalizeEmail(profile.email);
  const isAdmin = email && email === normalizeEmail(process.env.ADMIN_EMAIL);
  if (dbReady) {
    await pool.query(
      `INSERT INTO users (name, email, google_id, is_admin) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), google_id = VALUES(google_id), is_admin = GREATEST(is_admin, VALUES(is_admin))`,
      [profile.name || 'Boisterous Customer', email, profile.googleId, isAdmin ? 1 : 0]
    );
    return findUserByEmail(email);
  }
  let user = memory.users.find(item => item.email === email);
  if (!user) { user = { id: nextUserId++, name: profile.name || 'Boisterous Customer', email, phone: null, google_id: profile.googleId, is_admin: isAdmin ? 1 : 0, password_hash: null }; memory.users.push(user); }
  else { user.google_id = profile.googleId; user.name = profile.name || user.name; if (isAdmin) user.is_admin = 1; }
  return user;
}
async function getMailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
}
async function sendEmail(to, subject, text) {
  if (!to || String(to).endsWith('.boisterous.local')) return false;
  const mailer = await getMailer();
  if (!mailer) return false;
  try {
    await mailer.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
    return true;
  } catch (error) {
    console.error('Email delivery failed:', error.message);
    return false;
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true, database: dbReady ? 'connected' : 'demo-mode', integrations: {
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID),
  email: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  ai: Boolean(process.env.OPENAI_API_KEY)
} }));
app.get('/api/products', async (req, res, next) => {
  try { res.json({ products: await getProducts() }); } catch (error) { next(error); }
});
app.get('/api/me', (req, res) => res.json({ user: req.session.user || null, database: dbReady ? 'connected' : 'demo-mode' }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 120);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your name.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters.' });
    if (await findUserByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const isAdmin = email === normalizeEmail(process.env.ADMIN_EMAIL);
    let user;
    if (dbReady) {
      const [result] = await pool.query('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)', [name, email, passwordHash, isAdmin ? 1 : 0]);
      user = { id: result.insertId, name, email, phone: null, is_admin: isAdmin ? 1 : 0 };
    } else {
      user = { id: nextUserId++, name, email, phone: null, password_hash: passwordHash, is_admin: isAdmin ? 1 : 0 };
      memory.users.push(user);
    }
    req.session.user = userForSession(user);
    res.status(201).json({ user: req.session.user, message: 'Your Boisterous account is ready.' });
  } catch (error) { next(error); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = await findUserByEmail(email);
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    req.session.user = userForSession(user);
    res.json({ user: req.session.user, message: 'You are signed in.' });
  } catch (error) { next(error); }
});
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => { res.clearCookie('boisterous.sid'); res.json({ ok: true }); }));

app.get('/api/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).send('Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file.');
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/google/callback`);
  const state = require('crypto').randomBytes(18).toString('hex');
  req.session.googleOAuthState = state;
  res.redirect(client.generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state, prompt: 'select_account' }));
});
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.redirect('/?auth=google-not-configured');
    if (!req.query.state || req.query.state !== req.session.googleOAuthState) return res.redirect('/?auth=google-state-error');
    delete req.session.googleOAuthState;
    if (!req.query.code) return res.redirect('/?auth=google-error');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/google/callback`);
    const { tokens } = await client.getToken(String(req.query.code));
    if (!tokens.id_token) return res.redirect('/?auth=google-error');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) return res.redirect('/?auth=google-unverified');
    const user = await upsertGoogleUser({ email: payload.email, name: payload.name, googleId: payload.sub });
    req.session.user = userForSession(user);
    res.redirect('/?auth=google-success');
  } catch (error) { console.error('Google OAuth error:', error.message); res.redirect('/?auth=google-error'); }
});

app.post('/api/auth/otp/send', async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: 'Use an international phone format, for example +919876543210.' });
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) return res.status(503).json({ error: 'SMS login is not configured. Add your Twilio Verify credentials to .env.' });
  try {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verifications.create({ to: phone, channel: 'sms' });
    res.json({ ok: true, message: 'Verification code sent.' });
  } catch (error) { console.error('SMS send error:', error.message); res.status(502).json({ error: 'Unable to send the code. Check your Twilio configuration and phone number.' }); }
});
app.post('/api/auth/otp/check', async (req, res, next) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const code = String(req.body.code || '').trim();
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{4,10}$/.test(code)) return res.status(400).json({ error: 'Enter a valid phone number and verification code.' });
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_VERIFY_SERVICE_SID) return res.status(503).json({ error: 'SMS login is not configured. Add your Twilio Verify credentials to .env.' });
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const result = await twilio.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({ to: phone, code });
    if (result.status !== 'approved') return res.status(401).json({ error: 'That code is not valid. Try again.' });
    let user = await findUserByPhone(phone);
    if (!user) {
      const name = `Customer ${phone.slice(-4)}`;
      if (dbReady) {
        const [insert] = await pool.query('INSERT INTO users (name, phone) VALUES (?, ?)', [name, phone]);
        user = { id: insert.insertId, name, phone, email: null, is_admin: 0 };
      } else {
        user = { id: nextUserId++, name, phone, email: null, password_hash: null, is_admin: 0 };
        memory.users.push(user);
      }
    }
    req.session.user = userForSession(user);
    res.json({ user: req.session.user, message: 'Phone number verified. You are signed in.' });
  } catch (error) { next(error); }
});

app.post('/api/orders', requireAuth, async (req, res, next) => {
  let connection;
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const customerName = String(req.body.customerName || req.session.user.name || '').trim().slice(0, 120);
    const customerEmail = normalizeEmail(req.body.customerEmail || req.session.user.email || '');
    const address = String(req.body.address || '').trim().slice(0, 1200);
    const phone = String(req.body.phone || req.session.user.phone || '').trim().slice(0, 32);
    if (!items.length || items.length > 30) return res.status(400).json({ error: 'Your cart is empty or contains too many different items.' });
    if (customerName.length < 2 || !address || address.length < 10) return res.status(400).json({ error: 'Enter your name and complete shipping address.' });
    if (!isValidEmail(customerEmail) && !/^\+[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid email address or verified phone number.' });
    const catalogue = await getProducts();
    const cleanItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = catalogue.find(p => Number(p.id) === Number(item.productId));
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return res.status(400).json({ error: 'One of your cart items is not valid. Please refresh the page and try again.' });
      const size = String(item.size || 'M').slice(0, 24);
      const color = String(item.color || product.colors?.[0] || 'Default').slice(0, 40);
      const customName = String(item.customName || '').trim().slice(0, 80);
      const customText = String(item.customText || '').trim().slice(0, 180);
      const position = String(item.position || 'left chest').slice(0, 40);
      const unitPrice = money(product.price);
      subtotal += unitPrice * quantity;
      cleanItems.push({ productId: product.id, productName: product.name, unitPrice, quantity, size, color, customName, customText, position });
    }
    subtotal = money(subtotal);
    const shippingFee = subtotal >= 15000 ? 0 : 399;
    const total = money(subtotal + shippingFee);
    const orderNumber = makeOrderNumber();
    const customerEmailForOrder = isValidEmail(customerEmail) ? customerEmail : `phone-${String(phone).replace(/\D/g, '')}@boisterous.local`;
    const shippingAddress = `${address}${phone ? `\nPhone: ${phone}` : ''}`;
    let order;
    if (dbReady) {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [insert] = await connection.query(
        'INSERT INTO orders (order_number, user_id, customer_name, customer_email, subtotal, shipping_fee, total_amount, status, payment_method, shipping_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [orderNumber, req.session.user.id, customerName, customerEmailForOrder, subtotal, shippingFee, total, 'confirmed', 'cash_on_delivery', shippingAddress]
      );
      for (const item of cleanItems) {
        await connection.query(
          'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, size, color, custom_name, custom_text, customization_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [insert.insertId, item.productId, item.productName, item.unitPrice, item.quantity, item.size, item.color, item.customName || null, item.customText || null, item.position]
        );
      }
      await connection.commit();
      order = { id: insert.insertId, orderNumber, customerName, customerEmail: customerEmailForOrder, subtotal, shippingFee, total, status: 'confirmed', paymentMethod: 'cash_on_delivery', items: cleanItems, createdAt: new Date().toISOString(), shippingAddress };
    } else {
      order = { id: nextOrderId++, orderNumber, userId: req.session.user.id, customerName, customerEmail: customerEmailForOrder, subtotal, shippingFee, total, status: 'confirmed', paymentMethod: 'cash_on_delivery', items: cleanItems, createdAt: new Date().toISOString(), shippingAddress };
      memory.orders.unshift(order);
    }
    await sendEmail(customerEmailForOrder, `Boisterous order ${orderNumber} confirmed`, `Hello ${customerName},\n\nThank you for shopping with Boisterous. Your order ${orderNumber} has been received.\nTotal: ₹${total.toLocaleString('en-IN')}\nPayment: Cash on Delivery\nStatus: Confirmed\n\nWe will send another email when your order status changes.\n\nBoisterous Customer Care`);
    res.status(201).json({ order, message: 'Your order has been placed.' });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch {} }
    next(error);
  } finally { if (connection) connection.release(); }
});
app.get('/api/orders', requireAuth, async (req, res, next) => {
  try {
    if (dbReady) {
      const [rows] = await pool.query('SELECT id, order_number AS orderNumber, customer_name AS customerName, subtotal, shipping_fee AS shippingFee, total_amount AS total, status, payment_method AS paymentMethod, shipping_address AS shippingAddress, created_at AS createdAt FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.session.user.id]);
      for (const order of rows) {
        const [items] = await pool.query('SELECT product_name AS productName, unit_price AS unitPrice, quantity, size, color, custom_name AS customName, custom_text AS customText FROM order_items WHERE order_id = ?', [order.id]);
        order.items = items;
      }
      return res.json({ orders: rows });
    }
    res.json({ orders: memory.orders.filter(order => Number(order.userId) === Number(req.session.user.id)) });
  } catch (error) { next(error); }
});

app.post('/api/support', async (req, res, next) => {
  try {
    const name = String(req.body.name || req.session.user?.name || '').trim().slice(0, 120);
    const email = normalizeEmail(req.body.email || req.session.user?.email || '');
    const subject = String(req.body.subject || '').trim().slice(0, 180);
    const message = String(req.body.message || '').trim().slice(0, 4000);
    if (name.length < 2 || !isValidEmail(email) || subject.length < 3 || message.length < 10) return res.status(400).json({ error: 'Complete each field with a valid email and a message of at least 10 characters.' });
    const ticketNumber = makeTicketNumber();
    if (dbReady) {
      await pool.query('INSERT INTO support_tickets (ticket_number, user_id, customer_name, customer_email, subject, message) VALUES (?, ?, ?, ?, ?, ?)', [ticketNumber, req.session.user?.id || null, name, email, subject, message]);
    } else {
      memory.tickets.unshift({ id: nextTicketId++, ticketNumber, userId: req.session.user?.id || null, name, email, subject, message, status: 'open', createdAt: new Date().toISOString() });
    }
    await sendEmail(email, `Boisterous support request ${ticketNumber}`, `Hello ${name},\n\nWe received your support request: ${subject}\nTicket: ${ticketNumber}\n\nOur team will follow up with you.\n\nBoisterous Customer Care`);
    if (process.env.SMTP_USER) await sendEmail(process.env.SMTP_USER, `New Boisterous support ticket ${ticketNumber}`, `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`);
    res.status(201).json({ ticketNumber, message: 'Your support request has been submitted.' });
  } catch (error) { next(error); }
});

app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (dbReady) {
      const [orders] = await pool.query('SELECT id, order_number AS orderNumber, customer_name AS customerName, customer_email AS customerEmail, total_amount AS total, status, created_at AS createdAt FROM orders ORDER BY created_at DESC LIMIT 100');
      return res.json({ orders });
    }
    res.json({ orders: memory.orders });
  } catch (error) { next(error); }
});
app.patch('/api/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const allowed = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    const status = String(req.body.status || '');
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Unsupported order status.' });
    let order;
    if (dbReady) {
      const [rows] = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
      order = rows[0];
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
      order.status = status;
      await sendEmail(order.customer_email, `Boisterous order ${order.order_number}: ${status}`, `Hello ${order.customer_name},\n\nYour Boisterous order ${order.order_number} is now ${status}.\n\nBoisterous Customer Care`);
    } else {
      order = memory.orders.find(item => Number(item.id) === Number(req.params.id));
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      order.status = status;
      await sendEmail(order.customerEmail, `Boisterous order ${order.orderNumber}: ${status}`, `Hello ${order.customerName},\n\nYour Boisterous order ${order.orderNumber} is now ${status}.\n\nBoisterous Customer Care`);
    }
    res.json({ order, message: 'Order status updated.' });
  } catch (error) { next(error); }
});

app.post('/api/chat', async (req, res) => {
  const message = String(req.body.message || '').trim().slice(0, 1200);
  if (!message) return res.status(400).json({ error: 'Type a message first.' });
  const catalogue = products.map(p => `${p.name} (${p.category}, ₹${p.price.toLocaleString('en-IN')})`).join('; ');
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', instructions: `You are the Boisterous AI Stylist. Help shoppers with men's coats, shirts, jeans, sizing questions, outfit suggestions, and customization. Be friendly, concise, and never claim a product feature or inventory availability that is not given. Catalogue: ${catalogue}. Prices are Indian rupees. For orders, payments, refunds, or account issues direct the user to customer support.`, input: message, max_output_tokens: 260 })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'AI provider request failed');
      const answer = data.output_text || (data.output || []).flatMap(item => item.content || []).map(c => c.text || '').filter(Boolean).join('\n') || 'I can help with outfit ideas. Tell me what occasion you are dressing for.';
      return res.json({ reply: answer, mode: 'ai' });
    } catch (error) {
      console.error('AI stylist error:', error.message);
      return res.status(502).json({ error: 'The live stylist is temporarily unavailable. Try again or contact support.' });
    }
  }
  let reply = 'I’m in demo mode right now. Add OPENAI_API_KEY to your .env file to enable the live AI stylist.';
  if (/coat|formal|office|interview/i.test(message)) reply = 'For a polished look, try The Atelier Wool Coat with The Everyday Oxford and dark denim. Add a small initial on the left chest or inside label for a quieter personal touch. The live AI stylist can provide more tailored recommendations once configured.';
  else if (/shirt|summer|casual|weekend/i.test(message)) reply = 'For an easy smart-casual outfit, pair The Everyday Oxford or The Linen Weekend with straight-fit denim. White and sky blue are versatile shirt colours. You can add a name or short phrase in the product customizer.';
  else if (/jean|denim|size|fit/i.test(message)) reply = 'Start with your usual waist measurement and use the size options shown on the product card. The Straight-Fit Denim is the everyday option; The Selvedge Denim gives a deeper, more refined look. For fit-specific advice, share your usual size and preferred fit.';
  res.json({ reply, mode: 'demo' });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((error, req, res, next) => {
  console.error('Request error:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

async function boot() {
  if (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER) {
    try {
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 8,
        queueLimit: 0,
        decimalNumbers: true,
        charset: 'utf8mb4'
      });
      await pool.query('SELECT 1');
      dbReady = true;
      console.log('MariaDB connected.');
    } catch (error) {
      console.warn(`MariaDB is unavailable (${error.message}). Starting in temporary demo mode.`);
      if (pool) { try { await pool.end(); } catch {} }
      pool = null;
      dbReady = false;
    }
  } else {
    console.warn('DB_HOST/DB_NAME/DB_USER not configured. Starting in temporary demo mode. Demo data is lost when the server restarts.');
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Boisterous is running at http://localhost:${PORT}`);
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('replace-this')) console.warn('Set a private SESSION_SECRET in .env before deployment.');
  });
}
boot();
