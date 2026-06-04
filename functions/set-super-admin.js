const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const email = 'al.83.r7o@gmail.com';

admin.auth().getUserByEmail(email)
  .then((user) => {
    return admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
      superAdmin: true,
    }).then(() => user);
  })
  .then((user) => {
    console.log(`Super Admin asignado correctamente:`);
    console.log(`  Email: ${email}`);
    console.log(`  UID:   ${user.uid}`);
    console.log(`  Claims: admin: true, superAdmin: true`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error al asignar Super Admin:', err.message);
    process.exit(1);
  });
