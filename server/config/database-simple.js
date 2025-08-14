// Simplified database configuration for testing without PostgreSQL
const path = require('path');

// Simple in-memory data store for testing
const inMemoryDB = {
  users: [
    {
      id: 1,
      email: 'admin@jobsro.com',
      password: 'password123', // plain text for testing
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      status: 'active',
      created_at: new Date()
    },
    {
      id: 2,
      email: 'employer@jobsro.com',
      password: 'password123', // plain text for testing
      firstName: 'John',
      lastName: 'Employer',
      role: 'employer',
      status: 'active',
      created_at: new Date()
    },
    {
      id: 3,
      email: 'jobseeker@jobsro.com',
      password: 'password123', // plain text for testing
      firstName: 'Jane',
      lastName: 'Seeker',
      role: 'jobSeeker',
      status: 'active',
      created_at: new Date()
    }
  ],
  jobs: [
    {
      id: 1,
      title: 'Senior Full Stack Developer',
      description: 'We are looking for an experienced full stack developer...',
      company_id: 1,
      location: 'New York, NY',
      employment_type: 'full-time',
      experience_level: 'senior',
      salary_min: 100000,
      salary_max: 150000,
      status: 'active',
      created_at: new Date(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    },
    {
      id: 2,
      title: 'Frontend React Developer',
      description: 'Join our team as a React developer...',
      company_id: 1,
      location: 'San Francisco, CA',
      employment_type: 'full-time',
      experience_level: 'mid',
      salary_min: 80000,
      salary_max: 120000,
      status: 'active',
      created_at: new Date(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  ],
  companies: [
    {
      id: 1,
      name: 'TechCorp Inc.',
      description: 'Leading technology company',
      website: 'https://techcorp.com',
      logo: null,
      created_at: new Date()
    }
  ],
  applications: []
};

// Simple query function that mimics SQL
const query = async (text, params = []) => {
  console.log('Executing query:', text.substring(0, 50) + '...');
  
  // Parse simple SELECT queries
  if (text.toLowerCase().includes('select') && text.toLowerCase().includes('users')) {
    if (text.toLowerCase().includes('where email')) {
      const email = params[0];
      const user = inMemoryDB.users.find(u => u.email === email);
      return { rows: user ? [user] : [] };
    }
    if (text.toLowerCase().includes('where id')) {
      const id = params[0];
      const user = inMemoryDB.users.find(u => u.id === parseInt(id));
      return { rows: user ? [user] : [] };
    }
    return { rows: inMemoryDB.users };
  }
  
  if (text.toLowerCase().includes('select') && text.toLowerCase().includes('jobs')) {
    return { rows: inMemoryDB.jobs };
  }
  
  if (text.toLowerCase().includes('select') && text.toLowerCase().includes('companies')) {
    return { rows: inMemoryDB.companies };
  }
  
  if (text.toLowerCase().includes('select') && text.toLowerCase().includes('applications')) {
    return { rows: inMemoryDB.applications };
  }
  
  // Handle INSERT queries
  if (text.toLowerCase().includes('insert')) {
    console.log('INSERT query executed (simulated)');
    return { rows: [{ id: Math.floor(Math.random() * 1000) }] };
  }
  
  // Handle UPDATE queries
  if (text.toLowerCase().includes('update')) {
    console.log('UPDATE query executed (simulated)');
    return { rows: [{ id: 1 }] };
  }
  
  // Default response
  return { rows: [] };
};

// Transaction function
const transaction = async (callback) => {
  console.log('Starting transaction (simulated)');
  try {
    const result = await callback(query);
    console.log('Transaction committed (simulated)');
    return result;
  } catch (error) {
    console.log('Transaction rolled back (simulated)');
    throw error;
  }
};

// Connection test
const testConnection = async () => {
  try {
    console.log('✅ Database connection test passed (in-memory)');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

module.exports = {
  query,
  transaction,
  testConnection
};