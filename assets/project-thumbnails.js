(function () {
  var thumbnails = document.querySelectorAll(".project-thumb--gif img[data-animated-src][data-still-src]");

  if (!thumbnails.length) {
    return;
  }

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    return;
  }

  thumbnails.forEach(function (image) {
    var row = image.closest(".project-row");
    var animatedSrc = image.dataset.animatedSrc;
    var stillSrc = image.dataset.stillSrc;

    if (!row || !animatedSrc || !stillSrc) {
      return;
    }

    function play() {
      if (image.src.endsWith(animatedSrc)) {
        return;
      }

      image.src = animatedSrc;
    }

    function pause() {
      if (image.src.endsWith(stillSrc)) {
        return;
      }

      image.src = stillSrc;
    }

    row.addEventListener("pointerenter", play);
    row.addEventListener("pointerleave", pause);
    row.addEventListener("focusin", play);
    row.addEventListener("focusout", function (event) {
      if (!row.contains(event.relatedTarget)) {
        pause();
      }
    });
  });
})();
