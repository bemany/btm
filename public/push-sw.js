// BTM Push-Notification Handler — wird via importScripts in den Workbox-SW eingebunden.
self.addEventListener('push', function (event) {
  if (!event.data) return;
  var data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'BTM', {
      body: data.body,
      icon: data.icon || '/app-icon-192.png',
      badge: data.badge || '/app-icon-192.png',
      data: data.data,
      tag: data.tag,
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          return client.navigate(url).then(function () { return client.focus(); });
        }
      }
      return clients.openWindow(url);
    })
  );
});
