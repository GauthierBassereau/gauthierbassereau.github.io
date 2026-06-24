(function () {
  var gifThumbnails = document.querySelectorAll(".project-thumb--gif img[data-animated-src]");

  if (!gifThumbnails.length) {
    return;
  }

  var reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  gifThumbnails.forEach(function (image) {
    setupGifThumbnail(image, reducedMotion);
  });

  async function setupGifThumbnail(image, reducedMotion) {
    var animatedSrc = image.dataset.animatedSrc;
    var trigger = image.closest(".project-row") || image.closest(".project-thumb");

    if (!animatedSrc || !trigger) {
      return;
    }

    try {
      var stillSrc = await createFirstFrame(animatedSrc);
      image.dataset.stillSrc = stillSrc;
      image.src = stillSrc;

      if (!reducedMotion) {
        addPlaybackHandlers(trigger, image, stillSrc, animatedSrc);
      }
    } catch (_error) {
      image.src = animatedSrc;
    }
  }

  function addPlaybackHandlers(trigger, image, stillSrc, animatedSrc) {
    var isPlaying = false;

    function play() {
      if (isPlaying) {
        return;
      }

      isPlaying = true;
      image.src = animatedSrc;
    }

    function pause() {
      if (!isPlaying) {
        return;
      }

      isPlaying = false;
      image.src = stillSrc;
    }

    trigger.addEventListener("mouseenter", play);
    trigger.addEventListener("mouseleave", pause);
    trigger.addEventListener("focusin", play);
    trigger.addEventListener("focusout", function (event) {
      if (!trigger.contains(event.relatedTarget)) {
        pause();
      }
    });
  }

  async function createFirstFrame(src) {
    var response = await fetch(src, { credentials: "same-origin" });

    if (!response.ok) {
      throw new Error("Could not load GIF thumbnail.");
    }

    var blob = await response.blob();

    if ("ImageDecoder" in window) {
      try {
        return await createFirstFrameWithDecoder(blob);
      } catch (_error) {
        return createFirstFrameWithImage(blob);
      }
    }

    return createFirstFrameWithImage(blob);
  }

  async function createFirstFrameWithDecoder(blob) {
    var decoder = new ImageDecoder({
      data: blob.stream(),
      type: blob.type || "image/gif"
    });
    var frame = await decoder.decode({ frameIndex: 0 });
    var image = frame.image;

    try {
      return drawStillImage(
        image,
        image.displayWidth || image.codedWidth,
        image.displayHeight || image.codedHeight
      );
    } finally {
      image.close();

      if (typeof decoder.close === "function") {
        decoder.close();
      }
    }
  }

  function createFirstFrameWithImage(blob) {
    return new Promise(function (resolve, reject) {
      var objectUrl = URL.createObjectURL(blob);
      var image = new Image();

      image.onload = function () {
        try {
          resolve(drawStillImage(image, image.naturalWidth, image.naturalHeight));
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not decode GIF thumbnail."));
      };

      image.src = objectUrl;
    });
  }

  function drawStillImage(image, width, height) {
    if (!width || !height) {
      throw new Error("Could not size GIF thumbnail frame.");
    }

    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    var context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/png");
  }
})();
