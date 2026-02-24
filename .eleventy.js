module.exports = function(eleventyConfig) {
  
  // Pass through static files
  eleventyConfig.addPassthroughCopy("style.css");
  eleventyConfig.addPassthroughCopy("images");

  // Blog post collection sorted by date (newest first)
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/posts/*.md").sort(function(a, b) {
      return b.date - a.date;
    });
  });

  // Date formatting filter
  eleventyConfig.addFilter("dateFormat", function(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
  });

  // Excerpt filter (first 200 chars of content, stripped of HTML)
  eleventyConfig.addFilter("excerpt", function(content) {
    if (!content) return "";
    const stripped = content.replace(/<[^>]+>/g, '');
    return stripped.substring(0, 200).trim() + (stripped.length > 200 ? '...' : '');
  });

  return {
    templateFormats: ["md", "njk", "html", "liquid"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: false,
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
