import { supabase } from '@/integrations/supabase/client';
import bcrypt from 'bcryptjs';

const flavors = [
  {
    name: 'Classic Vanilla',
    description: 'Rich and creamy classic vanilla bean',
    price_per_scoop: 12.99,
    image: '/placeholder.svg',
    category: 'Classic',
    available: true,
  },
  {
    name: 'Double Chocolate',
    description: 'Decadent chocolate with chocolate chips',
    price_per_scoop: 14.99,
    image: '/placeholder.svg',
    category: 'Classic',
    available: true,
  },
  {
    name: 'Fresh Strawberry',
    description: 'Made with fresh strawberries and cream',
    price_per_scoop: 14.99,
    image: '/placeholder.svg',
    category: 'Classic',
    available: true,
  },
  // Add more flavors as needed
];

export async function seedFlavors() {
  for (const flavor of flavors) {
    await supabase.from('ice_cream_flavors').insert([flavor]);
  }
  console.log('Seeded flavors!');
}

export async function seedSampleStaff() {
  const pin = '123456';
  const pin_hash = bcrypt.hashSync(pin, 10);
  await supabase.from('staff').insert([
    {
      name: 'amasa',
      role: 'staff',
      pin_hash,
    },
  ]);
  console.log('Seeded staff: amasa (pin: 123456)');
}

// To run: import and call seedFlavors() in a script or dev tool 