const apiUrl = "https://llm-web-api.vercel.app/api/evaluate";
const apiSecret = "dev-secret-key-123";

const players = [
  { playerId: "1", playerName: "Alice", pt: 50, rank: 1, history: [1, 2, 1] },
  { playerId: "2", playerName: "Bob", pt: 10, rank: 2, history: [2, 1, 2] }
];

async function testLLM() {
  console.log("Testing LLM API...");
  console.log(`Endpoint: ${apiUrl}`);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiSecret}`
      },
      body: JSON.stringify({
        players,
        locale: 'zh',
        scoringCtx: {
          ruleName: "Standard",
          uma: [15, 5, -5, -15],
          roundCount: 1
        }
      })
    });

    console.log("Status Code:", response.status);
    if (!response.ok) {
      console.log("Error response text:", await response.text());
      process.exit(1);
    }

    const json = await response.json();
    console.log("Response JSON:");
    console.log(JSON.stringify(json, null, 2));

    // 追加 JSON 格式检查
    if (!json || !json.data) {
      console.error("Test failed: JSON response does not contain 'data' property.");
      process.exit(1);
    }
    
    if (typeof json.data !== 'object' || Array.isArray(json.data)) {
      console.error("Test failed: 'data' property is not a valid object.");
      process.exit(1);
    }

    console.log("JSON format check passed! ✅");
  } catch (error) {
    console.error("Error during fetch:", error);
    process.exit(1);
  }
}

testLLM();
