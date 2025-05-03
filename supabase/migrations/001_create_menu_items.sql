-- Create the menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    description TEXT
);

-- Insert menu items
INSERT INTO menu_items (id, name, category, price, description) VALUES
('flavor-vanilla', 'Vanilla', 'Flavors', 30, NULL),
('flavor-chocolate', 'Chocolate', 'Flavors', 30, NULL),
('flavor-strawberry', 'Strawberry', 'Flavors', 30, NULL),
('flavor-oreo', 'Oreo', 'Flavors', 30, NULL),
('flavor-pistachios', 'Pistachios', 'Flavors', 30, NULL),
('flavor-kitkat', 'Kitkat', 'Flavors', 30, NULL),
('topping-haribo', 'Haribo', 'Toppings', 10, NULL),
('topping-sourjellies', 'Sour Jellies', 'Toppings', 10, NULL),
('topping-sprinkles', 'Sprinkles', 'Toppings', 10, NULL),
('topping-smarties', 'Smarties', 'Toppings', 10, NULL),
('waffle-bubble', 'Bubble Waffle', 'Waffles & Pancakes', 20, NULL),
('waffle-stick', 'Waffle Stick', 'Waffles & Pancakes', 15, NULL),
('pancake-mini', 'Mini Pancake (10 pieces)', 'Waffles & Pancakes', 20, NULL),
('sundae-turtle', 'Turtle', 'Sundaes', 90, '2 scoops of ice cream topped with hot fudge or caramel sauce and 2 waffle sticks'),
('sundae-tinroof', 'Tin Roof', 'Sundaes', 90, '2 scoops of ice cream drizzled with any 2 toppings and 10 pieces of mini pancakes'),
('sundae-bubblecream', 'Bubble Cream', 'Sundaes', 70, '1 scoop of ice cream with bubble waffle, 1 topping and caramel or chocolate sauce'),
('cone', 'Cone', 'Sundaes', 10, NULL),
('milkshake-vanilla', 'Vanilla Milkshake', 'Milkshakes', 60, NULL),
('milkshake-oreo', 'Oreo Milkshake', 'Milkshakes', 60, NULL),
('milkshake-chocolate', 'Chocolate Milkshake', 'Milkshakes', 60, NULL),
('milkshake-strawberry', 'Strawberry Milkshake', 'Milkshakes', 60, NULL),
('juice-orange', 'Orange Juice', 'Juice', 30, NULL),
('juice-pineapple', 'Pineapple Juice', 'Juice', 30, NULL),
('juice-watermelon', 'Watermelon Juice', 'Juice', 30, NULL); 