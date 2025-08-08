const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const RAILWAY_URL = 'https://jobbossscheduler-production.up.railway.app';

async function importCSV(filePath, tableType) {
  try {
    console.log(`Importing ${tableType} from ${filePath}...`);
    
    const form = new FormData();
    form.append('tableType', tableType);
    form.append('csvFile', fs.createReadStream(filePath));
    
    const response = await fetch(`${RAILWAY_URL}/api/import-csv`, {
      method: 'POST',
      body: form,
      timeout: 300000 // 5 minutes
    });
    
    const result = await response.json();
    console.log(`${tableType} import result:`, result);
    
    if (result.status === 'ok') {
      console.log(`✅ Successfully imported ${result.importedCount} ${tableType}`);
    } else {
      console.log(`❌ Failed to import ${tableType}:`, result.message);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error importing ${tableType}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Starting CSV import...');
  
  // Import machines first (smallest file)
  await importCSV('attached_assets/machines.csv', 'machines');
  
  // Wait a bit between imports
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Import resources
  await importCSV('attached_assets/resources.csv', 'resources');
  
  // Wait a bit between imports
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Import jobs (largest file)
  await importCSV('attached_assets/jobs.csv', 'jobs');
  
  console.log('Import process completed!');
}

main().catch(console.error);
