const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🔍 RUNNING COMPREHENSIVE SECURITY & ACCESSIBILITY TEST SUITE');
console.log('================================================================');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function main() {
  const repoDir = __dirname;
  const dropHtml = fs.readFileSync(path.join(repoDir, 'drop.html'), 'utf8');
  const sendHtml = fs.readFileSync(path.join(repoDir, 'send.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(repoDir, 'style.css'), 'utf8');

  console.log('\n--- GROUP 1: HTML Parity & Mirroring ---');
  runTest('drop.html and send.html maintain 100% parity except canonical link', () => {
    const dropReplaced = dropHtml.replace(
      '<link rel="canonical" href="https://piyushdas1624.github.io/drop.html">',
      '<link rel="canonical" href="https://piyushdas1624.github.io/send.html">'
    );
    assert.strictEqual(
      dropReplaced,
      sendHtml,
      'send.html must be identical to drop.html except for canonical URL link tag'
    );
  });

  console.log('\n--- GROUP 2: Static DOM Leak Prevention & Anti-Snoop Security ---');
  const staticMarkup = dropHtml.split('<script>')[0];
  runTest('Initial static HTML markup does NOT render sensitive input controls or credentials', () => {
    assert(
      !staticMarkup.includes('id="custom-auth-key-input"'),
      'custom-auth-key-input must NOT exist in static DOM before owner auth'
    );
    assert(
      !staticMarkup.includes('id="custom-webhook-input"'),
      'custom-webhook-input must NOT exist in static DOM before owner auth'
    );
    assert(
      !staticMarkup.includes('id="feed-privacy-select"'),
      'feed-privacy-select must NOT exist in static DOM before owner auth'
    );
    assert(
      !staticMarkup.includes('id="setup-mode-badge"'),
      'setup-mode-badge must NOT exist in static DOM before owner auth'
    );
  });

  runTest('setup-unlocked-content is completely empty in initial markup', () => {
    assert(
      staticMarkup.includes('<div id="setup-unlocked-content" style="display: none;"></div>'),
      'setup-unlocked-content container must be empty with display: none'
    );
  });

  runTest('receipt-doc-link is hidden and unlinked in initial markup', () => {
    assert(
      staticMarkup.includes('id="receipt-doc-link" href="#"'),
      'receipt-doc-link must point to href="#" initially'
    );
    assert(
      staticMarkup.includes('id="receipt-doc-link" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="font-size: var(--text-xs); padding: var(--space-2) var(--space-4); display: none;'),
      'receipt-doc-link must be display: none initially'
    );
  });

  console.log('\n--- GROUP 3: Owner Lock Screen Text & Visual Accessibility ---');
  runTest('Setup lock screen displays exact required authentication notice', () => {
    const requiredPrompt =
      '🔒 Owner Authentication Required: Device Setup and backend cloud configuration are restricted to Piyush. Enter your Owner Secret PIN to access settings.';
    assert(
      staticMarkup.includes(requiredPrompt),
      `Setup lock screen must include exact prompt text: "${requiredPrompt}"`
    );
  });

  runTest('Tab bar and private tabs are hidden from public visitors by default', () => {
    assert(
      staticMarkup.includes('<div class="drop-tabs reveal" role="tablist" style="display: none;">'),
      'drop-tabs must be hidden (display: none) by default for public visitors'
    );
    assert(
      staticMarkup.includes('<button type="button" class="drop-tab" id="tab-feed" role="tab" aria-selected="false" aria-controls="view-feed" onclick="switchDropTab(\'feed\')" style="display: none;">'),
      'tab-feed must be hidden (display: none) by default'
    );
    assert(
      staticMarkup.includes('<button type="button" class="drop-tab" id="tab-setup" role="tab" aria-selected="false" aria-controls="view-setup" onclick="switchDropTab(\'setup\')" style="display: none;">'),
      'tab-setup must be hidden (display: none) by default'
    );
  });

  runTest('style.css defines setup lock card and locked drop tab classes', () => {
    assert(styleCss.includes('.setup-lock-card'), 'style.css must define .setup-lock-card');
    assert(styleCss.includes('.setup-lock-card .feed-lock-icon'), 'style.css must style lock icon');
    assert(styleCss.includes('.drop-tab.locked'), 'style.css must define .drop-tab.locked');
    assert(styleCss.includes('.drop-tab.locked:hover'), 'style.css must style .drop-tab.locked:hover');
  });

  console.log('\n--- GROUP 4: Anti-Spoofing & GAS URL Validation ---');
  // Extract isValidGasUrl from drop.html
  const isValidGasUrlMatch = dropHtml.match(/function isValidGasUrl\(url\) \{([\s\S]*?)\n    \}/);
  assert(isValidGasUrlMatch, 'isValidGasUrl function must be defined in drop.html');
  const isValidGasUrl = new Function('url', isValidGasUrlMatch[1]);

  runTest('isValidGasUrl accepts legitimate Google Apps Script endpoints', () => {
    assert.strictEqual(isValidGasUrl('https://script.google.com/macros/s/AKfycbx123/exec'), true);
    assert.strictEqual(isValidGasUrl('https://script.google.com/macros/u/0/s/AKfycbx123/exec'), true);
    assert.strictEqual(isValidGasUrl('https://script.google.com/macros/s/AKfycbx123/exec?action=ping'), true);
  });

  runTest('isValidGasUrl strictly rejects attacker domains, insecure protocols, and malformed URLs', () => {
    assert.strictEqual(isValidGasUrl('http://script.google.com/macros/s/AKfycbx123/exec'), false, 'Rejects http:');
    assert.strictEqual(isValidGasUrl('https://attacker.com/macros/s/AKfycbx123/exec'), false, 'Rejects attacker domain');
    assert.strictEqual(isValidGasUrl('https://script.google.com.attacker.com/macros/s/123/exec'), false, 'Rejects domain suffix hijack');
    assert.strictEqual(isValidGasUrl('https://google.com/search'), false, 'Rejects non-macros paths');
    assert.strictEqual(isValidGasUrl('javascript:alert(1)'), false, 'Rejects javascript: URIs');
    assert.strictEqual(isValidGasUrl(''), false, 'Rejects empty string');
    assert.strictEqual(isValidGasUrl(null), false, 'Rejects null');
  });

  console.log('\n--- GROUP 5: Cloud Verification & Zero-Bypass Logic ---');
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

  function createTestEnvironment(initialStorage = {}) {
    const storage = { ...initialStorage };
    const elements = {};

    const env = {
      localStorage: {
        getItem: (k) => (k in storage ? storage[k] : null),
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; }
      },
      document: {
        getElementById: (id) => elements[id] || null
      },
      elements,
      fetchCalls: [],
      mockFetch: async (url, opts) => {
        env.fetchCalls.push({ url, opts });
        const parsedUrl = new URL(url);
        const action = parsedUrl.searchParams.get('action');
        const key = parsedUrl.searchParams.get('key');

        if (action === 'check_auth') {
          if (key === 'secret-9999') {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                status: 'success',
                code: 200,
                authorized: true,
                targetDocId: '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s'
              })
            };
          } else {
            return {
              ok: true,
              status: 401,
              json: async () => ({
                status: 'unauthorized',
                code: 401,
                authorized: false,
                message: 'Invalid Owner Secret Key'
              })
            };
          }
        }
        return { ok: false, status: 404 };
      }
    };
    return env;
  }

  // Extract validateOwnerPin implementation
  const validateMatch = dropHtml.match(/async function validateOwnerPin\(candidatePin, candidateGasUrl = ''\) \{([\s\S]*?)\n    \}/);
  assert(validateMatch, 'validateOwnerPin function must be present');

  await runAsyncTest('validateOwnerPin rejects empty or whitespace-only PINs', async () => {
    const env = createTestEnvironment();
    const fn = new AsyncFunction('candidatePin', 'candidateGasUrl', 'customGasUrl', 'DEFAULT_GAS_URL', 'document', 'localStorage', 'fetch', 'isValidGasUrl', 'DEFAULT_DOC_ID', validateMatch[1]);
    const res = await fn('', '', '', '', env.document, env.localStorage, env.mockFetch, isValidGasUrl, '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s');
    assert.strictEqual(res.valid, false);
    assert(res.reason.includes('enter your Owner Secret PIN'));
  });

  await runAsyncTest('validateOwnerPin CANNOT be bypassed by spoofing localStorage', async () => {
    const env = createTestEnvironment({ qd_auth_key: 'hacked_key' });
    const fn = new AsyncFunction('candidatePin', 'candidateGasUrl', 'customGasUrl', 'DEFAULT_GAS_URL', 'document', 'localStorage', 'fetch', 'isValidGasUrl', 'DEFAULT_DOC_ID', validateMatch[1]);
    
    // Attacker submits 'hacked_key' without a valid GAS URL
    const resNoGas = await fn('hacked_key', '', '', '', env.document, env.localStorage, env.mockFetch, isValidGasUrl, '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s');
    assert.strictEqual(resNoGas.valid, false, 'Must reject when no valid GAS URL configured');

    // Attacker attempts to use rogue URL
    const resRogueGas = await fn('hacked_key', 'https://evil.com/macros/s/fake/exec', '', '', env.document, env.localStorage, env.mockFetch, isValidGasUrl, '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s');
    assert.strictEqual(resRogueGas.valid, false, 'Must reject when GAS URL is not on script.google.com');
  });

  await runAsyncTest('validateOwnerPin strictly verifies against Google Cloud endpoint', async () => {
    const env = createTestEnvironment();
    const fn = new AsyncFunction('candidatePin', 'candidateGasUrl', 'customGasUrl', 'DEFAULT_GAS_URL', 'document', 'localStorage', 'fetch', 'isValidGasUrl', 'DEFAULT_DOC_ID', validateMatch[1]);

    const validGas = 'https://script.google.com/macros/s/AKfycbxQuickDrop/exec';
    
    // Test incorrect PIN
    const failRes = await fn('wrong-pin', validGas, '', '', env.document, env.localStorage, env.mockFetch, isValidGasUrl, '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s');
    assert.strictEqual(failRes.valid, false);
    assert(failRes.reason.includes('Invalid Owner Secret') || failRes.reason.includes('Access denied'), `Expected denial message, got: ${failRes.reason}`);
    assert.strictEqual(env.fetchCalls.length, 1);
    assert(env.fetchCalls[0].url.includes('action=check_auth&key=wrong-pin'));

    // Test correct PIN
    const passRes = await fn('secret-9999', validGas, '', '', env.document, env.localStorage, env.mockFetch, isValidGasUrl, '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s');
    assert.strictEqual(passRes.valid, true);
    assert.strictEqual(passRes.pin, 'secret-9999');
    assert.strictEqual(passRes.targetDocId, '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s');
  });

  console.log('\n--- GROUP 6: Anti-Tampering & Permission Checks ---');
  runTest('Unauthorized callers are strictly blocked from saveCustomSettings', () => {
    assert(
      dropHtml.includes("if (!isOwnerMode) {\n        console.warn('Unauthorized attempt to modify QuickDrop settings blocked.');\n        showToast('🔒 Access Denied: Owner PIN authentication required.');\n        return false;\n      }"),
      'saveCustomSettings must reject unauthenticated calls'
    );
  });

  runTest('Unauthorized callers are strictly blocked from testGoogleDocSync', () => {
    assert(
      dropHtml.includes("if (!isOwnerMode) {\n        showToast('🔒 Access Denied: Owner PIN authentication required.');\n        return false;\n      }"),
      'testGoogleDocSync must reject unauthenticated calls'
    );
  });

  runTest('Unauthorized callers are strictly blocked from generatePrivateTopic', () => {
    assert(
      dropHtml.includes("function generatePrivateTopic() {\n      if (!isOwnerMode) {\n        showToast('🔒 Access Denied: Owner authentication required.');\n        return;\n      }"),
      'generatePrivateTopic must reject unauthenticated calls'
    );
  });

  runTest('Unauthorized callers are strictly blocked from copyOwnerBookmarkedLink', () => {
    assert(
      dropHtml.includes("if (!isOwnerMode) {\n        showToast('🔒 Access Denied: Owner authentication required.');\n        return;\n      }"),
      'copyOwnerBookmarkedLink must reject unauthenticated calls'
    );
  });

  runTest('Unauthorized callers are unconditionally blocked from toggleFeedPrivacyMode', () => {
    assert(
      dropHtml.includes("function toggleFeedPrivacyMode() {\n      if (!isOwnerMode) {\n        showToast('🔒 Access Denied: Owner PIN authentication required to modify feed privacy.');"),
      'toggleFeedPrivacyMode must unconditionally require isOwnerMode'
    );
  });

  console.log('\n--- GROUP 7: Lifecycle, Session Wipe & Hash Navigation ---');
  runTest('lockOwnerMode completely purges sensitive session data and wipes setup content', () => {
    assert(dropHtml.includes("localStorage.removeItem('qd_auth_key');"), 'Must purge qd_auth_key from localStorage');
    assert(dropHtml.includes("setupUnlocked.innerHTML = '';"), 'Must wipe setupUnlocked content');
    assert(dropHtml.includes("setupUnlocked.style.display = 'none';"), 'Must hide setupUnlocked');
    assert(dropHtml.includes("receiptDocLink.style.display = 'none';"), 'Must hide receipt doc link');
    assert(dropHtml.includes("receiptDocLink.setAttribute('href', '#');"), 'Must reset receipt doc link href');
    assert(dropHtml.includes("switchDropTab('compose');"), 'Must switch to compose');
  });

  runTest('Hash navigation includes dynamic window hashchange listener', () => {
    assert(dropHtml.includes("window.addEventListener('hashchange', () => {"), 'Must listen to hashchange');
    assert(dropHtml.includes("if (hash === '#setup') {\n        switchDropTab('setup');"), 'Must switch to setup on #setup');
  });

  runTest('switchDropTab updates browser history state without forcing jump', () => {
    assert(dropHtml.includes('if (history.replaceState) {'), 'Must use history.replaceState');
    assert(dropHtml.includes("tabName === 'compose'"), 'Must clear #hash on compose tab');
  });

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
