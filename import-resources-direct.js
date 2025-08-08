// Direct database import for resources
import { Pool } from 'pg';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:YOUR_PASSWORD@postgres.railway.internal:5432/railway';

async function importResources() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log('Reading resources JSON...');
    const jsonData = fs.readFileSync('attached_assets/resources.json', 'utf8');
    const resources = JSON.parse(jsonData);
    
    console.log(`Found ${resources.length} resources to import`);
    
    // Clear existing resources
    console.log('Clearing existing resources...');
    await pool.query('DELETE FROM resources');
    
    // Import each resource
    let importedCount = 0;
    for (const resource of resources) {
      try {
        await pool.query(`
          INSERT INTO resources (
            name, employee_id, role, email, work_centers, skills, 
            shift_schedule, work_schedule, hourly_rate, overtime_rate, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          resource.name,
          resource.employee_id,
          resource.role,
          resource.email || '',
          JSON.stringify(resource.work_centers || []),
          JSON.stringify(resource.skills || []),
          JSON.stringify(resource.shift_schedule || [1]),
          JSON.stringify(resource.work_schedule || {}),
          resource.hourly_rate || null,
          resource.overtime_rate || null,
          'Active'
        ]);
        importedCount++;
        console.log(`Imported: ${resource.name} (${resource.employee_id})`);
      } catch (error) {
        console.error(`Failed to import ${resource.name}:`, error.message);
      }
    }
    
    console.log(`✅ Successfully imported ${importedCount} resources!`);
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await pool.end();
  }
}

importResources();
