module.exports = function(eleventyConfig) {

  // The only thing we need to copy is the stylesheet.
  // Eleventy will now process all HTML files in all folders.
  eleventyConfig.addPassthroughCopy("style.css");

  // Tell Eleventy to find and process all .html files
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