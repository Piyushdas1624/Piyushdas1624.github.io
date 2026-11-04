/**
 * ============================================================================
 * QUICKDROP -> GOOGLE DOCS PERMANENT RELAY (Google Apps Script)
 * ============================================================================
 * 
 * Target Google Doc:
 * https://docs.google.com/document/d/1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s/edit
 * 
 * Target Doc ID: 1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s
 * 
 * PURPOSE:
 * ntfy.sh provides instant push notifications and phone chimes, but its free
 * cache automatically purges messages after 12 hours. This script turns your
 * private Google Doc into a permanent, searchable archive for every single
 * drop, link, code snippet, and idea you send from any laptop or browser.
 * 
 * ----------------------------------------------------------------------------
 * 🔒 SECURITY ARCHITECTURE: HOW YOUR GOOGLE DOC IS PROTECTED AGAINST ABUSE
 * ----------------------------------------------------------------------------
 * 1. GOOGLE DOC ACCESS IS 100% RESTRICTED:
 *    In Google Docs, your document is set to "Restricted" (Only Piyush has access).
 *    Google Search, Bing, and AI crawlers CANNOT see or index your document.
 * 
 * 2. SECRET ACCESS KEY / PIN AUTHORIZATION LAYER (CRITICAL):
 *    Deploying an Apps Script Web App with "Who has access: Anyone" is required
 *    so your browser can reach the endpoint without a Google login popup.
 *    HOWEVER, THIS SCRIPT ENFORCES AN OWNER ACCESS KEY (`OWNER_SECRET_KEY`):
 *      - Every write, ping, or test request MUST provide the secret key.
 *      - Any request from a public visitor, random bot, or malicious user
 *        WITHOUT the valid key is REJECTED IMMEDIATELY with HTTP 401 Unauthorized.
 *      - Unauthorized requests NEVER write to or touch your Google Doc!
 * 
 * 3. PUBLIC VISITOR MODE VS OWNER MODE:
 *    - Public visitors submitting messages on your website only trigger a push
 *      notification to your phone via ntfy (marked as [PUBLIC VISITOR]).
 *      They CANNOT write to your private Google Doc.
 *    - When YOU enter your Secret PIN in QuickDrop (or use your private bookmarked
 *      URL with ?key=YOUR_PIN), Owner Mode activates and syncs your notes
 *      directly to this document.
 * 
 * 4. STRICT WRITE-ONLY INTERFACE:
 *    This Web App is write-only. It never exposes, returns, or reads back the
 *    contents of your Google Doc to any caller on the web.
 * 
 * ----------------------------------------------------------------------------
 * 🚀 60-SECOND DEPLOYMENT INSTRUCTIONS:
 * ----------------------------------------------------------------------------
 * 1. Open: https://script.google.com/home/start (or type script.new in browser)
 * 2. Click "+ New project".
 * 3. Name the project: "QuickDrop-Relay" (top left).
 * 4. Replace all code in "Code.gs" with this entire file.
 * 5. (Important): Set your desired OWNER_SECRET_KEY below (line 88), e.g.:
 *      var OWNER_SECRET_KEY = 'piyush1624';
 * 6. Click the blue "Deploy" button (top-right) -> choose "New deployment".
 * 7. Click the gear icon (⚙️) next to "Select type" and choose "Web app".
 * 8. Set the configuration:
 *      - Description: "QuickDrop to Google Doc Relay v2 with Secret Auth"
 *      - Execute as: "Me (<your-email>@gmail.com)"  <-- REQUIRED!
 *      - Who has access: "Anyone"                   <-- REQUIRED!
 * 9. Click "Deploy".
 * 10. Copy the "Web app URL" (ends in /exec).
 * 11. Open QuickDrop (drop.html), switch to the "Device Setup" tab:
 *      - Paste the /exec URL into the "Google Apps Script Web App URL" box.
 *      - Enter your Secret PIN in the "Owner Secret PIN" box.
 *      - Click "Save Settings to this Browser".
 *      - Click "Test Google Doc Sync" to verify write access.
 * ============================================================================
 */

// Target Document ID for QuickDrop permanent storage
var DEFAULT_DOC_ID = '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s';

// Preferred display timezone (Indian Standard Time / Asia/Kolkata)
var DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * 🔒 OWNER SECRET AUTHORIZATION KEY
 * ----------------------------------------------------------------------------
 * Set your personal secret PIN or passphrase here.
 * Only requests containing this key can write to your Google Doc!
 * You can also set this via Script Properties under 'OWNER_SECRET_KEY'.
 */
var OWNER_SECRET_KEY = 'piyush1624';

/**
 * Retrieves the active secret key (checks Script Properties first: AUTH_KEY, ACCESS_KEY, OWNER_SECRET_KEY, then fallback)
 */
function getEffectiveSecretKey() {
  try {
    var props = PropertiesService.getScriptProperties();
    var prop = props.getProperty('AUTH_KEY') || 
               props.getProperty('ACCESS_KEY') || 
               props.getProperty('OWNER_SECRET_KEY') || 
               props.getProperty('SECRET_KEY');
    if (prop && prop.trim()) {
      return prop.trim();
    }
  } catch (e) {
    Logger.log('Property read notice: ' + e);
  }
  return OWNER_SECRET_KEY;
}

/**
 * Validates whether the incoming payload or query params contain the valid owner key
 */
function isAuthorized(payload, e) {
  var activeSecret = getEffectiveSecretKey();
  
  // If no secret is configured, allow writes (unprotected mode)
  if (!activeSecret || !activeSecret.trim()) {
    return { authorized: true };
  }

  // Extract key from JSON payload, form data, or URL query parameters
  var providedKey = '';
  if (payload) {
    providedKey = payload.authKey || payload.auth_key || payload.key || 
                  payload.pin || payload.token || payload.secret || 
                  payload.access_key || payload.accessKey || 
                  payload.ACCESS_KEY || payload.AUTH_KEY || '';
  }
  if (!providedKey && e && e.parameter) {
    providedKey = e.parameter.authKey || e.parameter.auth_key || e.parameter.key || 
                  e.parameter.pin || e.parameter.token || e.parameter.secret || 
                  e.parameter.access_key || e.parameter.accessKey || 
                  e.parameter.ACCESS_KEY || e.parameter.AUTH_KEY || '';
  }

  if (providedKey !== undefined && providedKey !== null) {
    providedKey = String(providedKey).trim();
  } else {
    providedKey = '';
  }

  if (providedKey && providedKey === activeSecret.trim()) {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: providedKey ? 'Invalid Owner Secret Key' : 'Missing Owner Secret Key'
  };
}

/**
 * HTTP POST Handler — Receives drops and appends them to the Google Doc
 */
function doPost(e) {
  // Use ScriptLock to prevent concurrent write collisions from simultaneous drops
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Wait up to 30s
  } catch (lockErr) {
    return createJsonResponse({
      status: 'error',
      code: 503,
      message: 'Server busy: Could not acquire lock within 30 seconds.'
    });
  }

  try {
    var payload = {};

    // 1. Flexible Payload Parsing: handles JSON body, form-urlencoded, or raw text
    if (e && e.parameter && Object.keys(e.parameter).length > 0 && (!e.postData || e.postData.type === 'application/x-www-form-urlencoded')) {
      payload = e.parameter;
    } else if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        if (e.parameter && Object.keys(e.parameter).length > 0) {
          payload = e.parameter;
        } else {
          payload = { message: e.postData.contents };
        }
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var targetDocId = (payload.docId && typeof payload.docId === 'string' && payload.docId.trim())
      ? payload.docId.trim()
      : DEFAULT_DOC_ID;

    // 2. Healthcheck ping & auth check action (non-writing status check)
    if (payload.action === 'ping' || payload.action === 'check_auth') {
      var authCheck = isAuthorized(payload, e);
      return createJsonResponse({
        status: authCheck.authorized ? 'success' : 'unauthorized',
        code: authCheck.authorized ? 200 : 401,
        message: authCheck.authorized 
          ? 'QuickDrop Permanent Relay is online and Owner PIN is verified!' 
          : 'Access Denied: ' + authCheck.reason,
        authRequired: Boolean(getEffectiveSecretKey()),
        authorized: authCheck.authorized,
        docId: targetDocId,
        timestamp: new Date().toISOString()
      });
    }

    // 3. SECURITY GATE: Require valid Owner Secret Key before performing ANY write
    var auth = isAuthorized(payload, e);
    if (!auth.authorized) {
      return createJsonResponse({
        status: 'unauthorized',
        code: 401,
        message: 'Access Denied: ' + auth.reason + '. Writes to Piyush\'s Google Doc require the Owner Secret PIN.',
        timestamp: new Date().toISOString()
      });
    }

    // 4. Test connection action: writes a real verification note
    if (payload.action === 'test_connection') {
      var testResult = appendNoteToGoogleDoc(targetDocId, {
        title: payload.title || 'QuickDrop Connection Verification',
        message: payload.message || 'QuickDrop successfully connected to your Google Doc with verified Owner PIN! Notes dropped from authorized browsers will be permanently preserved here.',
        sender: payload.sender || 'QuickDrop Verification Test',
        category: payload.category || 'idea',
        timezone: payload.timezone
      });
      return createJsonResponse({
        status: 'success',
        message: 'Test entry successfully appended to Google Doc!',
        docId: targetDocId,
        timestamp: testResult.formattedTime,
        entryIndex: testResult.entryIndex
      });
    }

    // 5. Standard Note Payload
    var noteData = {
      title: payload.title || 'QuickDrop Note',
      message: payload.message || '',
      sender: payload.sender || 'QuickDrop Device',
      category: (payload.category || 'note').toLowerCase(),
      url: payload.url || null,
      timezone: payload.timezone || null,
      timestamp: payload.timestamp || null
    };

    // If message is completely empty, don't write blank entries
    if (!noteData.message && !noteData.url && (!noteData.title || noteData.title === 'QuickDrop Note')) {
      return createJsonResponse({
        status: 'error',
        code: 400,
        message: 'Empty payload: No message or URL provided.'
      });
    }

    // Append entry to Google Doc
    var appendResult = appendNoteToGoogleDoc(targetDocId, noteData);

    return createJsonResponse({
      status: 'success',
      message: 'Note permanently appended to Google Doc',
      docId: targetDocId,
      timestamp: appendResult.formattedTime,
      entryIndex: appendResult.entryIndex
    });

  } catch (err) {
    return createJsonResponse({
      status: 'error',
      code: 500,
      message: 'Failed to append note: ' + err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * HTTP GET Handler — Friendly status page & browser diagnostic
 */
function doGet(e) {
  // Support remote PIN verification & health ping: ?action=check_auth&key=YOUR_PIN or ?action=ping&key=...
  if (e && e.parameter && (e.parameter.action === 'check_auth' || e.parameter.action === 'ping' || e.parameter.check === '1')) {
    var check = isAuthorized(null, e);
    return createJsonResponse({
      status: check.authorized ? 'success' : 'unauthorized',
      code: check.authorized ? 200 : 401,
      authorized: check.authorized,
      message: check.authorized ? 'Owner PIN verified successfully' : 'Access Denied: ' + check.reason,
      authRequired: Boolean(getEffectiveSecretKey()),
      targetDocId: DEFAULT_DOC_ID,
      timestamp: new Date().toISOString()
    });
  }

  // Support quick test via browser: ?test=1&key=YOUR_PIN
  if (e && e.parameter && e.parameter.test === '1') {
    var auth = isAuthorized(null, e);
    if (!auth.authorized) {
      return createJsonResponse({
        status: 'unauthorized',
        code: 401,
        message: 'Access Denied: ' + auth.reason + '. Provide ?key=YOUR_PIN to run test write.',
        timestamp: new Date().toISOString()
      });
    }

    try {
      var testResult = appendNoteToGoogleDoc(DEFAULT_DOC_ID, {
        title: 'QuickDrop Browser Test Ping',
        message: 'This is a test entry confirming your Google Apps Script relay is properly connected with verified Owner PIN.',
        sender: 'Browser GET Test',
        category: 'idea'
      });
      return createJsonResponse({
        status: 'success',
        message: 'Test entry written successfully to Google Doc!',
        docId: DEFAULT_DOC_ID,
        timestamp: testResult.formattedTime
      });
    } catch (err) {
      return createJsonResponse({
        status: 'error',
        code: 500,
        message: err.toString()
      });
    }
  }

  var activeSecret = getEffectiveSecretKey();
  return createJsonResponse({
    status: 'online',
    service: 'QuickDrop Google Doc Permanent Relay',
    targetDocId: DEFAULT_DOC_ID,
    authProtection: activeSecret ? 'ENABLED (Owner Secret PIN required)' : 'DISABLED (Open relay)',
    instruction: 'Send an HTTP POST with JSON { authKey, title, message, sender, category, url } to append to your Google Doc.',
    timestamp: new Date().toISOString()
  });
}

/**
 * Formats and appends a note entry into the Google Doc
 */
function appendNoteToGoogleDoc(docId, note) {
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();

  // Determine timezone (preferred: DEFAULT_TIMEZONE 'Asia/Kolkata')
  var tz = DEFAULT_TIMEZONE;
  if (note.timezone && typeof note.timezone === 'string') {
    tz = note.timezone;
  }

  var now = note.timestamp ? new Date(note.timestamp) : new Date();
  if (isNaN(now.getTime())) now = new Date();

  var dateStr = '';
  try {
    dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
  } catch (fmtErr) {
    try {
      dateStr = Utilities.formatDate(now, DEFAULT_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
      tz = DEFAULT_TIMEZONE;
    } catch (defErr) {
      dateStr = Utilities.formatDate(now, 'UTC', 'yyyy-MM-dd HH:mm:ss');
      tz = 'UTC';
    }
  }
  var formattedTime = dateStr + ' (' + tz + ')';

  // Category Icon & Badge
  var icon = '📝';
  var catUpper = (note.category || 'NOTE').toUpperCase();
  if (catUpper === 'IDEA') icon = '💡';
  else if (catUpper === 'LINK') icon = '🔗';
  else if (catUpper === 'CODE') icon = '💻';
  else if (catUpper === 'URGENT') icon = '🚨';
  else if (catUpper === 'RESPONSE' || catUpper === 'REPLY') icon = '💬';

  // Clean title: remove duplicate [CATEGORY] or icon if already prefixed by client
  var cleanTitle = (note.title || 'Untitled Note').trim();
  if (cleanTitle.indexOf(icon) === 0) {
    cleanTitle = cleanTitle.substring(icon.length).trim();
  }
  var prefix = '[' + catUpper + ']';
  if (cleanTitle.toUpperCase().indexOf(prefix) === 0) {
    cleanTitle = cleanTitle.substring(prefix.length).trim();
  }
  if (!cleanTitle) cleanTitle = 'QuickDrop Note';

  // 1. Horizontal separator line
  body.appendHorizontalRule();

  // 2. Header Paragraph (Title)
  var titleText = icon + ' [' + catUpper + '] ' + cleanTitle;
  var titlePara = body.appendParagraph(titleText);
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  titlePara.setForegroundColor('#1a73e8'); // Google Blue accent
  titlePara.setSpacingBefore(10);
  titlePara.setSpacingAfter(2);

  // 3. Metadata Paragraph (Timestamp, Sender, Category)
  var metaText = '📅 ' + formattedTime + '   •   👤 ' + (note.sender || 'QuickDrop Device');
  var metaPara = body.appendParagraph(metaText);
  metaPara.setFontSize(9);
  metaPara.setForegroundColor('#5f6368'); // Neutral grey
  metaPara.setItalic(true);
  metaPara.setSpacingAfter(6);

  // 4. Message Content
  var msgContent = note.message || '';
  if (msgContent) {
    var bodyPara = body.appendParagraph(msgContent);
    bodyPara.setFontSize(10.5);
    bodyPara.setForegroundColor('#202124'); // High-contrast text
    bodyPara.setSpacingAfter(4);

    // Code formatting for snippets
    if (note.category === 'code') {
      bodyPara.setFontFamily('Consolas');
      bodyPara.setIndentStart(18);
      bodyPara.setIndentEnd(18);
    } else {
      bodyPara.setFontFamily('Arial');
    }
  }

  // 5. Dedicated Link section if URL exists
  if (note.url && typeof note.url === 'string') {
    var cleanUrl = note.url.trim();
    if (/^https?:\/\//i.test(cleanUrl)) {
      var linkPara = body.appendParagraph('🔗 Direct Link: ' + cleanUrl);
      linkPara.setFontSize(9.5);
      linkPara.setForegroundColor('#1a73e8');
      linkPara.setUnderline(true);
      linkPara.setSpacingAfter(6);
      try {
        linkPara.setLinkUrl(cleanUrl);
      } catch (linkErr) {
        Logger.log('Warning setting link URL: ' + linkErr);
      }
    }
  }

  // Save changes to DocumentApp
  doc.saveAndClose();

  return {
    formattedTime: formattedTime,
    entryIndex: body.getNumChildren()
  };
}

/**
 * Helper to build JSON responses for Google Apps Script Web App
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Direct Test function — You can run this directly inside the Apps Script editor!
 * Select "testDirectAppend" in the toolbar dropdown and click "Run".
 */
function testDirectAppend() {
  var result = appendNoteToGoogleDoc(DEFAULT_DOC_ID, {
    title: 'Apps Script Direct Verification',
    message: 'Testing connection directly from Google Apps Script Editor with Owner PIN. Your QuickDrop Google Doc relay is operational and secure!',
    sender: 'Apps Script Console',
    category: 'idea'
  });
  Logger.log('Success! Result: ' + JSON.stringify(result));
}
