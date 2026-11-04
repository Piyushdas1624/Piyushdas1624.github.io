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

  console.log('\n--- GROUP 8: Option 3A Client Wiring & Two-Compartment UI ---');
  runTest('DEFAULT_GAS_URL is permanently wired to active Web App URL', () => {
    const expectedGasUrl = 'https://script.google.com/macros/s/AKfycbwvo63b7RjzgB4jxnU-OnJm2sD_TUAIwB65SrILA9WW_gIywWE-FCrXJDsp4L7pfzHUCg/exec';
    assert(
      dropHtml.includes(`const DEFAULT_GAS_URL = '${expectedGasUrl}';`),
      'drop.html must wire DEFAULT_GAS_URL to the exact active Web App URL'
    );
    assert.strictEqual(
      isValidGasUrl(expectedGasUrl),
      true,
      'Active Web App URL must pass isValidGasUrl validation'
    );
  });

  runTest('Invisible anti-spam honeypot input is embedded inside drop-form', () => {
    assert(
      dropHtml.includes('<input type="text" name="hp_field" id="hp-field" style="display:none !important; position:absolute; left:-9999px;" tabindex="-1" autocomplete="off" />'),
      'drop.html must contain the invisible honeypot field hp_field'
    );
    assert(
      dropHtml.includes("hp_field: hpField"),
      'handleDropSubmit must forward hp_field in gasPayload'
    );
  });

  runTest('UI messaging accurately displays Option 3A Visitor and Owner delivery targets', () => {
    assert(
      dropHtml.includes("📬 Delivered directly to Piyush's Google Doc (Visitor Inbox)"),
      'Must contain visitor delivery messaging'
    );
    assert(
      dropHtml.includes("👑 Permanently saved to your Private Google Doc"),
      'Must contain owner vault messaging'
    );
  });

  console.log('\n--- GROUP 9: Option 3A Google Apps Script Backend & Shields ---');
  const gasScript = fs.readFileSync(path.join(repoDir, 'google-apps-script.js'), 'utf8');

  runTest('google-apps-script.js requests ZERO email scopes (no MailApp or GmailApp calls)', () => {
    assert(!gasScript.includes('MailApp.sendEmail'), 'Must not call MailApp.sendEmail');
    assert(!gasScript.includes('GmailApp.sendEmail'), 'Must not call GmailApp.sendEmail');
    assert(!gasScript.includes('MailApp.'), 'Must contain zero MailApp invocations');
    assert(!gasScript.includes('GmailApp.'), 'Must contain zero GmailApp invocations');
  });

  runTest('google-apps-script.js implements honeypot bot trap', () => {
    assert(gasScript.includes('payload.hp_field'), 'Must inspect payload.hp_field');
    assert(gasScript.includes("honeypot !== ''"), 'Must detect non-empty honeypot field');
  });

  runTest('google-apps-script.js enforces rate limiting via CacheService', () => {
    assert(gasScript.includes('function checkVisitorRateLimit('), 'Must define checkVisitorRateLimit');
    assert(gasScript.includes('CacheService.getScriptCache()'), 'Must use CacheService');
    assert(gasScript.includes('count10m >= 5'), 'Must enforce max 5 per 10 minutes');
    assert(gasScript.includes('countDay >= 30'), 'Must enforce max 30 per day');
  });

  runTest('google-apps-script.js truncates visitor messages to max 1,500 characters', () => {
    assert(
      gasScript.includes('noteData.message.length > 1500'),
      'Must check for messages exceeding 1500 chars'
    );
    assert(
      gasScript.includes('noteData.message.substring(0, 1500)'),
      'Must truncate visitor message at 1500 chars'
    );
  });

  runTest('google-apps-script.js formats Owner (#1a73e8) and Visitor (#d93025) compartments distinctly', () => {
    assert(
      gasScript.includes("titleText = '👑 ' + icon + ' [' + catUpper + '] ' + cleanTitle;"),
      'Must format owner title with crown and category'
    );
    assert(
      gasScript.includes("titleColor = '#1a73e8';"),
      'Must style owner title in Google Blue (#1a73e8)'
    );
    assert(
      gasScript.includes("titleText = '📬 [PUBLIC VISITOR MESSAGE] ' + cleanTitle;"),
      'Must format visitor title with visitor tag'
    );
    assert(
      gasScript.includes("titleColor = '#d93025';"),
      'Must style visitor title in distinct amber/red (#d93025)'
    );
  });

  runTest('google-apps-script.js strictly protects check_auth and get_recent endpoints', () => {
    assert(
      gasScript.includes("if (payload.action === 'ping' || payload.action === 'check_auth')"),
      'Must protect check_auth'
    );
    assert(
      gasScript.includes("if (payload.action === 'get_recent')"),
      'Must protect get_recent'
    );
  });

  console.log('\n--- GROUP 10: Option 3A Robustness & Abuse Prevention ---');
  runTest('drop.html and send.html eliminate all stale email reply notifications', () => {
    assert(!dropHtml.includes('Reply emailed directly to Piyush'), 'drop.html must not say reply emailed');
    assert(!sendHtml.includes('Reply emailed directly to Piyush'), 'send.html must not say reply emailed');
  });

  runTest('drop.html halts submission on rate limit or error without wiping form', () => {
    assert(
      dropHtml.includes("showToast('⚠️ ' + (data.message || 'Rate limit reached: Maximum 5 messages per 10 minutes. Please wait before submitting again.'), 6000);"),
      'Must display informative rate limit message'
    );
    const rateLimitIndex = dropHtml.indexOf("data.code === 429");
    const returnIndex = dropHtml.indexOf("return;", rateLimitIndex);
    assert(returnIndex !== -1 && returnIndex - rateLimitIndex < 300, 'Must return early on 429 without continuing execution');
  });

  runTest('google-apps-script.js checks idempotency BEFORE incrementing visitor rate limit', () => {
    const dedupPos = gasScript.indexOf('Server-Side Idempotency & Deduplication');
    const rateLimitPos = gasScript.indexOf('var rlCheck = checkVisitorRateLimit(');
    assert(dedupPos !== -1, 'Must contain idempotency check');
    assert(rateLimitPos !== -1, 'Must contain rate limit check invocation');
    assert(dedupPos < rateLimitPos, 'Idempotency check must execute before checkVisitorRateLimit invocation');
  });

  runTest('google-apps-script.js caps visitor title, sender, url, and message lengths', () => {
    assert(gasScript.includes('noteData.message.length > 1500'), 'Must cap message to 1500 chars');
    assert(gasScript.includes('noteData.title.length > 200'), 'Must cap title to 200 chars');
    assert(gasScript.includes('noteData.sender.length > 100'), 'Must cap sender to 100 chars');
    assert(gasScript.includes('noteData.url.length > 1000'), 'Must cap url to 1000 chars');
  });

  runTest('google-apps-script.js guards Lock release with hasLock() check', () => {
    assert(gasScript.includes('lock.hasLock()'), 'Must check lock.hasLock() before releaseLock()');
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
