const webpush = require('web-push');

function generateVapidKeys() {
  const keys = webpush.generateVAPIDKeys();

  console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
}

function configureWebPush({ subject, publicKey, privateKey }) {
  if (!publicKey || !privateKey) {
    throw new Error('VAPID ключи не указаны');
  }

  webpush.setVapidDetails(
    subject || 'mailto:example@example.com',
    publicKey,
    privateKey
  );
}

function sendNotification(subscription, payload) {
  return webpush.sendNotification(subscription, payload);
}

if (process.argv.includes('--gen')) {
  generateVapidKeys();
}

module.exports = {
  configureWebPush,
  sendNotification
};