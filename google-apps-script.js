/**
 * ============================================================================
 * QUICKDROP -> ZERO-EXTRA-APPS CLOUD RELAY (Google Apps Script)
 * ============================================================================
 * 
 * Target Google Doc:
 * https://docs.google.com/document/d/1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s/edit
 * 
 * Target Doc ID: 1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s
 * 
 * PURPOSE & ARCHITECTURE (ZERO EXTRA APPS):
 * No third-party apps (like ntfy) required! This script uses Google Cloud
 * native capabilities to handle both public visitors and private notes:
 * 
 * 1. 📬 PUBLIC VISITORS (NO PIN):
 *    - Casual visitors on your website drop notes, feedback, links, or ideas.
 *    - Google Apps Script immediately sends an email directly to your Gmail inbox
 *      (Session.getEffectiveUser().getEmail()) via MailApp.sendEmail().
 *    - Since Gmail is natively installed on all Android & iOS phones, your phone
 *      instantly chimes/vibrates with a native push alert!
 *    - Public visitors are STRICTLY BARRED from touching your Google Doc.
 *      Your private document stays 100% clean and reserved for your own notes.
 * 
 * 2. 👑 OWNER MODE (WITH SECRET PIN):
 *    - When YOU drop notes with your secret Owner PIN, the script appends them
 *      permanently into your private Google Doc (1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s).
 *    - It creates a searchable, chronological, permanent knowledge log.
 * 
 * 3. 🔒 ZERO-KNOWLEDGE CLOUD SECURITY (NO SECRETS IN GITHUB):
 *    - Your code is hosted in a public GitHub repository. Hardcoding any PIN
 *      in Git is dangerous because anyone browsing GitHub could see it.
 *    - In this script, the Secret PIN is NEVER hardcoded in the codebase!
 *    - The PIN is stored ONLY in Google Apps Script's private "Script Properties"
 *      (server-side environment variables in Google's cloud: AUTH_KEY or OWNER_PIN).
 *    - Script Properties are invisible to GitHub, search crawlers, and the public.
 *    - If no AUTH_KEY is set in Script Properties, the script fails closed and
 *      refuses to execute owner commands until configured.
 * 
 * 4. 📡 SECURE LIVE FEED (action: 'get_recent'):
 *    - The Live Feed and replies load authenticated history directly from your
 *      Google Doc backend when authorized with your Owner PIN.
 * 
 * ----------------------------------------------------------------------------
 * 🚀 60-SECOND DEPLOYMENT INSTRUCTIONS:
 * ----------------------------------------------------------------------------
 * 1. Open: https://script.google.com/home/start (or type script.new in browser)
 * 2. Click "+ New project".
 * 3. Name the project: "QuickDrop-Relay" (top left).
 * 4. Replace all code in "Code.gs" with this entire file.
 * 5. 🔒 SET YOUR SECRET PIN IN SCRIPT PROPERTIES (Zero Secrets in Git!):
 *      - Click the gear icon (⚙️ Project Settings) on the left sidebar.
 *      - Scroll down to "Script Properties".
 *      - Click "Add script property".
 *      - Property: AUTH_KEY (or OWNER_PIN)
 *      - Value: <choose your private PIN or password, e.g. a strong secret PIN>
 *      - (Optional): Add OWNER_EMAIL if you want visitor emails sent to a specific address.
 *      - Click "Save script properties".
 * 6. Click the blue "Deploy" button (top-right) -> choose "New deployment".
 * 7. Click the gear icon (⚙️) next to "Select type" and choose "Web app".
 * 8. Set the configuration:
 *      - Description: "QuickDrop Zero-Extra-Apps Relay with Cloud Script Properties"
 *      - Execute as: "Me (<your-email>@gmail.com)"  <-- REQUIRED!
 *      - Who has access: "Anyone"                   <-- REQUIRED!
 * 9. Click "Deploy" (Review permissions -> Advanced -> Go to QuickDrop-Relay (unsafe) -> Allow).
 * 10. Copy the "Web app URL" (ends in /exec).
 * 11. Open QuickDrop (drop.html), switch to the "Device Setup" tab:
 *      - Paste the /exec URL into the "Google Apps Script Web App URL" box.
 *      - Enter your Secret PIN in the "Owner Secret PIN" box.
 *      - Click "Save PIN & Settings".
 *      - Click "Test Google Doc Sync" to verify write access.
 * ============================================================================
 */

// Target Document ID for QuickDrop permanent storage
var DEFAULT_DOC_ID = '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s';

// Preferred display timezone (Indian Standard Time / Asia/Kolkata)
var DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * 🔒 ZERO-KNOWLEDGE SECRET KEY RETRIEVAL
 * ----------------------------------------------------------------------------
 * Retrieves the owner secret PIN strictly from Google Apps Script's Script Properties.
 * Zero hardcoded passwords in this codebase — safe for public GitHub repositories!
 */
function getEffectiveSecretKey() {
  try {
    var props = PropertiesService.getScriptProperties();
    var prop = props.getProperty('AUTH_KEY') || 
               props.getProperty('OWNER_PIN') || 
               props.getProperty('ACCESS_KEY') || 
               props.getProperty('OWNER_SECRET_KEY') || 
               props.getProperty('SECRET_KEY');
    if (prop && prop.trim()) {
      return prop.trim();
    }
  } catch (e) {
    Logger.log('Property read notice: ' + e);
  }
  return null; // Fails closed! No hardcoded fallback.
}

/**
 * Retrieves the destination email for public visitor notifications
 */
function getOwnerEmail() {
  try {
    var props = PropertiesService.getScriptProperties();
    var customEmail = props.getProperty('OWNER_EMAIL') || props.getProperty('NOTIFICATION_EMAIL');
    if (customEmail && customEmail.trim()) {
      return customEmail.trim();
    }
  } catch (e) {}

  try {
    var effectiveUser = Session.getEffectiveUser();
    if (effectiveUser && effectiveUser.getEmail()) {
      return effectiveUser.getEmail();
    }
  } catch (e) {}

  return 'piyushdas1624@gmail.com';
}

/**
 * Validates whether the incoming payload or query params contain the valid owner key
 */
function isAuthorized(payload, e) {
  var activeSecret = getEffectiveSecretKey();
  
  // If no secret is configured in Script Properties, fail closed for security
  if (!activeSecret) {
    return {
      authorized: false,
      configured: false,
      reason: 'No AUTH_KEY configured in Script Properties. Configure AUTH_KEY in Project Settings > Script Properties in script.google.com.'
    };
  }

  // Extract candidate key from JSON payload, form data, or URL query parameters
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
    return { authorized: true, configured: true };
  }

  return {
    authorized: false,
    configured: true,
    reason: providedKey ? 'Invalid Owner Secret Key' : 'Missing Owner Secret Key'
  };
}

/**
 * HTTP POST Handler — Receives drops, routes visitor notes to Gmail, and syncs owner notes to Google Doc
 */
function doPost(e) {
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

    // 2. Healthcheck ping & cloud auth check action (non-writing status check)
    if (payload.action === 'ping' || payload.action === 'check_auth') {
      var authCheck = isAuthorized(payload, e);
      return createJsonResponse({
        status: authCheck.authorized ? 'success' : 'unauthorized',
        code: authCheck.authorized ? 200 : 401,
        message: authCheck.authorized 
          ? 'QuickDrop Cloud Relay is online and Owner PIN verified via Script Properties 👑' 
          : 'Access Denied: ' + authCheck.reason,
        authRequired: true,
        configured: Boolean(getEffectiveSecretKey()),
        authorized: authCheck.authorized,
        docId: targetDocId,
        timestamp: new Date().toISOString()
      });
    }

    // 3. Test connection action: writes a real verification note to Google Doc (requires Owner PIN)
    if (payload.action === 'test_connection') {
      var testAuth = isAuthorized(payload, e);
      if (!testAuth.authorized) {
        return createJsonResponse({
          status: 'unauthorized',
          code: 401,
          message: 'Access Denied: ' + testAuth.reason + '. Testing Google Doc sync requires your Owner Secret PIN.'
        });
      }

      var testResult = appendNoteToGoogleDoc(targetDocId, {
        title: payload.title || 'QuickDrop Connection Verification',
        message: payload.message || 'QuickDrop successfully connected to your Google Doc with verified Owner PIN from Script Properties! Notes dropped from authorized browsers will be permanently preserved here.',
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

    // 4. Authenticated Live Feed Retrieval (action: 'get_recent')
    if (payload.action === 'get_recent') {
      var feedAuth = isAuthorized(payload, e);
      if (!feedAuth.authorized) {
        return createJsonResponse({
          status: 'unauthorized',
          code: 401,
          message: 'Access Denied: ' + feedAuth.reason + '. Owner Secret PIN required to view recent notes.'
        });
      }

      var limit = parseInt(payload.limit, 10) || 25;
      var recentNotes = getRecentNotesFromDoc(targetDocId, limit);
      return createJsonResponse({
        status: 'success',
        source: 'google_doc',
        docId: targetDocId,
        count: recentNotes.length,
        entries: recentNotes,
        timestamp: new Date().toISOString()
      });
    }

    // 5. Standard Note Payload
    var noteData = {
      title: payload.title || '',
      message: payload.message || '',
      sender: payload.sender || 'QuickDrop Visitor',
      category: (payload.category || 'note').toLowerCase(),
      url: payload.url || null,
      timezone: payload.timezone || null,
      timestamp: payload.timestamp || null
    };

    // If message is completely empty, don't process blank entries
    if (!noteData.message && !noteData.url && (!noteData.title || noteData.title === 'QuickDrop Note')) {
      return createJsonResponse({
        status: 'error',
        code: 400,
        message: 'Empty payload: No message or URL provided.'
      });
    }

    // 6. DUAL-PATH ROUTING LOGIC:
    // Check if sender provided valid Owner Secret PIN
    var auth = isAuthorized(payload, e);

    if (auth.authorized) {
      // ══════════════════════════════════════════════════════════════════════
      // 👑 OWNER PATH: Permanently append to private Google Doc
      // ══════════════════════════════════════════════════════════════════════
      var appendResult = appendNoteToGoogleDoc(targetDocId, noteData);
      return createJsonResponse({
        status: 'success',
        mode: 'owner',
        route: 'google_doc',
        message: 'Note permanently appended to Google Doc (Owner Verified 👑)',
        docId: targetDocId,
        timestamp: appendResult.formattedTime,
        entryIndex: appendResult.entryIndex
      });

    } else {
      // ══════════════════════════════════════════════════════════════════════
      // 📬 PUBLIC VISITOR PATH: Zero Extra Apps -> Email directly to Gmail
      // Google Doc is 100% barred and untouched!
      // Phone instantly chimes via native Gmail push notification!
      // ══════════════════════════════════════════════════════════════════════
      var emailResult = sendVisitorEmailNotification(noteData);
      return createJsonResponse({
        status: 'success',
        mode: 'visitor',
        route: 'email',
        message: 'Visitor note securely delivered to Piyush\'s phone via Gmail chime 🔔 (Google Doc protected & untouched)',
        recipient: emailResult.recipient,
        timestamp: emailResult.timestamp
      });
    }

  } catch (err) {
    return createJsonResponse({
      status: 'error',
      code: 500,
      message: 'Failed to process note: ' + err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * HTTP GET Handler — Friendly status page, PIN check & browser diagnostic
 */
function doGet(e) {
  // Support remote PIN verification & health ping: ?action=check_auth&key=YOUR_PIN or ?action=ping&key=...
  if (e && e.parameter && (e.parameter.action === 'check_auth' || e.parameter.action === 'ping' || e.parameter.check === '1')) {
    var check = isAuthorized(null, e);
    return createJsonResponse({
      status: check.authorized ? 'success' : 'unauthorized',
      code: check.authorized ? 200 : 401,
      authorized: check.authorized,
      configured: check.configured,
      message: check.authorized 
        ? 'Owner PIN verified successfully via Google Cloud Script Properties 👑' 
        : 'Access Denied: ' + check.reason,
      authRequired: true,
      targetDocId: DEFAULT_DOC_ID,
      timestamp: new Date().toISOString()
    });
  }

  // Support authenticated Live Feed retrieval via GET: ?action=get_recent&key=YOUR_PIN
  if (e && e.parameter && e.parameter.action === 'get_recent') {
    var feedAuth = isAuthorized(null, e);
    if (!feedAuth.authorized) {
      return createJsonResponse({
        status: 'unauthorized',
        code: 401,
        message: 'Access Denied: ' + feedAuth.reason + '. Owner Secret PIN required to view recent notes.'
      });
    }

    try {
      var limit = parseInt(e.parameter.limit, 10) || 25;
      var recentNotes = getRecentNotesFromDoc(DEFAULT_DOC_ID, limit);
      return createJsonResponse({
        status: 'success',
        source: 'google_doc',
        docId: DEFAULT_DOC_ID,
        count: recentNotes.length,
        entries: recentNotes,
        timestamp: new Date().toISOString()
      });
    } catch (readErr) {
      return createJsonResponse({
        status: 'error',
        code: 500,
        message: 'Failed to read Google Doc: ' + readErr.toString()
      });
    }
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
    service: 'QuickDrop Cloud Relay (Zero Extra Apps)',
    authProtection: activeSecret ? 'ENABLED (Zero-Knowledge Cloud Script Properties)' : 'UNCONFIGURED (Set AUTH_KEY in Project Settings)',
    targetDocId: DEFAULT_DOC_ID,
    routing: {
      public_visitors: 'Emails message straight to Piyush\'s Gmail inbox (native smartphone chime 🔔, Google Doc 100% protected)',
      owner: 'Appends note permanently into private Google Doc (requires secret PIN)'
    },
    instruction: 'Send an HTTP POST with JSON { authKey, title, message, sender, category, url } to relay notes.',
    timestamp: new Date().toISOString()
  });
}

/**
 * 📬 Sends native Gmail push notification when a public visitor drops a note
 * Keeps Google Doc 100% clean and chimes Piyush's phone instantly via Gmail app!
 */
function sendVisitorEmailNotification(note) {
  var recipient = getOwnerEmail();
  var tz = (note.timezone && typeof note.timezone === 'string') ? note.timezone : DEFAULT_TIMEZONE;
  var now = note.timestamp ? new Date(note.timestamp) : new Date();
  if (isNaN(now.getTime())) now = new Date();

  var dateStr = '';
  try {
    dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    dateStr = Utilities.formatDate(now, DEFAULT_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  var formattedTime = dateStr + ' (' + tz + ')';

  var catUpper = (note.category || 'NOTE').toUpperCase();
  var senderName = note.sender || 'Public Visitor';
  var subjectTitle = (note.title && note.title.trim()) ? note.title.trim() : (catUpper + ' from ' + senderName);
  var subject = '📬 [QuickDrop Visitor] ' + subjectTitle;

  var plainBody = 'You received a new visitor message via QuickDrop:\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '👤 Sender:   ' + senderName + '\n' +
    '🏷️ Category: ' + catUpper + '\n' +
    '📅 Time:     ' + formattedTime + '\n' +
    (note.url ? ('🔗 Link:     ' + note.url + '\n') : '') +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    'Message:\n' + note.message + '\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '🔒 Security Note: Emailed directly to your Gmail. Your private Google Doc remains 100% untouched.';

  var htmlBody = '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; color: #1a202c;">' +
    '<div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 18px;">' +
      '<h2 style="color: #4f46e5; margin: 0; font-size: 20px;">📬 QuickDrop Visitor Message</h2>' +
      '<span style="background: #eef2ff; color: #4338ca; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600;">VISITOR DROP</span>' +
    '</div>' +
    '<table style="width: 100%; font-size: 13.5px; margin-bottom: 18px; border-collapse: collapse;">' +
      '<tr><td style="padding: 6px 0; color: #64748b; width: 90px;"><strong>Sender:</strong></td><td style="padding: 6px 0; color: #0f172a; font-weight: 500;">' + escapeHtmlGas(senderName) + '</td></tr>' +
      '<tr><td style="padding: 6px 0; color: #64748b;"><strong>Category:</strong></td><td style="padding: 6px 0; color: #0f172a;"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600;">' + escapeHtmlGas(catUpper) + '</span></td></tr>' +
      '<tr><td style="padding: 6px 0; color: #64748b;"><strong>Time:</strong></td><td style="padding: 6px 0; color: #0f172a;">' + escapeHtmlGas(formattedTime) + '</td></tr>' +
      (note.url ? ('<tr><td style="padding: 6px 0; color: #64748b;"><strong>Link:</strong></td><td style="padding: 6px 0;"><a href="' + escapeHtmlGas(note.url) + '" style="color: #4f46e5; word-break: break-all;">' + escapeHtmlGas(note.url) + '</a></td></tr>') : '') +
    '</table>' +
    '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #6366f1; padding: 16px; border-radius: 6px; font-size: 14.5px; color: #0f172a; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">' +
      escapeHtmlGas(note.message || '(No message body)') +
    '</div>' +
    '<div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 11.5px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">' +
      '<span>🔒 Zero Extra Apps Relay • Gmail Push Notification</span>' +
      '<span>Google Doc Protected 🛡️</span>' +
    '</div>' +
  '</div>';

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody
  });

  return {
    recipient: recipient,
    timestamp: formattedTime
  };
}

/**
 * Formats and appends a note entry into the Google Doc
 */
function appendNoteToGoogleDoc(docId, note) {
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();

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
 * 📡 Extracts recent notes from the Google Doc for the authenticated Live Feed
 */
function getRecentNotesFromDoc(docId, limit) {
  limit = limit || 25;
  var doc = DocumentApp.openById(docId);
  var body = doc.getBody();
  var numChildren = body.getNumChildren();
  var entries = [];
  var currentEntry = null;

  // Scan document children backwards to retrieve latest entries first
  for (var i = numChildren - 1; i >= 0 && entries.length < limit; i--) {
    var child = body.getChild(i);
    var type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      var p = child.asParagraph();
      var heading = p.getHeading();
      var text = p.getText().trim();
      if (!text) continue;

      if (heading === DocumentApp.ParagraphHeading.HEADING2) {
        // Encountered entry title
        if (currentEntry) {
          currentEntry.title = text;
          entries.push(currentEntry);
          currentEntry = null;
        } else {
          entries.push({
            title: text,
            message: '',
            sender: 'QuickDrop Device',
            time: 'Recently',
            url: null
          });
        }
      } else if (text.indexOf('📅 ') === 0 && text.indexOf('•   👤') !== -1) {
        if (!currentEntry) currentEntry = { title: '', message: '', sender: '', time: '', url: null };
        var parts = text.split('•   👤');
        currentEntry.time = parts[0].replace('📅', '').trim();
        currentEntry.sender = parts[1] ? parts[1].trim() : 'QuickDrop Device';
      } else if (text.indexOf('🔗 Direct Link: ') === 0) {
        if (!currentEntry) currentEntry = { title: '', message: '', sender: '', time: '', url: null };
        currentEntry.url = text.replace('🔗 Direct Link: ', '').trim();
      } else {
        if (!currentEntry) currentEntry = { title: '', message: '', sender: '', time: '', url: null };
        currentEntry.message = currentEntry.message ? (text + '\n' + currentEntry.message) : text;
      }
    }
  }

  if (currentEntry && currentEntry.title) {
    entries.push(currentEntry);
  }

  return entries;
}

/**
 * Helper to escape HTML characters in email bodies
 */
function escapeHtmlGas(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
