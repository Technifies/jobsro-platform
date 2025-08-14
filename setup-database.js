const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection string from Render
const connectionString = 'postgresql://jobsro_user:dYi8cc84tVmzqPgo4GBY6ZedZE7EXXDL@dpg-d2f4rvbipnbc739nvl90-a.singapore-postgres.render.com/jobsro_db';

async function setupDatabase() {
    const client = new Client({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔌 Connecting to Render PostgreSQL database...');
        await client.connect();
        console.log('✅ Connected successfully!');

        // Read the SQL schema file
        console.log('📄 Reading database schema...');
        const schemaPath = path.join(__dirname, 'database', 'production-schema.sql');
        const sqlSchema = fs.readFileSync(schemaPath, 'utf8');

        // Execute the schema
        console.log('🚀 Executing database schema...');
        await client.query(sqlSchema);
        console.log('✅ Database schema executed successfully!');

        // Test the setup by counting records
        console.log('🔍 Verifying database setup...');
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        const jobCount = await client.query('SELECT COUNT(*) FROM jobs');
        const companyCount = await client.query('SELECT COUNT(*) FROM companies');

        console.log(`📊 Database verification complete:
        - Users: ${userCount.rows[0].count}
        - Jobs: ${jobCount.rows[0].count}
        - Companies: ${companyCount.rows[0].count}`);

        console.log('🎉 Database setup completed successfully!');

    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed.');
    }
}

setupDatabase();