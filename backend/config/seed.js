const User    = require('../models/User');
const Service = require('../models/Service');

const SERVICES = [
  { name: 'Haircut & Styling',  price: 299,  description: 'Expert cut and style tailored to your face shape.',          category: 'hair',   duration: 45  },
  { name: 'Hair Colour',        price: 999,  description: 'Full colour, highlights, or balayage by our colour experts.', category: 'hair',   duration: 120 },
  { name: 'Keratin Treatment',  price: 2499, description: 'Smoothing keratin therapy for frizz-free, glossy hair.',      category: 'hair',   duration: 180 },
  { name: 'Facial',             price: 599,  description: 'Deep-cleansing facial with premium skincare products.',       category: 'skin',   duration: 60  },
  { name: 'Cleanup',            price: 349,  description: 'Refreshing skin cleanup for instant glow.',                  category: 'skin',   duration: 30  },
  { name: 'Waxing (Full Body)', price: 1199, description: 'Complete full-body waxing for silky smooth skin.',           category: 'skin',   duration: 90  },
  { name: 'Manicure',           price: 399,  description: 'Nail shaping, cuticle care, and polish application.',        category: 'nails',  duration: 45  },
  { name: 'Pedicure',           price: 499,  description: 'Foot soak, scrub, massage, and nail care.',                  category: 'nails',  duration: 60  },
  { name: 'Bridal Makeup',      price: 4999, description: 'Glamorous bridal look with HD makeup and setting spray.',    category: 'makeup', duration: 120 },
  { name: 'Party Makeup',       price: 1499, description: 'Stunning party-ready makeup for any special occasion.',      category: 'makeup', duration: 60  },
  { name: 'Head Massage',       price: 299,  description: 'Relaxing scalp and head massage to de-stress.',              category: 'spa',    duration: 30  },
  { name: 'Body Spa',           price: 1999, description: 'Full body relaxing spa treatment with aromatic oils.',       category: 'spa',    duration: 90  },
];

module.exports = async function seed() {
  try {
    const adminExists = await User.findOne({ email: 'admin@slique.com' });
    if (!adminExists) {
      await User.create({ name: 'Slique Admin', email: 'admin@slique.com', password: 'admin123', role: 'admin', isVerified: true });
      console.log('🌱  Admin seeded → admin@slique.com / admin123');
    }
    if ((await Service.countDocuments()) === 0) {
      await Service.insertMany(SERVICES);
      console.log(`🌱  ${SERVICES.length} services seeded`);
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};
