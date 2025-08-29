// test-edge-function.js - Secure version using environment variables
import dotenv from 'dotenv'

// Load environment variables from dashboard/.env.local
dotenv.config({ path: './dashboard/.env.local' })

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!NEXT_PUBLIC_SUPABASE_URL) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL not found in environment variables"
  );
  console.log(
    "Make sure your dashboard/.env.local file exists and has the correct variables"
  );
  process.exit(1);
}

if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in environment variables"
  );
  console.log(
    "Make sure your dashboard/.env.local file exists and has the correct variables"
  );
  process.exit(1);
}

async function testEdgeFunction() {
  const functionUrl = `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/loan-manager`;

  console.log("🧪 Testing Supabase Edge Function");
  console.log("📍 Function URL:", functionUrl);
  console.log("🔑 Using environment variables for auth\n");

  try {
    // Test 1: Create a new loan
    console.log("📝 Test 1: Creating a new loan...");
    const createResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "create_loan",
        name: "Cloud Test Sofa",
        original_amount: 1800,
        loan_type: "furniture",
        term_months: 20,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(
        `HTTP ${createResponse.status}: ${createResponse.statusText}`
      );
    }

    const createResult = await createResponse.json();
    console.log("✅ Create loan result:", createResult.message);
    console.log("📊 Loan data:", createResult.data);

    // Test 2: Add a payment
    console.log("\n💰 Test 2: Adding a payment...");
    const paymentResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "add_payment",
        loan_name: "Cloud Test Sofa",
        amount: 300,
        paid_by: "Steven",
      }),
    });

    if (!paymentResponse.ok) {
      throw new Error(
        `HTTP ${paymentResponse.status}: ${paymentResponse.statusText}`
      );
    }

    const paymentResult = await paymentResponse.json();
    console.log("✅ Add payment result:", paymentResult.message);
    console.log("📊 Payment data:", paymentResult.data);

    // Test 3: Get all loans
    console.log("\n📊 Test 3: Getting all loans...");
    const loansResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "get_loans",
      }),
    });

    if (!loansResponse.ok) {
      throw new Error(
        `HTTP ${loansResponse.status}: ${loansResponse.statusText}`
      );
    }

    const loansResult = await loansResponse.json();
    console.log("✅ Get loans result:", loansResult.message);
    console.log(
      "📊 Found loans:",
      loansResult.data.map((loan) => ({
        name: loan.name,
        amount: `$${loan.original_amount}`,
        remaining: `$${loan.current_balance}`,
        progress: `${Math.round(loan.progress_percentage)}%`,
      }))
    );

    // Test 4: Try to add payment to non-existent loan (should fail)
    console.log("\n🧪 Test 4: Testing error handling...");
    const errorResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "add_payment",
        loan_name: "Non-existent Loan",
        amount: 100,
        paid_by: "Steven",
      }),
    });

    const errorResult = await errorResponse.json();
    if (errorResult.success === false) {
      console.log("✅ Error handling works:", errorResult.error);
    } else {
      console.log("❓ Expected error but got success");
    }

    console.log("\n🎉 All tests completed successfully!");
    console.log(
      "🌐 Your Edge Function is working and accessible from anywhere!"
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    if (error.message.includes("fetch")) {
      console.log("\n💡 This might mean:");
      console.log("   - Your Edge Function is not deployed yet");
      console.log("   - Network connectivity issues");
      console.log("   - Supabase is experiencing issues");
    }
  }
}

// Run the tests
console.log('🚀 Starting Edge Function tests...\n')
testEdgeFunction().catch(console.error)