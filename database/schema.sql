CREATE DATABASE IF NOT EXISTS boisterous
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE boisterous;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(40) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  compare_at DECIMAL(10,2) DEFAULT NULL,
  description TEXT NOT NULL,
  image_url VARCHAR(600) NOT NULL,
  badge VARCHAR(60) DEFAULT NULL,
  colors JSON NOT NULL,
  sizes JSON NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_products_category_active (category, active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) DEFAULT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  google_id VARCHAR(120) DEFAULT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_google_id (google_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(190) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
  payment_method VARCHAR(40) NOT NULL DEFAULT 'cash_on_delivery',
  shipping_address TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_orders_user_created (user_id, created_at),
  INDEX idx_orders_status_created (status, created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED DEFAULT NULL,
  product_name VARCHAR(180) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  size VARCHAR(24) NOT NULL,
  color VARCHAR(40) NOT NULL,
  custom_name VARCHAR(80) DEFAULT NULL,
  custom_text VARCHAR(180) DEFAULT NULL,
  customization_position VARCHAR(40) DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_number VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(190) NOT NULL,
  subject VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_support_status_created (status, created_at),
  CONSTRAINT fk_support_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO products (id, slug, name, category, price, compare_at, description, image_url, badge, colors, sizes, active) VALUES
(1, 'atelier-wool-coat', 'The Atelier Wool Coat', 'Coats', 14900.00, 17900.00, 'A clean, architectural silhouette with a soft structure and a considered finish.', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1100&q=85', 'BESTSELLER', '["Black","Camel","Charcoal"]', '["S","M","L","XL","XXL"]', 1),
(2, 'double-breasted-coat', 'The Double-Breasted', 'Coats', 16900.00, NULL, 'A timeless double-breasted layer made for sharp everyday dressing.', 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1100&q=85', 'SIGNATURE', '["Black","Camel","Navy"]', '["S","M","L","XL","XXL"]', 1),
(3, 'everyday-oxford-shirt', 'The Everyday Oxford', 'Shirts', 5900.00, NULL, 'A crisp, easy-to-wear shirt, ready for a name or a small signature detail.', 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1100&q=85', 'CUSTOM FAVOURITE', '["White","Sky Blue","Black"]', '["S","M","L","XL","XXL"]', 1),
(4, 'linen-weekend-shirt', 'The Linen Weekend', 'Shirts', 4900.00, 5500.00, 'Relaxed texture and a breathable feel for slower days and warm evenings.', 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1100&q=85', NULL, '["White","Olive","Sand"]', '["S","M","L","XL","XXL"]', 1),
(5, 'straight-fit-denim', 'The Straight-Fit Denim', 'Jeans', 6900.00, NULL, 'A versatile straight fit with a clean wash that makes every outfit feel intentional.', 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1100&q=85', 'EVERYDAY ICON', '["Indigo","Black","Light Blue"]', '["28","30","32","34","36","38"]', 1),
(6, 'selvedge-denim', 'The Selvedge Denim', 'Jeans', 8900.00, 9900.00, 'A refined denim essential with a deeper tone and a premium, pared-back finish.', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1100&q=85', 'PREMIUM', '["Dark Indigo","Black"]', '["28","30","32","34","36","38"]', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), category = VALUES(category), price = VALUES(price),
  compare_at = VALUES(compare_at), description = VALUES(description), image_url = VALUES(image_url),
  badge = VALUES(badge), colors = VALUES(colors), sizes = VALUES(sizes), active = VALUES(active);
