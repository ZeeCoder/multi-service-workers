// @todo Message support (request / response style too)
// @todo Alert the user of newly (successfully) installed app version

// Current cache version. Increase it to force clear client cache.
// Note: Adding new assets does not require clearing old caches
const version = "v11";
// Trusted app assets
const appAssets = ["./", "./index.html", "./app.js"];
// Potentially CORS assets
const corsAssets = [
  "https://keyassets.timeincuk.net/inspirewp/live/wp-content/uploads/sites/12/2016/01/16578.jpg",
  "http://www.posterparty.com/images/tv-game-of-thrones-tyrion-lannister-S3-portrait-poster-PYRpas0430.jpg"
];

// Note: If the promise given to waituntil fails, then installation will be
// attempted again the next time the page is refreshed / revisited
this.addEventListener("install", function(event) {
  console.log("[Install] Caching assets");

  event.waitUntil(cacheAssets());
});

this.addEventListener("activate", function(event) {
  console.log("[Activate] Deleting previous caches");

  event.waitUntil(deleteOldCaches());
});

this.addEventListener("fetch", function(event) {
  console.log("[Fetch] Intercepting request:" + event.request.url);
  event.respondWith(interceptRequest(event.request));

  // Could serve a fallback response if getting the real one fails:
  // .catch(function() {
  //   return caches.match('/sw-test/gallery/myLittleVader.jpg');
  // })
});

/**
 * Intercepts the given request, and serves it from cache.
 * If it's not found in cache, then it will try to fetch it first, then serves
 * that instead, while also caching it for future use.
 * @param {Request} request
 * @return {Promise}
 */
const interceptRequest = request =>
  caches.match(request).then(
    cachedResponse =>
      cachedResponse ||
      fetchUniversal(request).then(response => {
        caches.open(version).then(cache => cache.put(request, response));

        // If we didn't return a clone here, then by the time the response
        // start saving (streaming) to cache, it would have been read by the
        // browser, and therefore wouldn't be available anymore, resulting in
        // an error.
        return response.clone();
      })
  );

/**
 * Caches all assets.
 * Tries regular fetch first, and falls back to no-cors in case of an error.
 * @return {Promise}
 */
const cacheAssets = () =>
  caches
    .open(version)
    .then(cache =>
      Promise.all([
        ...appAssets.map(assetUrl =>
          fetchUniversal(assetUrl).then(response =>
            cache.put(assetUrl, response)
          )
        ),
        ...corsAssets.map(assetUrl =>
          fetchOpaque(assetUrl).then(response => cache.put(assetUrl, response))
        )
      ])
    );

/**
 * Deletes all previous caches, only keeping the one declared in `version`.
 * @return {Promise}
 */
const deleteOldCaches = () =>
  caches.keys().then(keyList =>
    Promise.all(
      keyList.map(key => {
        if (key !== version) {
          return caches.delete(key);
        }
      })
    )
  );

/**
 * Returns with either a normal or opaque response, whichever preferring the
 * former.
 * The returned response is ready for caching.
 * @throws if a regular response is has non "ok" status
 * @throws if an opaque response has non "0" status
 * @param {Request|string} request
 * @return {Promise}
 */
const fetchUniversal = request =>
  fetchRegular(request).catch(e => {
    console.warn(
      "Regular fetch failed, requesting an opaque response instead."
    );
    return fetchOpaque(request);
  });

/**
 * Fetches a regular response.
 * @throws if the response has non "ok" status
 * @param {Request|string} request
 * @return {Promise}
 */
const fetchRegular = request =>
  fetch(request).then(response => {
    if (!response.ok) {
      throw new TypeError(
        "Non OK response status for request: " + response.status
      );
    }

    return response;
  });

/**
 * Fetches an opaque response.
 * @throws if the response has non "0" status
 * @param {Request|string} request
 * @return {Promise}
 */
const fetchOpaque = request =>
  fetch(request, { mode: "no-cors" }).then(response => {
    if (response.status !== 0) {
      throw new TypeError(
        "Non 0 response status for opaque request: " + response.status
      );
    }

    return response;
  });
