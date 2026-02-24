# Ament Law Group Website

## Quick Start

```bash
npm install
npx @11ty/eleventy --serve
```

This starts a local dev server at `http://localhost:8080`.

## How to Add a New Blog Post

Adding a blog post is simple — just create a new Markdown file in the `blog/posts/` folder.

### Step 1: Create a New File

Create a new `.md` file in `blog/posts/`. Name it with a URL-friendly slug:

```
blog/posts/your-blog-post-title.md
```

For example: `blog/posts/what-is-a-short-certificate-in-pennsylvania.md`

### Step 2: Add Front Matter

Every blog post starts with a YAML front matter block between `---` markers. Copy this template:

```markdown
---
layout: layouts/blog-post.njk
title: "Your Blog Post Title Here"
description: "A 1-2 sentence summary that appears in search results and the blog listing page."
date: 2026-02-23
author: "John W. Ament, Esq."
tags: ["estate planning", "probate"]
related_services:
  - name: "Estates & Trusts"
    url: "/practice-areas/estate-planning/"
  - name: "Probate Administration"
    url: "/practice-areas/probate-administration/"
---

Your blog content starts here...
```

**Required fields:**
- `layout` — Always use `layouts/blog-post.njk`
- `title` — The post title (appears as the page heading)
- `description` — Brief summary for SEO and the blog listing
- `date` — Publication date in YYYY-MM-DD format (determines sort order)

**Optional fields:**
- `author` — Byline (defaults to none if omitted)
- `tags` — Array of topic tags
- `related_services` — Sidebar links to practice area pages (defaults to Estates, Probate, and Real Estate if omitted)

### Step 3: Write Your Content

Write your post using standard Markdown:

```markdown
## Section Heading

This is a paragraph with **bold text** and [a link](https://example.com).

### Subsection

Here's a list:
- Item one
- Item two
- Item three

---

Use horizontal rules to separate major sections.
```

### Step 4: Build and Preview

```bash
npx @11ty/eleventy --serve
```

Visit `http://localhost:8080/blog/` to see your post in the listing, or go directly to `http://localhost:8080/blog/your-blog-post-title/`.

### Step 5: Deploy

Commit and push to GitHub. If you're using a CI/CD pipeline or hosting on Netlify/Vercel/Cloudflare Pages, the site will rebuild automatically.

---

## Project Structure

```
ament-law-website/
├── _includes/
│   └── layouts/
│       └── blog-post.njk          # Blog post template
├── _data/                          # (reserved for site data files)
├── blog/
│   ├── index.njk                   # Blog listing page (auto-generated)
│   └── posts/
│       ├── posts.json              # Default settings for all posts
│       └── *.md                    # Individual blog posts
├── attorneys/                      # Attorney profile pages
├── practice-areas/                 # Practice area detail pages
├── index.html                      # Homepage
├── about.html                      # About page
├── contact.html                    # Contact page
├── areas-we-serve.html             # Service area page
├── style.css                       # All styles
├── .eleventy.js                    # Eleventy configuration
└── package.json
```

## Blog Post Checklist

Before publishing, verify:
- [ ] File name uses lowercase with hyphens (no spaces)
- [ ] Front matter has `layout`, `title`, `description`, `date`
- [ ] Date format is YYYY-MM-DD
- [ ] Description is under 160 characters (for SEO)
- [ ] Content reads well and includes a call to action
- [ ] Related services in the sidebar are relevant to the topic
