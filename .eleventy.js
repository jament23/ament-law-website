module.exports = function(eleventyConfig) {
  
  // Copy the 'style.css' file to the final site
  eleventyConfig.addPassthroughCopy("style.css");

  // Tell Eleventy to find and process all .html files
  return {
    templateFormats: [
      "md",
      "njk",
      "html",
      "liquid"
    ],

    // This makes sure all .html files are processed correctly
    htmlTemplateEngine: "liquid"
  };
};