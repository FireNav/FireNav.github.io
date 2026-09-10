(() => {
  "use strict";

  const initializeComparison = (section) => {
    const videos = [...(section?.querySelectorAll("video") || [])];
    if (!videos.length) return;

    const category = section.querySelector("[data-navigation-category]");
    const expectedPlaying = new Set();
    const expectedSeeking = new Set();
    const stages = new Map(videos.map((video) => [video, video.parentElement]));
    let wanted = true;
    let visible = false;
    let loaded = false;
    let starting = false;
    let revision = 0;
    let position = 0;
    let rate = 1;
    let master = null;

    const pauseAll = () => {
      revision += 1;
      starting = false;
      expectedPlaying.clear();
      videos.forEach((video) => video.pause());
    };

    const seekVideo = (video, time) => {
      if (!Number.isFinite(video.duration)) return;
      const target = Math.min(time, video.duration);
      if (Math.abs(video.currentTime - target) < 0.05) return;
      expectedSeeking.add(video);
      video.currentTime = target;
    };

    const seekAll = (time) => {
      pauseAll();
      position = Math.max(0, Math.min(time, master?.duration || time));
      videos.forEach((video) => seekVideo(video, position));
    };

    const loadAll = () => {
      if (loaded) return;
      loaded = true;
      videos.forEach((video) => {
        video.preload = "auto";
        video.load();
      });
    };

    const finished = (video) => position >= video.duration - 0.05;

    const startAll = () => {
      if (starting) return;
      starting = true;
      const attempt = revision;
      const pending = videos.filter((video) => !finished(video));
      pending.forEach((video) => expectedPlaying.add(video));
      Promise.all(pending.map((video) => video.play())).then(() => {
        if (attempt === revision) starting = false;
      }).catch(() => {
        if (attempt !== revision) return;
        pauseAll();
        wanted = false;
      });
    };

    // The longest recording supplies a shared clock. Shorter recordings hold
    // their last frame until the whole comparison restarts together.
    const synchronize = () => {
      if (!visible || document.hidden || !wanted) return;
      loadAll();
      if (videos.some((video) => video.error)) {
        pauseAll();
        wanted = false;
        return;
      }
      if (videos.some((video) => !Number.isFinite(video.duration))) {
        return;
      }
      master = videos.reduce((longest, video) => video.duration > longest.duration ? video : longest);
      if (!master.paused) position = master.currentTime;
      if (master.ended || position >= master.duration - 0.05) seekAll(0);
      if (videos.some((video) => video.seeking || (!finished(video) && video.readyState < 3))) {
        pauseAll();
        return;
      }
      videos.forEach((video) => {
        if (Math.abs(video.currentTime - Math.min(position, video.duration)) > 0.18) seekVideo(video, position);
      });
      if (videos.some((video) => video.seeking)) return;
      if (videos.some((video) => !finished(video) && video.paused)) startAll();
    };

    videos.forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = false;
      video.addEventListener("play", () => {
        if (expectedPlaying.has(video)) return;
        videos.filter((item) => item.error).forEach((item) => {
          stages.get(item).replaceChildren(item);
          item.load();
        });
        wanted = true;
        visible = true;
        loadAll();
        synchronize();
      });
      video.addEventListener("pause", () => {
        if (!expectedPlaying.has(video) || video.ended || video.seeking) return;
        position = master?.currentTime || video.currentTime;
        wanted = false;
        pauseAll();
      });
      video.addEventListener("seeking", () => {
        if (expectedSeeking.delete(video)) return;
        seekAll(video.currentTime);
      });
      video.addEventListener("ratechange", () => {
        if (video.playbackRate === rate) return;
        rate = video.playbackRate;
        videos.forEach((item) => { item.playbackRate = rate; });
      });
      video.addEventListener("waiting", () => {
        if (!wanted || video.seeking || finished(video)) return;
        position = master?.currentTime || position;
        pauseAll();
      });
    });

    // Capture runs before index.js replaces the category sources.
    category?.addEventListener("change", () => {
      pauseAll();
      expectedSeeking.clear();
      position = 0;
      master = null;
      wanted = true;
    }, true);
    category?.addEventListener("change", synchronize);

    const updateVisibility = () => {
      if (!visible || document.hidden) {
        position = master?.currentTime || position;
        pauseAll();
      } else synchronize();
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        updateVisibility();
      }, { threshold: 0 }).observe(section.querySelector(".shell"));
    } else visible = true;
    document.addEventListener("visibilitychange", updateVisibility);
    window.setInterval(synchronize, 100);
  };

  document.querySelectorAll("[data-synchronized-videos]").forEach(initializeComparison);
})();
