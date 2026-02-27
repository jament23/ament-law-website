---
eleventyExcludeFromCollections: true
---

# How to Add a Blog Post

## Quick Steps

1. Open the `blog/posts/` folder
2. Copy `_TEMPLATE.md` and rename it (e.g., `why-every-parent-needs-a-will.md`)
3. Fill in the `title`, `description`, and `date` between the `---` lines
4. Write your content below the second `---`
5. Commit and push to GitHub

The site rebuilds automatically. Your post will appear at:
`www.ament.law/blog/your-file-name/`

## Author Info

The template defaults to Katlynn. To change the author, replace the author fields with one of these:

**John Ament:**
```
author: "John W. Ament, Esq."
author_url: "/attorneys/john-ament/"
author_jobtitle: "Partner"
author_credentials: "J.D./M.B.A., Duquesne University"
author_bio: "John W. Ament is a partner and co-founder of Ament Law Group, P.C. in Murrysville, PA."
```

**Laura Cohen:**
```
author: "Laura Cohen, Esq."
author_url: "/attorneys/laura-cohen/"
author_jobtitle: "Of Counsel"
author_credentials: "J.D., University of Pittsburgh School of Law"
author_bio: "Laura Cohen is Of Counsel at Ament Law Group, P.C., with over 30 years of experience in estate planning and estate administration."
```

**Patrick Shannon:**
```
author: "Patrick J. Shannon, Esq."
author_url: "/attorneys/patrick-shannon/"
author_jobtitle: "Of Counsel"
author_credentials: "J.D., Duquesne University School of Law"
author_bio: "Patrick J. Shannon is Of Counsel at Ament Law Group, P.C., with over 40 years of experience in estate planning and estate administration."
```

## Writing Tips

- **Title:** Under 60 characters — shows in Google results
- **Description:** Under 160 characters — the snippet under the title in search
- **Date:** Use YYYY-MM-DD format (e.g., 2026-03-15) — controls sort order
- **Headings:** Use `##` to break up sections
- **End with a CTA:** Link to `/contact/` or include the phone number
- **PA law references:** Cite statutes when relevant (e.g., 20 Pa.C.S. § 5601)
- **File name:** Lowercase, hyphens, no spaces — this becomes the URL
