import { spawn } from 'child_process';

const server = spawn('npm', ['run', 'start'], { 
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: true 
});

// Test: Add a payment to the Test Couch
const addPaymentMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'add_payment',
    arguments: {
      loan_name: 'Test Couch',
      amount: 250,
      paid_by: 'Steven',
      payment_date: '2024-08-23'
    }
  }
};

server.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Send the payment request
setTimeout(() => {
  console.log('Adding Steven\'s $250 payment to Test Couch...');
  server.stdin.write(JSON.stringify(addPaymentMessage) + '\n');
}, 500);

setTimeout(() => {
  server.kill();
}, 3000);