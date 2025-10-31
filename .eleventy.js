module.exports = function(eleventyConfig) {

  // --- 1. Copy Assets ---
  // Copy the 'style.css' file to the final site
  eleventyConfig.addPassthroughCopy("style.css");

  // --- 2. Copy Folders ---
  // Copy these entire folders (and all their files) to the final site
  eleventyConfig.addPassthroughCopy("attorneys");
  eleventyConfig.addPassthroughCopy("practice-areas");
  // eleventyConfig.addPassthroughCopy("blog"); // We'll uncomment this later

  // --- 3. Process All HTML ---
  // Tell Eleventy to find and process all .html files,
  // not just index.html.
  return {
    templateFormats: [
      "md",
      "njk",
      "html",
      "liquid"
    ],
    htmlTemplateEngine: "liquid"
  };
};