module.exports = function(eleventyConfig) {

  // Tell Eleventy to copy the 'style.css' file 
  // from our project to the final '_site' folder.
  eleventyConfig.addPassthroughCopy("style.css");

};