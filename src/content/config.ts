import { defineCollection, z } from 'astro:content';

const specRow = z.object({ label: z.string(), value: z.string() });
const specGroup = z.object({ group: z.string(), items: z.array(specRow) });
const youtubeVideo = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  uploadDate: z.string().optional(),
  duration: z.string().optional(),
  transcriptSummary: z.string().optional(),
});

const products = defineCollection({
  type: 'content',
  schema: z.object({
    title:        z.string(),
    category:     z.enum(['caravan', 'slide-on', 'expedition']),
    tagline:      z.string(),
    price:        z.string(),
    priceBadge:   z.string().optional(),
    status:       z.enum(['available', 'on-sale', 'coming-soon']).default('available'),
    onSale:       z.boolean().default(false),
    featured:     z.boolean().default(false),
    heroImage:    z.string(),
    gallery:      z.array(z.string()),
    keySpecs:     z.array(specRow),
    specs:        z.array(specRow).optional(),
    specGroups:   z.array(specGroup).optional(),
    features:     z.array(z.string()).optional(),
    faq:          z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    relatedSlugs: z.array(z.string()).optional(),
    youtubeVideo: youtubeVideo.optional(),
    seoTitle:     z.string().optional(),
    seoDesc:      z.string().optional(),
    canonicalUrl: z.string().optional(),
  }),
});

export const collections = { products };
