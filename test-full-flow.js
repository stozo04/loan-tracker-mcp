import { spawn } from 'child_process';

const server = spawn('npm', ['run', 'start'], { 
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: true 
});

// Test complete flow: Create loan -> Add payment -> Add another payment
const messages = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'create_loan',
      arguments: {
        name: 'New Dining Table',
        original_amount: 2000,
        loan_type: 'furniture',
        term_months: 18
      }
    }
  },
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'add_payment',
      arguments: {
        loan_name: 'New Dining Table',
        amount: 300,
        paid_by: 'Katerina'
      }
    }
  },
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'add_payment',
      arguments: {
        loan_name: 'New Dining Table',
        amount: 200,
        paid_by: 'Steven'
      }
    }
  }
];

server.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});

let messageIndex = 0;

function sendNextMessage() {
  if (messageIndex < messages.length) {
    const message = messages[messageIndex];
    console.log(`\n--- Sending message ${messageIndex + 1}: ${message.params.name} ---`);
    server.stdin.write(JSON.stringify(message) + '\n');
    messageIndex++;
    setTimeout(sendNextMessage, 1000);
  } else {
    setTimeout(() => server.kill(), 1000);
  }
}

setTimeout(sendNextMessage, 500);