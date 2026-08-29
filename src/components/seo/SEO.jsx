import { useEffect } from "react";

// Lightweight SEO helper for React SPA.
// Updates document.title and head meta/link tags on route change.
// Ensures stale metadata from previous route does not persist.
export default function SEO({
  title,
  description,
  canonical,
  robots,
  ogTitle,
  ogDescription,
  ogUrl,
  ogType = "website",
  ogSiteName = "Verronex VTU",
  ogLocale = "en_NG",
  ogImage,
  twitterCard = "summary_large_image",
  twitterTitle,
  twitterDescription,
  twitterImage,
}) {
  useEffect(() => {
    if (title) document.title = title;

    const setMeta = (attr, key, value) => {
      if (value == null || value === "") {
        // Remove stale tag if value is explicitly null/false and previously existed
        // We treat undefined as "don't touch", null as "remove"
        if (value === null) {
          const existing = document.head.querySelector(`meta[${attr}="${key}"]`);
          if (existing) existing.remove();
        }
        return;
      }
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };

    const setLink = (rel, href) => {
      if (href == null || href === "") {
        if (href === null) {
          const existing = document.head.querySelector(`link[rel="${rel}"]`);
          if (existing) existing.remove();
        }
        return;
      }
      let el = document.head.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    // Standard
    if (description !== undefined) setMeta("name", "description", description);
    if (robots !== undefined) setMeta("name", "robots", robots);

    if (canonical !== undefined) setLink("canonical", canonical);

    // Open Graph
    if (ogTitle !== undefined) setMeta("property", "og:title", ogTitle);
    if (ogDescription !== undefined) setMeta("property", "og:description", ogDescription);
    if (ogUrl !== undefined) setMeta("property", "og:url", ogUrl);
    if (ogType !== undefined) setMeta("property", "og:type", ogType);
    if (ogSiteName !== undefined) setMeta("property", "og:site_name", ogSiteName);
    if (ogLocale !== undefined) setMeta("property", "og:locale", ogLocale);
    if (ogImage !== undefined) setMeta("property", "og:image", ogImage);

    // Twitter
    if (twitterCard !== undefined) setMeta("name", "twitter:card", twitterCard);
    if (twitterTitle !== undefined) setMeta("name", "twitter:title", twitterTitle);
    if (twitterDescription !== undefined) setMeta("name", "twitter:description", twitterDescription);
    if (twitterImage !== undefined) setMeta("name", "twitter:image", twitterImage);

    // Clear stale public metadata on private pages (noindex) when not explicitly provided
    const isNoIndex = robots && robots.includes("noindex");
    if (isNoIndex) {
      if (description === undefined) setMeta("name", "description", null);
      if (ogTitle === undefined) setMeta("property", "og:title", null);
      if (ogDescription === undefined) setMeta("property", "og:description", null);
      if (ogUrl === undefined) setMeta("property", "og:url", null);
      if (ogImage === undefined) setMeta("property", "og:image", null);
      if (twitterTitle === undefined) setMeta("name", "twitter:title", null);
      if (twitterDescription === undefined) setMeta("name", "twitter:description", null);
      if (twitterImage === undefined) setMeta("name", "twitter:image", null);
    }
  }, [
    title,
    description,
    canonical,
    robots,
    ogTitle,
    ogDescription,
    ogUrl,
    ogType,
    ogSiteName,
    ogLocale,
    ogImage,
    twitterCard,
    twitterTitle,
    twitterDescription,
    twitterImage,
  ]);

  return null;
}
