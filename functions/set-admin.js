const admin = require('firebase-admin');
try {
  if (!admin.apps.length) {
    process.env.FIREBASE_CONFIG = '{"projectId":"poker-room-2"}';
    admin.initializeApp({ projectId: 'poker-room-2' });
  }
  const auth = admin.auth();
  auth.getUserByEmail('al.83.r7o@gmail.com')
    .then(user => auth.setCustomUserClaims(user.uid, { admin: true }))
    .then(() => { console.log('SUCCESS: Admin claim set'); process.exit(0); })
    .catch(e => { console.error('Error:', e.message); process.exit(1); });
} catch (e) {
  console.error('Init error:', e.message);
  process.exit(1);
}
