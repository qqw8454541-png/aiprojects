#!/bin/bash

# ==============================================================================
# LLM-WEB-API Unit Test Runner
#
# 【如何执行本脚本】: 
#   方式一: 在终端运行 ./test.sh
#   方式二: 在终端运行 npm run test
#
# 【Coverage 覆盖率报告生成位置】:
#   执行成功后，HTML格式的详细报告会生成于当前目录下的:
#   ./coverage/lcov-report/index.html
# ==============================================================================

# Navigate to the directory where the script is located
cd "$(dirname "$0")"

echo "======================================="
echo "   🚀 Running LLM-WEB-API Unit Tests   "
echo "======================================="
echo ""

# Run the test suite via npm
npm run test

# Check if unit tests passed
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All unit tests passed successfully!"
  echo "📊 The text coverage summary is shown above."
  echo "🌐 Detailed HTML Coverage Report is available at:"
  echo "   file://$(pwd)/coverage/lcov-report/index.html"
  echo "======================================="

  echo ""
  echo "======================================="
  echo "   🌍 Running E2E API Test (test_llm.mjs) "
  echo "======================================="
  node ./test_llm.mjs
  
  if [ $? -eq 0 ]; then
    echo "✅ E2E API Test completed."
  else
    echo "❌ E2E API Test failed."
  fi
  echo "======================================="
else
  echo ""
  echo "❌ Some unit tests failed. Please review the output above."
  echo "======================================="
  exit 1
fi
