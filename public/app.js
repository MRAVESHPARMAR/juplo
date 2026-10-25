const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const colorHex = {
  Black: '#1f211f', Camel: '#b88b62', Charcoal: '#545653', Navy: '#25334b', White: '#f7f5ef', 'Sky Blue': '#9cb9c5', Olive: '#788064', Sand: '#d3c2a7', Indigo: '#2f4568', 'Light Blue': '#91b6d0', 'Dark Indigo': '#202e4a'
};
const fallbackProducts = [
  { id: 1, name: 'The Atelier Wool Coat', category: 'Coats', price: 14900, compare_at: 17900, description: 'A clean, architectural silhouette with a soft structure and a considered finish.', image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1100&q=85', badge: 'BESTSELLER', colors: ['Black', 'Camel', 'Charcoal'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { id: 2, name: 'The Double-Breasted', category: 'Coats', price: 16900, compare_at: null, description: 'A timeless double-breasted layer made for sharp everyday dressing.', image_url: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1100&q=85', badge: 'SIGNATURE', colors: ['Black', 'Camel', 'Navy'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { id: 3, name: 'The Everyday Oxford', category: 'Shirts', price: 5900, compare_at: null, description: 'A crisp, easy-to-wear shirt, ready for a name or a small signature detail.', image_url: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1100&q=85', badge: 'CUSTOM FAVOURITE', colors: ['White', 'Sky Blue', 'Black'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { id: 4, name: 'The Linen Weekend', category: 'Shirts', price: 4900, compare_at: 5500, description: 'Relaxed texture and a breathable feel for slower days and warm evenings.', image_url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1100&q=85', badge: null, colors: ['White', 'Olive', 'Sand'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { id: 5, name: 'The Straight-Fit Denim', category: 'Jeans', price: 6900, compare_at: null, description: 'A versatile straight fit with a clean wash that makes every outfit feel intentional.', image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1100&q=85', badge: 'EVERYDAY ICON', colors: ['Indigo', 'Black', 'Light Blue'], sizes: ['28', '30', '32', '34', '36', '38'] },
  { id: 6, name: 'The Selvedge Denim', category: 'Jeans', price: 8900, compare_at: 9900, description: 'A refined denim essential with a deeper tone and a premium, pared-back finish.', image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1100&q=85', badge: 'PREMIUM', colors: ['Dark Indigo', 'Black'], sizes: ['28', '30', '32', '34', '36', '38'] }
];

let catalogue = [...fallbackProducts];
let activeCategory = 'All';
let selectedProduct = null;
let currentUser = null;
let otpSentFor = '';
let chatSending = false;
let cart = readCart();

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem('boisterous_cart') || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveCart() {
  localStorage.setItem('boisterous_cart', JSON.stringify(cart));
  renderCart();
}
function toast(message, type = 'success') {
  const region = $('#toastRegion');
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  region.appendChild(node);
  window.setTimeout(() => node.remove(), 4300);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
  return data;
}
function productById(id) { return catalogue.find(product => Number(product.id) === Number(id)); }
function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}
function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog?.open) dialog.close();
}
function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderProducts() {
  const filtered = activeCategory === 'All' ? catalogue : catalogue.filter(product => product.category === activeCategory);
  $('#productCount').textContent = `${String(filtered.length).padStart(2, '0')} ${filtered.length === 1 ? 'piece' : 'pieces'}`;
  $('#productGrid').innerHTML = filtered.map(product => {
    const name = escapeHtml(product.name);
    const image = escapeHtml(product.image_url);
    const category = escapeHtml(product.category);
    const badge = product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : '';
    const original = product.compare_at && Number(product.compare_at) > Number(product.price) ? `<s>${money(product.compare_at)}</s>` : '';
    const dots = (product.colors || []).slice(0, 4).map(color => `<span class="color-dot" title="${escapeHtml(color)}" style="background:${colorHex[color] || '#c3c0b5'}"></span>`).join('');
    return `<article class="product-card">
      <div class="product-image-wrap"><img loading="lazy" src="${image}" alt="${name}" onerror="this.style.opacity='.15'"><span class="product-category product-card-hidden-category" hidden>${category}</span>${badge}<button class="product-quick-add" data-customize="${Number(product.id)}"><span>Make it yours</span><span>↗</span></button></div>
      <div class="product-meta"><span class="product-category">${category} / PERSONALIZABLE</span><div class="product-name">${name}</div><div class="product-price">${money(product.price)} ${original}</div><div><div class="product-color-dots">${dots}</div><div class="product-custom-label">NAME · TEXT · PLACEMENT</div></div></div>
    </article>`;
  }).join('');
  if (!filtered.length) $('#productGrid').innerHTML = '<div class="loading-products">No pieces in this category yet.</div>';
  $$('[data-customize]', $('#productGrid')).forEach(button => button.addEventListener('click', () => showCustomizer(Number(button.dataset.customize))));
}

function showCustomizer(productId) {
  selectedProduct = productById(productId) || catalogue[0];
  if (!selectedProduct) return toast('Product catalogue is still loading. Try again in a moment.', 'error');
  $('#selectedProductName').textContent = selectedProduct.name;
  $('#selectedProductPrice').textContent = money(selectedProduct.price);
  $('#customizerImage').src = selectedProduct.image_url;
  $('#customizerImage').alt = selectedProduct.name;
  $('#customizerSize').innerHTML = (selectedProduct.sizes || ['S', 'M', 'L', 'XL']).map((size, i) => `<option value="${escapeHtml(size)}" ${i === 2 ? 'selected' : ''}>${escapeHtml(size)}</option>`).join('');
  $('#customizerColor').innerHTML = (selectedProduct.colors || ['Black']).map((color, i) => `<option value="${escapeHtml(color)}" ${i === 0 ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('');
  $('#customizerName').value = '';
  $('#customizerText').value = '';
  $('#customizerPosition').value = 'left chest';
  $('#customizerFont').value = 'classic';
  updatePersonalizationPreview();
  openDialog('customizerDialog');
}
function updatePersonalizationPreview() {
  const name = $('#customizerName').value.trim();
  const text = $('#customizerText').value.trim();
  $('#previewName').textContent = name || 'YOUR NAME';
  $('#previewText').textContent = text || 'YOUR WORDS HERE';
  $('#previewPersonalization').className = `preview-personalization font-${$('#customizerFont').value}`;
  const position = $('#customizerPosition').value;
  const positions = {
    'left chest': ['50%', '46%', 'translate(-50%,-50%)'],
    'right chest': ['68%', '46%', 'translate(-50%,-50%)'],
    sleeve: ['24%', '56%', 'translate(-50%,-50%)'],
    'inside label': ['50%', '18%', 'translate(-50%,-50%)']
  };
  const [left, top, transform] = positions[position] || positions['left chest'];
  Object.assign($('#previewPersonalization').style, { left, top, transform });
}

function cartSubtotal() { return cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0); }
function cartQuantity() { return cart.reduce((sum, item) => sum + Number(item.quantity), 0); }
function renderCart() {
  const quantity = cartQuantity();
  $('#cartCount').textContent = quantity;
  $('#drawerItemCount').textContent = `(${quantity})`;
  const itemsEl = $('#cartItems');
  if (!cart.length) {
    itemsEl.innerHTML = '<div class="empty-state"><span>✳</span><h3>Your bag is taking a breather.</h3><p>Find a piece that feels like you.</p><button class="button button-dark" id="emptyShopButton">Explore the collection</button></div>';
    $('#emptyShopButton').addEventListener('click', () => { closeCart(); document.querySelector('#shop').scrollIntoView({ behavior: 'smooth' }); });
    $('#cartSummary').hidden = true;
    return;
  }
  $('#cartSummary').hidden = false;
  itemsEl.innerHTML = cart.map(item => `<article class="cart-item"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.productName)}"><div><p class="cart-item-title">${escapeHtml(item.productName)}</p><div class="cart-item-detail">Size ${escapeHtml(item.size)} · ${escapeHtml(item.color)}<br>${escapeHtml(item.position || 'left chest')}</div>${item.customName || item.customText ? `<div class="cart-item-custom">${escapeHtml([item.customName, item.customText].filter(Boolean).join(' · '))}</div>` : ''}<div class="cart-quantity"><button data-qty="-1" data-key="${escapeHtml(item.key)}" aria-label="Decrease quantity">−</button><span>${Number(item.quantity)}</span><button data-qty="1" data-key="${escapeHtml(item.key)}" aria-label="Increase quantity">+</button></div></div><div class="cart-item-side"><span class="cart-item-price">${money(item.price * item.quantity)}</span><button class="remove-item" data-remove="${escapeHtml(item.key)}">Remove</button></div></article>`).join('');
  const subtotal = cartSubtotal();
  $('#cartSubtotal').textContent = money(subtotal);
  $('#cartShipping').textContent = subtotal >= 15000 ? 'Complimentary' : money(399);
  $('#checkoutTotal').textContent = money(subtotal + (subtotal >= 15000 ? 0 : 399));
  $$('[data-qty]', itemsEl).forEach(button => button.addEventListener('click', () => {
    const item = cart.find(entry => entry.key === button.dataset.key);
    if (!item) return;
    item.quantity += Number(button.dataset.qty);
    if (item.quantity <= 0) cart = cart.filter(entry => entry.key !== item.key);
    if (item.quantity > 10) item.quantity = 10;
    saveCart();
  }));
  $$('[data-remove]', itemsEl).forEach(button => button.addEventListener('click', () => { cart = cart.filter(item => item.key !== button.dataset.remove); saveCart(); toast('Piece removed from your bag.'); }));
}
function openCart() { $('#cartDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('open'); $('#cartDrawer').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
function closeCart() { $('#cartDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('open'); $('#cartDrawer').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
function addToCart() {
  const product = selectedProduct;
  if (!product) return;
  const item = {
    key: [product.id, $('#customizerSize').value, $('#customizerColor').value, $('#customizerName').value.trim(), $('#customizerText').value.trim(), $('#customizerPosition').value, $('#customizerFont').value].join('::'),
    productId: Number(product.id), productName: product.name, price: Number(product.price), image: product.image_url,
    category: product.category, size: $('#customizerSize').value, color: $('#customizerColor').value,
    customName: $('#customizerName').value.trim(), customText: $('#customizerText').value.trim(),
    position: $('#customizerPosition').value, font: $('#customizerFont').value, quantity: 1
  };
  const match = cart.find(entry => entry.key === item.key);
  if (match) match.quantity = Math.min(10, match.quantity + 1); else cart.push(item);
  saveCart();
  closeDialog('customizerDialog');
  openCart();
  toast('Your personalized piece is in the bag.');
}

function showAuth(mode = 'login') {
  renderAuthMode(mode);
  openDialog('authDialog');
}
function renderAuthMode(mode) {
  $$('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.authMode === mode));
  const area = $('#authFormArea');
  if (mode === 'register') {
    $('#authTitle').textContent = 'Let’s make it personal.';
    area.innerHTML = `<form id="registerForm" class="stacked-form"><label for="registerName">Full name</label><input id="registerName" name="name" autocomplete="name" required minlength="2" placeholder="Your name"><label for="registerEmail">Email address</label><input id="registerEmail" name="email" type="email" autocomplete="email" required placeholder="you@example.com"><label for="registerPassword">Create a password</label><input id="registerPassword" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"><button class="button button-dark button-full" type="submit">Create your account <span>↗</span></button></form>`;
    $('#registerForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try { const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) }); acceptUser(data.user); closeDialog('authDialog'); toast(data.message || 'Account created.'); }
      catch (error) { toast(error.message, 'error'); }
    });
  } else if (mode === 'phone') {
    $('#authTitle').textContent = 'Your number, verified.';
    area.innerHTML = `<form id="phoneForm" class="stacked-form"><label for="otpPhone">Mobile number</label><input id="otpPhone" name="phone" type="tel" autocomplete="tel" required placeholder="+919876543210"><button class="button button-outline button-full" type="button" id="sendOtpButton">Send verification code</button><label for="otpCode">Verification code</label><input id="otpCode" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="Enter the code you receive" required pattern="[0-9]{4,10}"><button class="button button-dark button-full" type="submit">Verify & sign in <span>↗</span></button><p class="form-note">Enter your number with country code, for example +91 followed by your mobile number.</p></form>`;
    $('#sendOtpButton').addEventListener('click', async () => {
      const phone = $('#otpPhone').value.trim();
      try { const data = await api('/api/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone }) }); otpSentFor = phone; toast(data.message || 'Verification code sent.'); $('#otpCode').focus(); }
      catch (error) { toast(error.message, 'error'); }
    });
    $('#phoneForm').addEventListener('submit', async event => {
      event.preventDefault();
      const phone = $('#otpPhone').value.trim(); const code = $('#otpCode').value.trim();
      if (otpSentFor && otpSentFor !== phone) return toast('Send a new code for the phone number you entered.', 'error');
      try { const data = await api('/api/auth/otp/check', { method: 'POST', body: JSON.stringify({ phone, code }) }); acceptUser(data.user); closeDialog('authDialog'); toast(data.message || 'Phone verified.'); }
      catch (error) { toast(error.message, 'error'); }
    });
  } else {
    $('#authTitle').textContent = 'Good to have you here.';
    area.innerHTML = `<form id="loginForm" class="stacked-form"><label for="loginEmail">Email address</label><input id="loginEmail" name="email" type="email" autocomplete="email" required placeholder="you@example.com"><label for="loginPassword">Password</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="At least 8 characters"><button class="button button-dark button-full" type="submit">Sign in <span>↗</span></button></form>`;
    $('#loginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) }); acceptUser(data.user); closeDialog('authDialog'); toast(data.message || 'Signed in.'); }
      catch (error) { toast(error.message, 'error'); }
    });
  }
}
function acceptUser(user) {
  currentUser = user || null;
  $('#accountButtonText').textContent = currentUser ? (currentUser.name.split(' ')[0] || 'Account') : 'Sign in';
  $('#supportName').value = currentUser?.name || $('#supportName').value;
  $('#supportEmail').value = currentUser?.email || $('#supportEmail').value;
  $('#checkoutName').value = currentUser?.name || '';
  $('#checkoutEmail').value = currentUser?.email || '';
  $('#checkoutPhone').value = currentUser?.phone || '';
}
async function loadCurrentUser() {
  try { const data = await api('/api/me'); acceptUser(data.user); }
  catch { acceptUser(null); }
}
async function openAccount() {
  if (!currentUser) return showAuth('login');
  $('#accountHeading').textContent = `Hello, ${currentUser.name.split(' ')[0]}.`;
  $('#accountProfile').innerHTML = `<div class="account-avatar">${escapeHtml((currentUser.name || 'B').slice(0, 1).toUpperCase())}</div><div><strong>${escapeHtml(currentUser.name)}</strong><small>${escapeHtml(currentUser.email || currentUser.phone || 'Boisterous customer')}</small></div>`;
  $('#adminPanel').hidden = !currentUser.isAdmin;
  openDialog('accountDialog');
  await loadOrders();
  if (currentUser.isAdmin) await loadAdminOrders();
}
async function loadOrders() {
  const target = $('#accountOrders');
  target.innerHTML = '<p class="muted">Loading your orders...</p>';
  try {
    const data = await api('/api/orders');
    if (!data.orders?.length) { target.innerHTML = '<p class="muted">No orders yet. Your next favourite piece might be waiting in the collection.</p>'; return; }
    target.innerHTML = data.orders.map(order => `<article class="order-card"><div class="order-card-top"><strong>${escapeHtml(order.orderNumber || order.order_number || `Order #${order.id}`)}</strong><span class="order-status">${escapeHtml(order.status || 'confirmed')}</span></div><div class="order-card-detail">Placed ${formatDate(order.createdAt || order.created_at)} · Total ${money(order.total || order.total_amount)}<br>${escapeHtml((order.items || []).map(item => `${item.productName || item.product_name || 'Piece'} × ${item.quantity}`).join(', '))}</div></article>`).join('');
  } catch (error) { target.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`; }
}
async function loadAdminOrders() {
  const target = $('#adminOrdersList');
  target.innerHTML = '<p class="muted">Loading store orders...</p>';
  try {
    const data = await api('/api/admin/orders');
    if (!data.orders?.length) { target.innerHTML = '<p class="muted">No orders in the store yet.</p>'; return; }
    target.innerHTML = data.orders.map(order => `<article class="admin-order-row"><strong>${escapeHtml(order.orderNumber || order.order_number)} · ${money(order.total || order.total_amount)}</strong><div>${escapeHtml(order.customerName || order.customer_name || 'Customer')} · ${escapeHtml(order.customerEmail || order.customer_email || '')}<br><span class="muted">${formatDate(order.createdAt || order.created_at)}</span></div><div class="admin-order-controls"><select data-status-for="${Number(order.id)}" aria-label="Set order status"><option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option><option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option><option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option><option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option><option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select><button data-update-order="${Number(order.id)}">Update</button></div></article>`).join('');
    $$('[data-update-order]', target).forEach(button => button.addEventListener('click', async () => {
      const id = button.dataset.updateOrder;
      const status = $(`[data-status-for="${id}"]`, target).value;
      try { await api(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); toast('Order status updated.'); await loadAdminOrders(); }
      catch (error) { toast(error.message, 'error'); }
    }));
  } catch (error) { target.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`; }
}

async function submitCheckout(event) {
  event.preventDefault();
  if (!currentUser) { closeDialog('checkoutDialog'); showAuth('login'); return toast('Please sign in before placing an order.', 'error'); }
  if (!cart.length) return toast('Your bag is empty.', 'error');
  const form = new FormData(event.currentTarget);
  const body = { ...Object.fromEntries(form), items: cart.map(item => ({ productId: item.productId, quantity: item.quantity, size: item.size, color: item.color, customName: item.customName, customText: item.customText, position: item.position })) };
  const submitButton = $('button[type="submit"]', event.currentTarget);
  submitButton.disabled = true; submitButton.textContent = 'Placing your order...';
  try {
    const data = await api('/api/orders', { method: 'POST', body: JSON.stringify(body) });
    cart = []; saveCart(); closeDialog('checkoutDialog'); closeCart();
    toast(`Order ${data.order.orderNumber || data.order.order_number} placed successfully.`, 'success');
    await loadOrders();
    $('#accountHeading').textContent = 'Order received. Thank you.';
    $('#accountProfile').innerHTML = `<div class="account-avatar">✳</div><div><strong>${escapeHtml(data.order.orderNumber || data.order.order_number)}</strong><small>Cash on Delivery · ${money(data.order.total || data.order.total_amount)}</small></div>`;
    openDialog('accountDialog');
  } catch (error) { toast(error.message, 'error'); }
  finally { submitButton.disabled = false; submitButton.innerHTML = 'Place order · Cash on Delivery <span>↗</span>'; }
}
async function submitSupport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const submitButton = $('button[type="submit"]', form);
  submitButton.disabled = true; submitButton.textContent = 'Sending your message...';
  try {
    const data = await api('/api/support', { method: 'POST', body: JSON.stringify(Object.fromEntries(formData)) });
    toast(`Message sent. Your ticket is ${data.ticketNumber}.`, 'success');
    form.reset();
    if (currentUser) { $('#supportName').value = currentUser.name || ''; $('#supportEmail').value = currentUser.email || ''; }
  } catch (error) { toast(error.message, 'error'); }
  finally { submitButton.disabled = false; submitButton.innerHTML = 'Send your message <span>↗</span>'; }
}

function appendChatMessage(text, role) {
  const node = document.createElement('div');
  node.className = `chat-message ${role === 'user' ? 'user-message' : 'bot-message'}`;
  node.textContent = text;
  $('#chatMessages').appendChild(node);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
  return node;
}
async function sendChatMessage(message) {
  const trimmed = String(message || '').trim();
  if (!trimmed || chatSending) return;
  appendChatMessage(trimmed, 'user');
  $('#chatInput').value = '';
  chatSending = true;
  const typing = document.createElement('div'); typing.className = 'typing-indicator'; typing.textContent = 'Stylist is thinking…'; $('#chatMessages').appendChild(typing);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
  try {
    const data = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: trimmed }) });
    typing.remove(); appendChatMessage(data.reply, 'bot');
    $('#chatModeNote').textContent = data.mode === 'ai' ? 'Live AI stylist' : 'Demo replies · Configure OPENAI_API_KEY for live AI';
  } catch (error) { typing.remove(); appendChatMessage(error.message, 'bot'); }
  finally { chatSending = false; }
}

function bindEvents() {
  $('#yearNow').textContent = new Date().getFullYear();
  $('#openCartButton').addEventListener('click', openCart);
  $('#closeCartButton').addEventListener('click', closeCart);
  $('#drawerBackdrop').addEventListener('click', closeCart);
  $('#accountButton').addEventListener('click', openAccount);
  $('#footerAccountButton').addEventListener('click', openAccount);
  $('#checkoutButton').addEventListener('click', () => {
    if (!cart.length) return toast('Your bag is empty.', 'error');
    if (!currentUser) { closeCart(); showAuth('login'); toast('Sign in to place your order.'); return; }
    $('#checkoutTotal').textContent = money(cartSubtotal() + (cartSubtotal() >= 15000 ? 0 : 399));
    $('#checkoutName').value = currentUser.name || '';
    $('#checkoutEmail').value = currentUser.email || '';
    $('#checkoutPhone').value = currentUser.phone || '';
    closeCart(); openDialog('checkoutDialog');
  });
  $('#customizerForm').addEventListener('submit', event => { event.preventDefault(); addToCart(); });
  ['customizerName', 'customizerText', 'customizerPosition', 'customizerFont'].forEach(id => $(`#${id}`).addEventListener('input', updatePersonalizationPreview));
  $$('.filter-button').forEach(button => button.addEventListener('click', () => { activeCategory = button.dataset.category; $$('.filter-button').forEach(tab => tab.classList.toggle('active', tab === button)); renderProducts(); }));
  $('#startCustomizeButton').addEventListener('click', () => showCustomizer(1));
  $$('.auth-tab').forEach(tab => tab.addEventListener('click', () => renderAuthMode(tab.dataset.authMode)));
  $$('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.dataset.close)));
  $$('.site-dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
  $('#checkoutForm').addEventListener('submit', submitCheckout);
  $('#supportForm').addEventListener('submit', submitSupport);
  $('#logoutButton').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {}
    acceptUser(null); closeDialog('accountDialog'); toast('You are signed out.');
  });
  $('#chatLauncher').addEventListener('click', () => {
    const open = !$('#chatPanel').hidden;
    $('#chatPanel').hidden = open;
    $('#chatLauncher').setAttribute('aria-expanded', String(!open));
    if (!open) $('#chatInput').focus();
  });
  $('#chatClose').addEventListener('click', () => { $('#chatPanel').hidden = true; $('#chatLauncher').setAttribute('aria-expanded', 'false'); });
  $('#chatForm').addEventListener('submit', event => { event.preventDefault(); sendChatMessage($('#chatInput').value); });
  $$('[data-chat-prompt]').forEach(button => button.addEventListener('click', () => sendChatMessage(button.dataset.chatPrompt)));
  $('#mobileMenuButton').addEventListener('click', () => $('#mobileNav').classList.toggle('open'));
  $$('#mobileNav a').forEach(link => link.addEventListener('click', () => $('#mobileNav').classList.remove('open')));
}

async function init() {
  bindEvents();
  renderCart();
  try {
    const data = await api('/api/products');
    if (Array.isArray(data.products) && data.products.length) catalogue = data.products;
  } catch (error) {
    console.warn('Using built-in product catalogue:', error.message);
  }
  renderProducts();
  await loadCurrentUser();
  const params = new URLSearchParams(window.location.search);
  if (params.has('auth')) {
    const result = params.get('auth');
    if (result === 'google-success') { await loadCurrentUser(); toast('Signed in with Google.'); }
    else toast(result === 'google-not-configured' ? 'Google sign-in is not configured yet. Add the Google OAuth credentials to .env.' : 'Google sign-in could not be completed. Check the OAuth setup and try again.', 'error');
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }
}

document.addEventListener('DOMContentLoaded', init);
