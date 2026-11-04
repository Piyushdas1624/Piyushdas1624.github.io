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
 * 1. KEEP YOUR DOC "RESTRICTED":
 *    In Google Docs, keep "Share" settings set to "Restricted" (Only Piyush has access).
 *    Do NOT make it "Anyone with the link can view". It stays 100% private.
 * 
 * 2. EXECUTE AS "ME":
 *    When you deploy this Web App, set "Execute as: Me". This means Google Apps Script
 *    runs with your personal Google credentials on Google's secure cloud servers.
 *    It has internal permission to edit your private Google Doc without needing
 *    the doc to be public.
 * 
 * 3. IMMUNE TO AI CRAWLERS & SEARCH ENGINES:
 *    Because the Google Doc is Restricted, Google Search, GPTBot, ClaudeBot,
 *    and web scrapers CANNOT crawl, view, or index it.
 *    The Web App endpoint only accepts POST writes; it NEVER returns or exposes
 *    the document contents to the caller.
 * 
 * ----------------------------------------------------------------------------
 * 🚀 60-SECOND DEPLOYMENT INSTRUCTIONS:
 * ----------------------------------------------------------------------------
 * 1. Visit: https://script.google.com/home/start (or type script.new in browser)
 * 2. Click "+ New project".
 * 3. Give it a title, e.g.: "QuickDrop Google Doc Relay"
 * 4. Select all existing text in the editor (Code.gs) and REPLACE it with
 *    the entire contents of this file.
 * 5. Click the blue "Deploy" button (top-right) -> choose "New deployment".
 * 6. Click the gear icon (⚙️) next to "Select type" and select "Web app".
 * 7. Fill in the deployment configuration:
 *      - Description: "QuickDrop to Google Doc Relay"
 *      - Execute as: "Me (<your-email>@gmail.com)"  <-- IMPORTANT!
 *      - Who has access: "Anyone"                   <-- IMPORTANT! (Allows laptop without login)
 * 8. Click "Deploy".
 * 9. Click "Authorize access", choose your Google account, click "Advanced"
 *    -> "Go to QuickDrop Google Doc Relay (unsafe)" -> click "Allow".
 * 10. Copy the "Web app URL" (it looks like:
 *     https://script.google.com/macros/s/AKfycb.../exec).
 * 11. Open QuickDrop (drop.html), switch to the "Device Setup" tab, paste
 *     your Web App URL into the "Google Apps Script Web App URL" box, and
 *     click "Save Settings".
 * 12. Test by dropping a note! It will instantly chime on your phone via ntfy
 *     AND append permanently to your Google Doc!
 * ============================================================================
 */

// Target Document ID for QuickDrop permanent storage
const DEFAULT_DOC_ID = '1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s';

// Preferred display timezone (Indian Standard Time / Asia/Kolkata)
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * HTTP POST Handler — Appends the note to the Google Doc
 */
function doPost(e) {
  // Use ScriptLock to prevent concurrent write collisions from multiple simultaneous drops
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Wait up to 30s
  } catch (lockErr) {
    return createJsonResponse({
      status: 'error',
      message: 'Server busy: Could not acquire lock within 30 seconds.'
    }, 503);
  }

  try {
    var payload = {};

    // Parse incoming data: supports JSON payload, text/plain JSON, or URL-encoded form parameters
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        // If not pure JSON, treat raw contents as message
        payload = { message: e.postData.contents };
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    // Ping / healthcheck test action
    if (payload.action === 'ping' || payload.action === 'test_connection') {
      return createJsonResponse({
        status: 'success',
        message: 'QuickDrop Google Apps Script Relay is online and connected!',
        docId: DEFAULT_DOC_ID,
        timestamp: new Date().toISOString()
      });
    }

    var targetDocId = payload.docId || DEFAULT_DOC_ID;

    var noteData = {
      title: payload.title || 'QuickDrop Note',
      message: payload.message || '',
      sender: payload.sender || 'Unknown Device',
      category: (payload.category || 'note').toLowerCase(),
      url: payload.url || null,
      timestamp: payload.timestamp || null
    };

    // If message is completely empty, don't write blank entries
    if (!noteData.message && !noteData.url && (!noteData.title || noteData.title === 'QuickDrop Note')) {
      return createJsonResponse({
        status: 'error',
        message: 'Empty payload: No message or URL provided.'
      }, 400);
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
    }, 500);
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
        title: 'QuickDrop Test Ping',
        message: 'This is a test entry confirming your Google Apps Script relay is properly connected to your document.',
        sender: 'Browser GET Test',
        category: 'idea'
      });
      return createJsonResponse({
        status: 'success',
        message: 'Test entry written successfully!',
        docId: DEFAULT_DOC_ID,
        timestamp: testResult.formattedTime
      });
    } catch (err) {
      return createJsonResponse({
        status: 'error',
        message: err.toString()
      }, 500);
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

  // Determine timezone
  var tz = DEFAULT_TIMEZONE;
  try {
    tz = Session.getScriptTimeZone() || DEFAULT_TIMEZONE;
  } catch (tzErr) {}

  var now = new Date();
  var dateStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
  var formattedTime = dateStr + ' (' + tz + ')';

  // Category Icon & Badge
  var icon = '📝';
  var catUpper = (note.category || 'NOTE').toUpperCase();
  if (catUpper === 'IDEA') icon = '💡';
  else if (catUpper === 'LINK') icon = '🔗';
  else if (catUpper === 'CODE') icon = '💻';
  else if (catUpper === 'URGENT') icon = '🚨';
  else if (catUpper === 'RESPONSE' || catUpper === 'REPLY') icon = '💬';

  // 1. Horizontal separator line
  body.appendHorizontalRule();

  // 2. Header Paragraph (Title)
  var titleText = icon + ' [' + catUpper + '] ' + (note.title || 'Untitled Note');
  var titlePara = body.appendParagraph(titleText);
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  titlePara.setForegroundColor('#1a73e8'); // Google Blue accent
  titlePara.setSpacingBefore(8);
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
  if (note.url) {
    var linkPara = body.appendParagraph('🔗 Direct Link: ' + note.url);
    linkPara.setFontSize(9.5);
    linkPara.setLinkUrl(note.url);
    linkPara.setForegroundColor('#1a73e8');
    linkPara.setUnderline(true);
    linkPara.setSpacingAfter(6);
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
function createJsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Direct Test function — You can run this directly inside the Apps Script editor!
 * Click "Run" on testDirectAppend to verify your document permissions.
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
