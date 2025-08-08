const fs = require('fs');
const fetch = require('node-fetch');

const RAILWAY_URL = 'https://jobbossscheduler-production.up.railway.app';

async function importJSON(filePath, tableType) {
  try {
    console.log(`Reading file from ${filePath}...`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log('File content read successfully.');

    console.log('Parsing JSON data...');
    const jsonData = JSON.parse(fileContent);
    console.log(`JSON data parsed successfully. Found ${jsonData.length} records.`);

    console.log(`Sending data to ${RAILWAY_URL}/api/import-json...`);
    const response = await fetch(`${RAILWAY_URL}/api/import-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tableType,
        data: jsonData,
      }),
      timeout: 300000, // 5 minutes
    });
    console.log(`Response status: ${response.status}`);

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
  console.log('Starting JSON import...');
  await importJSON('attached_assets/resources.json', 'resources');
  console.log('Import process completed!');
}

main().catch(console.error);

