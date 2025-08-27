import { spawn } from 'child_process';

// Start the MCP server
const server = spawn('npm', ['run', 'start'], { 
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: true 
});

// Test: Create a loan
const createLoanMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'create_loan',
    arguments: {
      name: 'Test Couch',
      original_amount: 1500,
      loan_type: 'furniture',
      term_months: 12,
      loan_date: '2024-08-23'
    }
  }
};

let responseData = '';

server.stdout.on('data', (data) => {
  responseData += data.toString();
  console.log('Response:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Send the create loan request
setTimeout(() => {
  console.log('Sending create loan request...');
  server.stdin.write(JSON.stringify(createLoanMessage) + '\n');
}, 500);

// Close after 3 seconds
setTimeout(() => {
  server.kill();
}, 3000);