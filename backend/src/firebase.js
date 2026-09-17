const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');

/**
 * Initialize Firebase Admin SDK
 */
function initFirebase() {
  if (getApps().length === 0) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath) {
      const absolutePath = path.isAbsolute(serviceAccountPath) 
        ? serviceAccountPath 
        : path.join(__dirname, '..', serviceAccountPath);
        
      const serviceAccount = require(absolutePath);
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('[Firebase] Initialized with Service Account Key file:', absolutePath);
    } else {
      initializeApp();
      console.log('[Firebase] Initialized default app.');
    }
  }
}

module.exports = { initFirebase, getMessaging };
