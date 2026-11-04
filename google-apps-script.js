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
 * ntfy.sh provides instant push notifications and phone chime, but its free
 * cache automatically purges messages after 12 hours. This script turns your
 * private Google Doc into a permanent, searchable archive for every single
 * drop, link, code snippet, and idea you send from any laptop or browser.
 * 
 * ----------------------------------------------------------------------------
 * 🔒 SECURITY & PRIVACY: WHY YOUR GOOGLE DOC REMAINS 100% PRIVATE
 * ----------------------------------------------------------------------------
 * 1. KEEP YOUR DOC "RESTRICTED" (IMPORTANT):
 *    In Google Docs, click the blue "Share" button. Under "General access",
 *    ensure it is set to "Restricted" (Only Piyush has access).
 *    ⚠️ Do NOT set it to "Anyone with the link can view". It must stay private!
 * 
 * 2. WHY RESTRICTED ACCESS WORKS WITH WEB APPS:
 *    When you deploy this Apps Script Web App, you choose:
 *      "Execute as: Me (your Google account)"
 *    This means Google's cloud executes the script under YOUR identity. It has
 *    native owner permissions to write to your private document without
 *    needing the document to be public or accessible to anyone else.
 * 
 * 3. 100% IMMUNE TO AI CRAWLERS & PUBLIC SEARCH ENGINES:
 *    Because the Google Doc is Restricted:
 *      - Google Search, Bing, and DuckDuckGo CANNOT index it.
 *      - AI scrapers (GPTBot, ClaudeBot, Perplexity, Bytespider) CANNOT crawl it.
 *      - Public users visiting the doc URL get an HTTP 403 / Google Login wall.
 *    Furthermore, this Web App endpoint is strictly WRITE-ONLY; it never
 *    returns or exposes the contents of your document to the web.
 * 
 * ----------------------------------------------------------------------------
 * 🚀 60-SECOND DEPLOYMENT INSTRUCTIONS:
 * ----------------------------------------------------------------------------
 * 1. Open: https://script.google.com/home/start (or type script.new in browser)
 * 2. Click "+ New project".
 * 3. Name the project: "QuickDrop-Relay" (top left).
 * 4. Select all existing text in "Code.gs" and REPLACE it with the contents
 *    of this entire file.
 * 5. (Optional quick test): In the function dropdown, select "testDirectAppend"
 *    and click "Run". Click "Review permissions", pick your Google account,
 *    click "Advanced" -> "Go to QuickDrop-Relay (unsafe)" -> click "Allow".
 *    Open your Google Doc — you will see the test note appear immediately!
 * 6. Click the blue "Deploy" button (top-right) -> choose "New deployment".
 * 7. Click the gear icon (⚙️) next to "Select type" and choose "Web app".
 * 8. Set the configuration:
 *      - Description: "QuickDrop to Google Doc Relay v1"
 *      - Execute as: "Me (<your-email>@gmail.com)"  <-- REQUIRED!
 *      - Who has access: "Anyone"                   <-- REQUIRED!
 * 9. Click "Deploy".
 * 10. Copy the "Web app URL" (ends in /exec, e.g.:
 *      https://script.google.com/macros/s/AKfycb.../exec).
 * 11. Open QuickDrop (drop.html), switch to the "Device Setup" tab, paste
 *      your Web App URL into the "Google Apps Script Web App URL" box, and
 *      click "Save Google Doc URL" (or click "Test Google Doc Sync").
 * 12. Every note you send from QuickDrop will now instantly buzz your phone
 *      via ntfy AND permanently append to your Google Doc!
 * 
 * ----------------------------------------------------------------------------
 * 🧪 TERMINAL VERIFICATION EXAMPLES (OPTIONAL):
 * ----------------------------------------------------------------------------
 * # Quick GET status ping:
 * curl -L "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
 * 
 * # Direct append via curl:
 * curl -L -X POST "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" \
 *   -H "Content-Type: text/plain;charset=utf-8" \
 *   -d '{"title":"Terminal Note","message":"Sent directly via curl!","category":"code"}'
 * ============================================================================
 */

// Target Document ID for QuickDrop permanent storage
var DEFAULT_DOC_ID = '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s';

// Preferred display timezone (Indian Standard Time / Asia/Kolkata)
var DEFAULT_TIMEZONE = 'Asia/Kolkata';

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

    // 2. Healthcheck ping action (does not write to document)
    if (payload.action === 'ping') {
      return createJsonResponse({
        status: 'success',
        message: 'QuickDrop Google Apps Script Relay is online and connected!',
        docId: targetDocId,
        timestamp: new Date().toISOString()
      });
    }

    // 3. Test connection action: writes a real verification note to verify write permissions
    if (payload.action === 'test_connection') {
      var testResult = appendNoteToGoogleDoc(targetDocId, {
        title: payload.title || 'QuickDrop Connection Verification',
        message: payload.message || 'QuickDrop successfully connected to your Google Doc! Notes dropped from any browser will now be permanently preserved here.',
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

    // 4. Standard Note Payload
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
  // Support quick test via browser: ?test=1
  if (e && e.parameter && e.parameter.test === '1') {
    try {
      var testResult = appendNoteToGoogleDoc(DEFAULT_DOC_ID, {
        title: 'QuickDrop Browser Test Ping',
        message: 'This is a test entry confirming your Google Apps Script relay is properly connected to your document.',
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
        message: err.toString()
      });
    }
  }

  return createJsonResponse({
    status: 'online',
    service: 'QuickDrop Google Doc Permanent Relay',
    targetDocId: DEFAULT_DOC_ID,
    instruction: 'Send an HTTP POST with JSON { title, message, sender, category, url } to append to your Google Doc.',
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
    message: 'Testing connection directly from Google Apps Script Editor. Your QuickDrop Google Doc relay is operational!',
    sender: 'Apps Script Console',
    category: 'idea'
  });
  Logger.log('Success! Result: ' + JSON.stringify(result));
}
