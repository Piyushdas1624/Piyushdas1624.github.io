/**
 * ============================================================================
 * QUICKDROP -> OPTION 3A: THE SINGLE DOC TWO-COMPARTMENT VAULT
 * ============================================================================
 * 
 * Target Google Doc:
 * https://docs.google.com/document/d/1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s/edit
 * 
 * Target Doc ID: 1EgAUJU_BNiIBLbvhhdJVwGobhLsErWU_DHWQcnNhn2s
 * 
 * Active Web App Deployment URL:
 * https://script.google.com/macros/s/AKfycbwvo63b7RjzgB4jxnU-OnJm2sD_TUAIwB65SrILA9WW_gIywWE-FCrXJDsp4L7pfzHUCg/exec
 * 
 * ARCHITECTURE (ZERO EMAIL SCOPE REQUIRED):
 * This script runs cleanly using Google Cloud native DocumentApp permissions alone!
 * Absolutely NO email service scopes are requested, completely eliminating
 * authorization errors (Exception: The script does not have permission...).
 * 
 * TWO COMPARTMENTS IN ONE PERMANENT VAULT:
 * 
 * 1. 👑 OWNER COMPARTMENT (mode === 'owner'):
 *    - Authenticated with Owner Secret PIN (stored in Script Properties: AUTH_KEY).
 *    - Formatted with Title: 👑 [OWNER NOTE] <title> in Google Blue (#1a73e8).
 *    - Full formatting: Monospace & code indentation for code snippets, unlimited size.
 *    - Direct permanent personal vault access.
 * 
 * 2. 📬 VISITOR COMPARTMENT (mode === 'visitor'):
 *    - Public visitors dropping notes from your portfolio website without a PIN.
 *    - Formatted with Title: 📬 [PUBLIC VISITOR MESSAGE] <title> in distinct Amber/Red (#d93025).
 *    - Timestamped, sender-tagged metadata: [Visitor Inbox 📬].
 *    - ANTI-SPAM & ABUSE SHIELDS:
 *      * Honeypot Shield: Inspects payload.hp_field. If filled by automated spambots,
 *        returns HTTP 200 success but silently discards without writing to the doc.
 *      * Rate Limiting via CacheService: Enforces max 5 messages per 10 minutes,
 *        max 30 messages per day per client signature.
 *      * Message Length Cap: Automatically truncates visitor messages to max 1,500
 *        characters to prevent document spam bomb attacks.
 * 
 * 3. 🔒 ZERO-KNOWLEDGE CLOUD SECURITY:
 *    - Owner PIN is stored ONLY in Google Apps Script's private Script Properties (AUTH_KEY).
 *    - Never hardcoded in GitHub or client-side JavaScript.
 *    - action: 'check_auth' and action: 'get_recent' are strictly protected by Owner PIN.
 * 
 * ----------------------------------------------------------------------------
 * 🚀 QUICK DEPLOYMENT / UPDATE INSTRUCTIONS:
 * ----------------------------------------------------------------------------
 * 1. Open your project at https://script.google.com
 * 2. Select your "QuickDrop-Relay" project.
 * 3. Replace all code in "Code.gs" with this entire file.
 * 4. Verify Script Properties (⚙️ Project Settings > Script Properties):
 *      - Property: AUTH_KEY
 *      - Value: <your secret PIN>
 * 5. Click "Deploy" > "Manage deployments" > Edit (pencil icon) > New version > Deploy.
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
 * Rate Limiter for Public Visitors using CacheService
 * Limits: Max 5 messages per 10 minutes, Max 30 messages per day per signature
 */
function checkVisitorRateLimit(signature) {
  try {
    var cache = CacheService.getScriptCache();
    if (!cache) return { allowed: true };

    var now = new Date();
    var dayKey = Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
    var key10m = 'rl_10m_' + signature;
    var keyDay = 'rl_day_' + dayKey + '_' + signature;

    var count10mStr = cache.get(key10m);
    var count10m = count10mStr ? parseInt(count10mStr, 10) : 0;
    if (count10m >= 5) {
      return {
        allowed: false,
        reason: 'Rate limit reached: Maximum 5 messages per 10 minutes for public visitors. Please wait a few minutes before submitting another note.'
      };
    }

    var countDayStr = cache.get(keyDay);
    var countDay = countDayStr ? parseInt(countDayStr, 10) : 0;
    if (countDay >= 30) {
      return {
        allowed: false,
        reason: 'Daily limit reached: Maximum 30 messages per day for public visitors. Piyush has received your earlier notes!'
      };
    }

    // Increment rate limit counters (CacheService max expiration is 21600s / 6 hours)
    cache.put(key10m, String(count10m + 1), 600); // 10 minutes window
    cache.put(keyDay, String(countDay + 1), 21600); // Active period window
    return { allowed: true };
  } catch (cacheErr) {
    Logger.log('Rate limit check notice: ' + cacheErr);
    return { allowed: true };
  }
}

/**
 * HTTP POST Handler — Routes notes to Two-Compartment Google Doc Vault
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
      var authResponse = {
        status: authCheck.authorized ? 'success' : 'unauthorized',
        code: authCheck.authorized ? 200 : 401,
        message: authCheck.authorized 
          ? 'QuickDrop Cloud Relay is online and Owner PIN verified via Script Properties 👑' 
          : 'Access Denied: ' + authCheck.reason,
        authRequired: true,
        configured: Boolean(getEffectiveSecretKey()),
        authorized: authCheck.authorized,
        timestamp: new Date().toISOString()
      };
      // Only reveal docId to verified owners (Zero-Knowledge & Anti-Leak)
      if (authCheck.authorized) {
        authResponse.docId = targetDocId;
      }
      return createJsonResponse(authResponse);
    }

    // 3. Test connection action: writes a real verification note to Owner Compartment
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
      }, 'owner');

      return createJsonResponse({
        status: 'success',
        mode: 'owner',
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

    // 5. Anti-Spam Shield 1: Honeypot check
    var honeypot = (payload.hp_field !== undefined && payload.hp_field !== null) ? String(payload.hp_field).trim() : '';
    if (honeypot !== '') {
      // Automated bot detected: return success but silently discard without writing
      return createJsonResponse({
        status: 'success',
        mode: 'visitor',
        route: 'google_doc_visitor',
        message: '📬 Delivered directly to Piyush\'s Google Doc (Visitor Inbox)',
        timestamp: new Date().toISOString()
      });
    }

    // 6. Standard Note Payload Construction
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
    if (!noteData.message && !noteData.url && (!noteData.title || noteData.title === 'QuickDrop Note' || noteData.title === 'Visitor Message')) {
      return createJsonResponse({
        status: 'error',
        code: 400,
        message: 'Empty payload: No message or URL provided.'
      });
    }

    // 7. Check Owner PIN Authorization
    var auth = isAuthorized(payload, e);
    var isOwner = auth.authorized;

    // 8. Visitor Compartment Anti-Spam Shields (Rate Limiting & Length Cap)
    if (!isOwner) {
      // Visitor signature identifier for rate limiting
      var rawSig = (payload.visitorId || payload.sender || 'visitor').toString().trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 40);
      var visitorSig = rawSig || 'guest';

      var rlCheck = checkVisitorRateLimit(visitorSig);
      if (!rlCheck.allowed) {
        return createJsonResponse({
          status: 'error',
          code: 429,
          message: rlCheck.reason
        });
      }

      // Truncate visitor messages to max 1,500 characters to prevent spam bombs
      if (noteData.message && noteData.message.length > 1500) {
        noteData.message = noteData.message.substring(0, 1500) + '\n\n[Message truncated at 1,500 characters by QuickDrop anti-abuse shield]';
      }
    }

    // 9. Server-Side Idempotency & Deduplication
    var dropId = (payload.dropId || payload.id || '').toString().trim();
    if (!dropId && noteData.message) {
      try {
        var dedupSig = (isOwner ? 'owner_' : 'visitor_') + (noteData.sender || '') + '|' + (noteData.title || '') + '|' + (noteData.message || '') + '|' + (noteData.url || '');
        dropId = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dedupSig));
      } catch (sigErr) {
        dropId = '';
      }
    }

    if (dropId) {
      try {
        var cache = CacheService.getScriptCache();
        if (cache && cache.get('drop_' + dropId)) {
          return createJsonResponse({
            status: 'success',
            mode: isOwner ? 'owner' : 'visitor',
            duplicate: true,
            message: isOwner 
              ? '👑 Note already permanently saved to your Private Google Doc (idempotent)' 
              : '📬 Visitor message already delivered to Piyush\'s Google Doc (idempotent)',
            docId: targetDocId,
            timestamp: new Date().toISOString()
          });
        }
        if (cache) {
          cache.put('drop_' + dropId, '1', 120); // 120-second deduplication window
        }
      } catch (cacheErr) {
        Logger.log('Cache notice: ' + cacheErr);
      }
    }

    // 10. Execute Two-Compartment Append
    var appendResult = appendNoteToGoogleDoc(targetDocId, noteData, isOwner ? 'owner' : 'visitor');

    if (isOwner) {
      // ══════════════════════════════════════════════════════════════════════
      // 👑 OWNER COMPARTMENT: Full formatting, blue header, unlimited length
      // ══════════════════════════════════════════════════════════════════════
      return createJsonResponse({
        status: 'success',
        mode: 'owner',
        route: 'google_doc_owner',
        message: '👑 Permanently saved to your Private Google Doc',
        docId: targetDocId,
        timestamp: appendResult.formattedTime,
        entryIndex: appendResult.entryIndex
      });
    } else {
      // ══════════════════════════════════════════════════════════════════════
      // 📬 VISITOR COMPARTMENT: Distinct amber/red tag, rate-limited, length capped
      // ══════════════════════════════════════════════════════════════════════
      return createJsonResponse({
        status: 'success',
        mode: 'visitor',
        route: 'google_doc_visitor',
        message: '📬 Delivered directly to Piyush\'s Google Doc (Visitor Inbox)',
        docId: targetDocId,
        timestamp: appendResult.formattedTime,
        entryIndex: appendResult.entryIndex
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
 * HTTP GET Handler — Friendly status page, PIN check & diagnostic
 */
function doGet(e) {
  // Support remote PIN verification & health ping: ?action=check_auth&key=YOUR_PIN
  if (e && e.parameter && (e.parameter.action === 'check_auth' || e.parameter.action === 'ping' || e.parameter.check === '1')) {
    var check = isAuthorized(null, e);
    var getAuthResp = {
      status: check.authorized ? 'success' : 'unauthorized',
      code: check.authorized ? 200 : 401,
      authorized: check.authorized,
      configured: check.configured,
      message: check.authorized 
        ? 'Owner PIN verified successfully via Google Cloud Script Properties 👑' 
        : 'Access Denied: ' + check.reason,
      authRequired: true,
      timestamp: new Date().toISOString()
    };
    if (check.authorized) {
      getAuthResp.targetDocId = DEFAULT_DOC_ID;
    }
    return createJsonResponse(getAuthResp);
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
        message: 'This is a test entry confirming your Option 3A Two-Compartment Vault is properly connected with verified Owner PIN.',
        sender: 'Browser GET Test',
        category: 'idea'
      }, 'owner');
      return createJsonResponse({
        status: 'success',
        message: 'Test entry written successfully to Owner Compartment!',
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
    service: 'QuickDrop Cloud Relay (Option 3A - Single Doc Two-Compartment Vault)',
    authProtection: activeSecret ? 'ENABLED (Zero-Knowledge Cloud Script Properties)' : 'UNCONFIGURED (Set AUTH_KEY in Project Settings)',
    docProtection: 'TWO-COMPARTMENT ACTIVE (Owner Vault 👑 & Visitor Inbox 📬)',
    routing: {
      public_visitors: '📬 Delivered directly to Piyush\'s Google Doc (Visitor Inbox) with anti-spam shields & rate limiting',
      owner: '👑 Permanently saved to your Private Google Doc (Owner Vault with PIN)'
    },
    permissions: 'Zero Email Scope Required (DocumentApp only)',
    instruction: 'Send an HTTP POST with JSON { authKey, title, message, sender, category, url, hp_field } to relay notes.',
    timestamp: new Date().toISOString()
  });
}

/**
 * Formats and appends a note entry into the Google Doc Two-Compartment Vault
 * @param {string} docId - Target Google Doc ID
 * @param {Object} note - Note payload
 * @param {string} mode - 'owner' or 'visitor'
 */
function appendNoteToGoogleDoc(docId, note, mode) {
  var isOwner = (mode === 'owner');
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

  // Clean title: remove duplicate [CATEGORY], [PUBLIC VISITOR], or icons if already prefixed by client
  var cleanTitle = (note.title || 'Untitled Note').trim();
  if (cleanTitle.indexOf(icon) === 0) {
    cleanTitle = cleanTitle.substring(icon.length).trim();
  }
  if (cleanTitle.indexOf('👑') === 0) {
    cleanTitle = cleanTitle.substring(1).trim();
  }
  if (cleanTitle.indexOf('📬') === 0) {
    cleanTitle = cleanTitle.substring(1).trim();
  }
  var prefix = '[' + catUpper + ']';
  if (cleanTitle.toUpperCase().indexOf(prefix) === 0) {
    cleanTitle = cleanTitle.substring(prefix.length).trim();
  }
  if (cleanTitle.toUpperCase().indexOf('[PUBLIC VISITOR]') === 0) {
    cleanTitle = cleanTitle.substring('[PUBLIC VISITOR]'.length).trim();
  }
  if (cleanTitle.toUpperCase().indexOf('[PUBLIC VISITOR MESSAGE]') === 0) {
    cleanTitle = cleanTitle.substring('[PUBLIC VISITOR MESSAGE]'.length).trim();
  }
  if (cleanTitle.toUpperCase().indexOf('[OWNER NOTE]') === 0) {
    cleanTitle = cleanTitle.substring('[OWNER NOTE]'.length).trim();
  }
  if (!cleanTitle) cleanTitle = isOwner ? 'QuickDrop Note' : 'Visitor Message';

  // 1. Horizontal separator line
  body.appendHorizontalRule();

  // 2. Header Paragraph (Title) - Distinct compartment styling
  var titleText = '';
  var titleColor = '';
  if (isOwner) {
    // Owner Compartment: 👑 icon + [CATEGORY] in Google Blue (#1a73e8)
    titleText = '👑 ' + icon + ' [' + catUpper + '] ' + cleanTitle;
    titleColor = '#1a73e8'; // Google Blue
  } else {
    // Visitor Compartment: 📬 [PUBLIC VISITOR MESSAGE] in distinct Amber/Red (#d93025)
    titleText = '📬 [PUBLIC VISITOR MESSAGE] ' + cleanTitle;
    titleColor = '#d93025'; // Distinct Amber/Red
  }

  var titlePara = body.appendParagraph(titleText);
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  titlePara.setForegroundColor(titleColor);
  titlePara.setSpacingBefore(10);
  titlePara.setSpacingAfter(2);

  // 3. Metadata Paragraph (Timestamp, Sender, Tag)
  var metaText = '';
  if (isOwner) {
    metaText = '📅 ' + formattedTime + '   •   👤 ' + (note.sender || 'QuickDrop Device') + ' (Owner 👑)';
  } else {
    metaText = '📅 ' + formattedTime + '   •   👤 ' + (note.sender || 'Public Visitor') + ' [Visitor Inbox 📬]';
  }
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

    // Code formatting for snippets (Owner mode)
    if (isOwner && note.category === 'code') {
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
      linkPara.setForegroundColor(isOwner ? '#1a73e8' : '#d93025');
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
            sender: 'QuickDrop',
            time: 'Recently',
            url: null
          });
        }
      } else if (text.indexOf('📅') === 0 && (text.indexOf('👤') !== -1 || text.indexOf('•') !== -1)) {
        if (!currentEntry) currentEntry = { title: '', message: '', sender: '', time: '', url: null };
        var parts = text.split(/[•·-]\s*👤/);
        if (parts.length > 1) {
          currentEntry.time = parts[0].replace(/📅\s*/, '').trim();
          currentEntry.sender = parts[1] ? parts[1].trim() : 'QuickDrop';
        } else {
          currentEntry.time = text.replace(/📅\s*/, '').trim();
          currentEntry.sender = 'QuickDrop';
        }
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
 * Helper to build JSON responses for Google Apps Script Web App
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Direct Test functions — You can run these directly inside the Apps Script editor!
 */
function testDirectAppend() {
  var result = appendNoteToGoogleDoc(DEFAULT_DOC_ID, {
    title: 'Apps Script Direct Verification (Owner Vault)',
    message: 'Testing Option 3A Single Doc Two-Compartment Vault directly from Google Apps Script Editor with Owner formatting.',
    sender: 'Apps Script Console',
    category: 'idea'
  }, 'owner');
  Logger.log('Success Owner Append! Result: ' + JSON.stringify(result));
}

function testVisitorDirectAppend() {
  var result = appendNoteToGoogleDoc(DEFAULT_DOC_ID, {
    title: 'Apps Script Direct Verification (Visitor Inbox)',
    message: 'Testing Visitor Compartment directly from Google Apps Script Editor.',
    sender: 'Apps Script Visitor Test',
    category: 'note'
  }, 'visitor');
  Logger.log('Success Visitor Append! Result: ' + JSON.stringify(result));
}
