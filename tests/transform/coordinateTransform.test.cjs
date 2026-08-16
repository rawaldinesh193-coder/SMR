// Standalone Coordinate Transformation Math Engine Test
function transformDesktopClickToNormalized(clientX, clientY, boundingRect, viewport) {
  const relativeX = clientX - boundingRect.left;
  const relativeY = clientY - boundingRect.top;

  let normX = relativeX / boundingRect.width;
  let normY = relativeY / boundingRect.height;

  normX = Math.max(0, Math.min(1, normX));
  normY = Math.max(0, Math.min(1, normY));

  return { normX, normY };
}

function runTests() {
  console.log('=== Running SMR Coordinate Transformation Unit Tests ===');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // Test 1: Standard Center Click
  const rect = { left: 100, top: 50, width: 400, height: 800 };
  const res1 = transformDesktopClickToNormalized(300, 450, rect, {
    videoWidth: 1080,
    videoHeight: 1920,
    elementWidth: 400,
    elementHeight: 800,
    rotation: 0,
    zoom: 1.0
  });

  assert(res1.normX === 0.5 && res1.normY === 0.5, 'Center click transforms to (0.5, 0.5)');

  // Test 2: Top-Left Corner
  const res2 = transformDesktopClickToNormalized(100, 50, rect, {
    videoWidth: 1080,
    videoHeight: 1920,
    elementWidth: 400,
    elementHeight: 800,
    rotation: 0,
    zoom: 1.0
  });

  assert(res2.normX === 0 && res2.normY === 0, 'Top-left click transforms to (0.0, 0.0)');

  // Test 3: Clamping Out-of-bounds clicks
  const res3 = transformDesktopClickToNormalized(600, 1000, rect, {
    videoWidth: 1080,
    videoHeight: 1920,
    elementWidth: 400,
    elementHeight: 800,
    rotation: 0,
    zoom: 1.0
  });

  assert(res3.normX === 1.0 && res3.normY === 1.0, 'Out-of-bounds click clamps to (1.0, 1.0)');

  console.log(`\nTest Summary: ${passed}/${total} tests passed successfully.`);
}

runTests();
