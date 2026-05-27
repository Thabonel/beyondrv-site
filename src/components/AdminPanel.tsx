import { Component, type ReactNode, useState, useRef, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import initialRecentBuilds from '../data/homepage/recent-builds.json';
import initialTestimonials from '../data/homepage/testimonials.json';
import { adminFetch, clearAdminToken } from '../lib/adminApi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

class AdminSectionBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : 'Admin section failed to load.' };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '1rem', color: '#f87171', fontSize: '0.85rem', lineHeight: 1.45 }}>
          Could not load this admin section: {this.state.error}
        </div>
      );
    }

    return this.props.children;
  }
}

type JudgeDecision = 'allow' | 'block' | 'revise' | 'escalate';

interface PendingChange {
  path: string;
  content: string;
  description: string;
  proposal_id: string;
  judgeDecision: JudgeDecision;
  risk_flags: string[];
  escalation_reason?: string;
}

type DeployStatus = 'idle' | 'deploying' | 'done' | 'error';
type PanelTab = 'dashboard' | 'products' | 'media' | 'homepage' | 'enquiries' | 'knowledge' | 'pending';
type ProductCategory = 'slide-on' | 'caravan' | 'expedition';
type ProductStatus = 'available' | 'on-sale' | 'coming-soon';

interface ProductRecord {
  slug: string;
  title: string;
  price: string;
  status: 'available' | 'on-sale' | 'coming-soon' | string;
  category: ProductCategory | string;
  tagline: string;
  featured?: boolean;
  onSale?: boolean;
  heroImage?: string;
  gallery?: string[];
  galleryCount?: number;
  relatedSlugs?: string[];
}

interface NewProductForm {
  title: string;
  category: ProductCategory;
  price: string;
  tagline: string;
  keySpecs: string;
  description: string;
}

interface EditProductForm {
  slug: string;
  title: string;
  price: string;
  status: ProductStatus;
  tagline: string;
  featured: boolean;
  onSale: boolean;
  heroImage: string;
  galleryText: string;
  relatedSlugs: string[];
  notes: string;
}

interface MediaFile {
  key: string;
  url: string;
  optimizedUrl: string;
  metadata: {
    alt?: string;
    slug?: string;
    filename?: string;
    contentType?: string;
    uploadedAt?: string;
  };
}

interface EnquiryRecord {
  id: string;
  submittedAt: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  product_interest?: string;
  callback_date?: string;
  callback_time?: string;
  referral_source_self_reported?: string;
  referral_source_other?: string;
  leadStatus?: {
    enquiryId: string;
    status: 'new' | 'contacted' | 'quoted' | 'won' | 'lost' | 'spam';
    notes?: string;
    nextFollowUpDate?: string;
    updatedAt?: string;
  };
}

interface ContactConfig {
  toEmail: string;
  fromEmail: string;
  hasResendKey: boolean;
  ready: boolean;
  missing: string[];
}

interface RecentBuild {
  id: string;
  title: string;
  image: string;
  alt: string;
  tags: string[];
  link?: string;
  caption?: string;
  completedDate?: string;
  vehiclePlatform?: string;
  productSlug?: string;
  isVisible: boolean;
  sortOrder: number;
}

interface Testimonial {
  id: string;
  quote: string;
  customerName: string;
  customerLocation?: string;
  productName?: string;
  image?: string;
  rating?: number;
  source?: string;
  approvedDate?: string;
  isVisible: boolean;
  sortOrder: number;
}

const VERDICT_STYLE: Record<JudgeDecision, { label: string; color: string; border: string }> = {
  allow:    { label: '✓ Approved',  color: '#4ade80', border: '1px solid #1a3a1a' },
  escalate: { label: '⚠ Escalated', color: '#fb923c', border: '1px solid #3a2010' },
  block:    { label: '✕ Blocked',   color: '#f87171', border: '1px solid #3a1010' },
  revise:   { label: '↩ Revised',   color: '#a78bfa', border: '1px solid #2a1a3a' },
};

const EMPTY_PRODUCT_FORM: NewProductForm = {
  title: '',
  category: 'slide-on',
  price: '',
  tagline: '',
  keySpecs: '',
  description: '',
};

const EMPTY_RECENT_BUILD: RecentBuild = {
  id: '',
  title: '',
  image: '',
  alt: '',
  tags: ['Finished in Mutdapilly, Queensland'],
  link: '',
  isVisible: true,
  sortOrder: 1,
};

const EMPTY_TESTIMONIAL: Testimonial = {
  id: '',
  quote: '',
  customerName: '',
  customerLocation: '',
  productName: '',
  rating: 5,
  isVisible: false,
  sortOrder: 1,
};

function slugifyTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function adminImageUrl(src: string) {
  if (!src) return '';
  if (src.startsWith('/images/optimized/')) return src.replace(/\.webp$/, '-480.webp');
  if (src.startsWith('/images/products/')) return src;
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=800&fit=cover`;
}

function parseGalleryText(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

function formatGalleryText(images: string[]) {
  return images.join('\n');
}

function AdminProductThumb({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = src && !failed ? adminImageUrl(src) : '';

  return (
    <div style={{ width: '100%', height: '110px', background: '#101010', borderBottom: '1px solid #303030', position: 'relative', overflow: 'hidden' }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
      ) : (
        <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#777', fontSize: '0.72rem', padding: '0.75rem', textAlign: 'center' }}>
          No hero image for {title}
        </div>
      )}
    </div>
  );
}

function ProductImagePreview({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = src && !failed ? adminImageUrl(src) : '';

  return (
    <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#0d0d0d', border: '1px solid #333', borderRadius: '6px', overflow: 'hidden' }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
        />
      ) : (
        <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#777', fontSize: '0.72rem', padding: '0.75rem', textAlign: 'center' }}>
          No image preview for {title}
        </div>
      )}
    </div>
  );
}

function ProductGalleryEditor({ form, onChange }: { form: EditProductForm; onChange: (next: EditProductForm) => void }) {
  const [newImage, setNewImage] = useState('');
  const gallery = parseGalleryText(form.galleryText);

  function updateGallery(nextGallery: string[]) {
    onChange({ ...form, galleryText: formatGalleryText(nextGallery) });
  }

  function moveImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= gallery.length) return;
    const nextGallery = [...gallery];
    [nextGallery[index], nextGallery[nextIndex]] = [nextGallery[nextIndex], nextGallery[index]];
    updateGallery(nextGallery);
  }

  function removeImage(index: number) {
    updateGallery(gallery.filter((_, itemIndex) => itemIndex !== index));
  }

  function addImage() {
    const trimmed = newImage.trim();
    if (!trimmed || gallery.includes(trimmed)) return;
    updateGallery([...gallery, trimmed]);
    setNewImage('');
  }

  return (
    <div style={{ display: 'grid', gap: '0.45rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
        <div style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 700 }}>Gallery Photos</div>
        <div style={{ color: '#777', fontSize: '0.68rem' }}>Shown top to bottom in this order</div>
      </div>
      <div style={{ display: 'grid', gap: '0.4rem', maxHeight: '360px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px', padding: '0.45rem', background: '#101010' }}>
        {gallery.map((image, index) => (
          <div key={`${image}-${index}`} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', gap: '0.55rem', alignItems: 'center', padding: '0.45rem', border: '1px solid #282828', borderRadius: '6px', background: '#181818' }}>
            <ProductImagePreview src={image} title={`Gallery image ${index + 1}`} />
            <div style={{ minWidth: 0, display: 'grid', gap: '0.35rem' }}>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', minWidth: 0 }}>
                <span style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>Photo {index + 1}</span>
                <span title={image} style={{ color: '#aaa', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{image}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.3rem' }}>
                <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} style={{ background: '#222', color: index === 0 ? '#666' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.34rem', cursor: index === 0 ? 'not-allowed' : 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>Up</button>
                <button type="button" onClick={() => moveImage(index, 1)} disabled={index === gallery.length - 1} style={{ background: '#222', color: index === gallery.length - 1 ? '#666' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.34rem', cursor: index === gallery.length - 1 ? 'not-allowed' : 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>Down</button>
                <button type="button" onClick={() => onChange({ ...form, heroImage: image })} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.34rem', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>Set Hero</button>
                <button type="button" onClick={() => removeImage(index)} style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.34rem', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700 }}>Remove</button>
              </div>
            </div>
          </div>
        ))}
        {gallery.length === 0 && (
          <div style={{ color: '#777', fontSize: '0.74rem', textAlign: 'center', padding: '0.8rem' }}>No gallery photos yet.</div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.35rem' }}>
        <input
          value={newImage}
          onChange={e => setNewImage(e.target.value)}
          placeholder="Add image URL or path"
          style={{ minWidth: 0, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.76rem' }}
        />
        <button type="button" onClick={addImage} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.45rem 0.65rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.72rem' }}>
          Add
        </button>
      </div>
    </div>
  );
}

function redirectToLoginIfUnauthorized(res: Response) {
  if (res.status === 401) {
    clearAdminToken();
    window.location.href = '/.netlify/functions/admin-login';
    return true;
  }
  return false;
}

function makePendingChange(path: string, content: string, description: string): PendingChange {
  return {
    path,
    content,
    description,
    proposal_id: `admin-ui-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    judgeDecision: 'allow',
    risk_flags: [],
  };
}

function orderedItems<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function renumber<T extends { sortOrder: number }>(items: T[]) {
  return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
}

export default function AdminPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm the Beyond RV admin assistant. Tell me what you'd like to change on the site." }
  ]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<PanelTab>('dashboard');
  const [knowledgeInput, setKnowledgeInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  const [newProduct, setNewProduct] = useState<NewProductForm>(EMPTY_PRODUCT_FORM);
  const [editProduct, setEditProduct] = useState<EditProductForm | null>(null);
  const [previewChange, setPreviewChange] = useState<PendingChange | null>(null);
  const [mediaSlug, setMediaSlug] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaStatus, setMediaStatus] = useState('');
  const [mediaAlt, setMediaAlt] = useState('');
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [enquiriesLoading, setEnquiriesLoading] = useState(false);
  const [enquiriesStatus, setEnquiriesStatus] = useState('');
  const [leadSaving, setLeadSaving] = useState<string | null>(null);
  const [contactConfig, setContactConfig] = useState<ContactConfig | null>(null);
  const [recentBuilds, setRecentBuilds] = useState<RecentBuild[]>(renumber(orderedItems(initialRecentBuilds as RecentBuild[])));
  const [testimonials, setTestimonials] = useState<Testimonial[]>(renumber(orderedItems(initialTestimonials as Testimonial[])));
  const [homepageStatus, setHomepageStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingChange[]>([]);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [deployResults, setDeployResults] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const res = await adminFetch('/.netlify/functions/admin-products');
        if (redirectToLoginIfUnauthorized(res)) return;
        if (!res.ok) throw new Error('Could not load products');
        const data = await res.json() as { products: ProductRecord[] };
        if (!cancelled) setProducts(data.products ?? []);
      } catch {
        if (!cancelled) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'I could not load the product manager list. The chat can still make changes if you type the product name.' }]);
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    loadProducts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!productsLoading && !mediaSlug && products[0]) {
      setMediaSlug(products[0].slug);
    }
  }, [mediaSlug, products, productsLoading]);

  useEffect(() => {
    if (!mediaSlug) return;
    void loadMedia(mediaSlug);
  }, [mediaSlug]);

  useEffect(() => {
    if (activeTab === 'enquiries') {
      void loadEnquiries();
      void loadContactConfig();
    }
  }, [activeTab]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const res = await adminFetch('/.netlify/functions/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { text: string; pendingChanges: PendingChange[] };
      if (!res.ok) throw new Error(data.text ?? 'Admin AI request failed');

      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);

      if (data.pendingChanges?.length) {
        setPending(prev => {
          const updated = [...prev];
          for (const change of data.pendingChanges) {
            const idx = updated.findIndex(p => p.path === change.path);
            if (idx >= 0) updated[idx] = change;
            else updated.push(change);
          }
          return updated;
        });
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      sendMessage(`[Image upload] filename: ${file.name}, base64: ${base64.slice(0, 20)}...`);
    };
    reader.readAsDataURL(file);
  }

  async function loadMedia(slug = mediaSlug) {
    if (!slug) return;
    setMediaLoading(true);
    try {
      const res = await adminFetch(`/.netlify/functions/admin-media?slug=${encodeURIComponent(slug)}`);
      if (redirectToLoginIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('Could not load media');
      const data = await res.json() as { files: MediaFile[] };
      setMediaFiles(data.files ?? []);
      setMediaStatus('');
    } catch {
      setMediaStatus('Could not load media for this product.');
    } finally {
      setMediaLoading(false);
    }
  }

  async function loadEnquiries() {
    setEnquiriesLoading(true);
    try {
      const res = await adminFetch('/.netlify/functions/admin-enquiries');
      if (redirectToLoginIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('Could not load enquiries');
      const data = await res.json() as { enquiries: EnquiryRecord[]; storageReady?: boolean; warning?: string };
      setEnquiries(data.enquiries.filter(Boolean) ?? []);
      setEnquiriesStatus(data.warning ?? '');
    } catch {
      setEnquiriesStatus('Could not load recent enquiries.');
    } finally {
      setEnquiriesLoading(false);
    }
  }

  async function loadContactConfig() {
    try {
      const res = await adminFetch('/.netlify/functions/admin-contact-config');
      if (redirectToLoginIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('Could not load contact config');
      const data = await res.json() as ContactConfig;
      setContactConfig(data);
    } catch {
      setContactConfig(null);
    }
  }

  async function saveLeadStatus(
    enquiry: EnquiryRecord,
    patch: Partial<NonNullable<EnquiryRecord['leadStatus']>>
  ) {
    const current = enquiry.leadStatus ?? {
      enquiryId: enquiry.id,
      status: 'new' as const,
      notes: '',
      nextFollowUpDate: enquiry.callback_date ?? '',
      updatedAt: enquiry.submittedAt,
    };
    const next = { ...current, ...patch, enquiryId: enquiry.id };
    setEnquiries(prev => prev.map(item => item.id === enquiry.id ? { ...item, leadStatus: next } : item));
    setLeadSaving(enquiry.id);
    try {
      const res = await adminFetch('/.netlify/functions/admin-lead-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enquiryId: enquiry.id,
          status: next.status,
          notes: next.notes ?? '',
          nextFollowUpDate: next.nextFollowUpDate ?? '',
        }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { leadStatus?: EnquiryRecord['leadStatus']; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not save lead status');
      if (data.leadStatus) {
        setEnquiries(prev => prev.map(item => item.id === enquiry.id ? { ...item, leadStatus: data.leadStatus } : item));
      }
      setEnquiriesStatus('');
    } catch (err) {
      setEnquiriesStatus(err instanceof Error ? err.message : 'Could not save lead status.');
      setEnquiries(prev => prev.map(item => item.id === enquiry.id ? { ...item, leadStatus: current } : item));
    } finally {
      setLeadSaving(null);
    }
  }

  async function uploadMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !mediaSlug) return;
    setMediaLoading(true);
    setMediaStatus('Uploading image...');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const res = await adminFetch('/.netlify/functions/admin-media-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: mediaSlug,
            filename: file.name,
            contentType: file.type,
            data: base64,
            alt: mediaAlt,
          }),
        });
        if (redirectToLoginIfUnauthorized(res)) return;
        const data = await res.json() as { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        setMediaStatus('Image uploaded.');
        setMediaAlt('');
        await loadMedia(mediaSlug);
      } catch (err) {
        setMediaStatus(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setMediaLoading(false);
        if (mediaFileRef.current) mediaFileRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  async function deleteMedia(key: string) {
    const ok = window.confirm('Delete this uploaded image? Product pages using this image will need their gallery updated first.');
    if (!ok) return;
    setMediaLoading(true);
    try {
      const res = await adminFetch('/.netlify/functions/admin-media', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      if (!res.ok) throw new Error('Delete failed');
      await loadMedia(mediaSlug);
      setMediaStatus('Image deleted.');
    } catch {
      setMediaStatus('Could not delete image.');
    } finally {
      setMediaLoading(false);
    }
  }

  function editFormFromProduct(product: ProductRecord): EditProductForm {
    return {
      slug: product.slug,
      title: product.title,
      price: product.price,
      status: (['available', 'on-sale', 'coming-soon'].includes(product.status) ? product.status : 'available') as ProductStatus,
      tagline: product.tagline,
      featured: Boolean(product.featured),
      onSale: Boolean(product.onSale),
      heroImage: product.heroImage ?? '',
      galleryText: (product.gallery ?? []).join('\n'),
      relatedSlugs: product.relatedSlugs ?? [],
      notes: '',
    };
  }

  function applyMediaToProduct(url: string, mode: 'hero' | 'gallery') {
    const product = products.find(item => item.slug === mediaSlug);
    if (!product) return;
    const form = editFormFromProduct(product);

    if (mode === 'hero') {
      form.heroImage = url;
      form.notes = 'Set the uploaded image as the product hero image.';
    } else {
      const gallery = parseGalleryText(form.galleryText);
      if (!gallery.includes(url)) gallery.push(url);
      form.galleryText = gallery.join('\n');
      form.notes = 'Add the uploaded image to the end of the product gallery.';
    }

    setEditProduct(form);
    setActiveTab('products');
  }

  function queueKnowledgeUpdate() {
    const text = knowledgeInput.trim();
    if (!text) return;
    setKnowledgeInput('');
    sendMessage(
      `Update the chatbot business knowledge file at src/data/chatbot-knowledge.md with this information. ` +
      `Read the current file first, preserve useful existing notes, and add or update the relevant note clearly without adding private customer data:\n\n${text}`
    );
  }

  function requestProductUpdate(product: ProductRecord, task: string) {
    setActiveTab('pending');
    sendMessage(
      `${task}\n\nProduct: ${product.title}\nSlug: ${product.slug}\n` +
      `Read src/content/products/${product.slug}.md first, then queue a complete-file change for review.`
    );
  }

  function startStructuredEdit(product: ProductRecord) {
    setEditProduct(editFormFromProduct(product));
  }

  function queueStructuredEdit() {
    if (!editProduct) return;
    const missing = [
      !editProduct.title.trim() && 'title',
      !editProduct.price.trim() && 'price',
      !editProduct.tagline.trim() && 'tagline',
      !editProduct.heroImage.trim() && 'hero image',
    ].filter(Boolean);

    if (missing.length) {
      setMessages(prev => [...prev, { role: 'assistant', content: `The product edit form needs: ${missing.join(', ')}.` }]);
      return;
    }

    const gallery = parseGalleryText(editProduct.galleryText);
    const knownSlugs = new Set(products.map(product => product.slug));
    const invalidRelated = editProduct.relatedSlugs.filter(slug => !knownSlugs.has(slug));

    if (gallery.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'The gallery must contain at least one image URL or path.' }]);
      return;
    }

    if (invalidRelated.length) {
      setMessages(prev => [...prev, { role: 'assistant', content: `These related product slugs are not valid: ${invalidRelated.join(', ')}.` }]);
      return;
    }

    setActiveTab('pending');
    sendMessage(
      `Update this existing product using these structured fields only, preserving all specs, SEO fields, and body copy unless the notes explicitly say otherwise.\n\n` +
      `Product slug: ${editProduct.slug}\n` +
      `File to read first: src/content/products/${editProduct.slug}.md\n\n` +
      `New title: ${editProduct.title.trim()}\n` +
      `New price: ${editProduct.price.trim()}\n` +
      `New status: ${editProduct.status}\n` +
      `New onSale: ${editProduct.onSale}\n` +
      `New featured: ${editProduct.featured}\n` +
      `New tagline: ${editProduct.tagline.trim()}\n` +
      `New heroImage: ${editProduct.heroImage.trim()}\n` +
      `New gallery order, one image per line:\n${gallery.join('\n')}\n\n` +
      `New relatedSlugs:\n${editProduct.relatedSlugs.length ? editProduct.relatedSlugs.join('\n') : 'None'}\n\n` +
      `Additional owner notes:\n${editProduct.notes.trim() || 'None'}\n\n` +
      `Queue one complete-file change for review. Keep the gallery in exactly the order provided and do not invent product specs or image URLs.`
    );
    setEditProduct(null);
  }

  function queueNewProduct() {
    const missing = [
      !newProduct.title.trim() && 'title',
      !newProduct.price.trim() && 'price',
      !newProduct.tagline.trim() && 'tagline',
      !newProduct.keySpecs.trim() && 'key specs',
      !newProduct.description.trim() && 'description',
    ].filter(Boolean);

    if (missing.length) {
      setMessages(prev => [...prev, { role: 'assistant', content: `The new product form needs: ${missing.join(', ')}.` }]);
      return;
    }

    const proposedSlug = slugifyTitle(newProduct.title);
    if (products.some(product => product.slug === proposedSlug)) {
      setMessages(prev => [...prev, { role: 'assistant', content: `A product already uses the slug "${proposedSlug}". Change the title or ask me to edit the existing product instead.` }]);
      return;
    }

    setActiveTab('pending');
    sendMessage(
      `Create a new ${newProduct.category} product page using the existing product markdown format.\n\n` +
      `Title: ${newProduct.title.trim()}\n` +
      `Price: ${newProduct.price.trim()}\n` +
      `Tagline: ${newProduct.tagline.trim()}\n` +
      `Status: available\n` +
      `Category: ${newProduct.category}\n` +
      `Key specs, one per line:\n${newProduct.keySpecs.trim()}\n\n` +
      `Description/body copy:\n${newProduct.description.trim()}\n\n` +
      `Use a URL-safe slug based on the title. Before proposing the new file, list src/content/products and confirm the slug does not already exist. ` +
      `If no real images were supplied, reuse an existing site fallback image only when the product type matches; otherwise ask for image details instead of inventing image URLs.`
    );
    setNewProduct(EMPTY_PRODUCT_FORM);
  }

  function updateRecentBuild(id: string, patch: Partial<RecentBuild>) {
    setRecentBuilds(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function updateTestimonial(id: string, patch: Partial<Testimonial>) {
    setTestimonials(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  function addRecentBuild() {
    const title = `Recent Build ${recentBuilds.length + 1}`;
    setRecentBuilds(prev => renumber([
      ...prev,
      {
        ...EMPTY_RECENT_BUILD,
        id: slugifyTitle(`${title}-${Date.now()}`),
        title,
        sortOrder: prev.length + 1,
      },
    ]));
  }

  function addTestimonial() {
    const title = `testimonial-${testimonials.length + 1}`;
    setTestimonials(prev => renumber([
      ...prev,
      {
        ...EMPTY_TESTIMONIAL,
        id: slugifyTitle(`${title}-${Date.now()}`),
        sortOrder: prev.length + 1,
      },
    ]));
  }

  function removeRecentBuild(id: string) {
    setRecentBuilds(prev => renumber(prev.filter(item => item.id !== id)));
  }

  function removeTestimonial(id: string) {
    setTestimonials(prev => renumber(prev.filter(item => item.id !== id)));
  }

  function moveRecentBuild(id: string, direction: -1 | 1) {
    setRecentBuilds(prev => {
      const next = orderedItems(prev);
      const index = next.findIndex(item => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return renumber(next);
    });
  }

  function moveTestimonial(id: string, direction: -1 | 1) {
    setTestimonials(prev => {
      const next = orderedItems(prev);
      const index = next.findIndex(item => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return renumber(next);
    });
  }

  function applyProductToRecentBuild(id: string, slug: string) {
    const product = products.find(item => item.slug === slug);
    if (!product) return;
    updateRecentBuild(id, {
      image: product.heroImage ?? '',
      alt: `${product.title} build at Beyond RV`,
      link: `/${product.slug}/`,
      productSlug: product.slug,
      title: product.title.includes('Advent') ? `${product.title.replace(' Hardtop Slide-On', '')} Build` : product.title,
    });
  }

  function validateHomepageData() {
    const buildErrors = orderedItems(recentBuilds).flatMap((build, index) => {
      const prefix = `Recent build ${index + 1}`;
      return [
        !build.id.trim() && `${prefix}: ID`,
        !build.title.trim() && `${prefix}: title`,
        !build.image.trim() && `${prefix}: image`,
        !build.alt.trim() && `${prefix}: alt text`,
        build.tags.filter(tag => tag.trim()).length === 0 && `${prefix}: at least one tag`,
      ].filter(Boolean);
    });

    const testimonialErrors = orderedItems(testimonials).flatMap((testimonial, index) => {
      const prefix = `Testimonial ${index + 1}`;
      return [
        !testimonial.id.trim() && `${prefix}: ID`,
        !testimonial.quote.trim() && `${prefix}: quote`,
        !testimonial.customerName.trim() && `${prefix}: customer name`,
        testimonial.rating && (testimonial.rating < 1 || testimonial.rating > 5) && `${prefix}: rating must be 1-5`,
      ].filter(Boolean);
    });

    return [...buildErrors, ...testimonialErrors];
  }

  function queueHomepageUpdate() {
    const errors = validateHomepageData();
    if (errors.length) {
      setHomepageStatus(`Fix before queueing: ${errors.join(', ')}.`);
      return;
    }

    const cleanBuilds = renumber(orderedItems(recentBuilds)).map(build => ({
      ...build,
      id: slugifyTitle(build.id) || slugifyTitle(build.title),
      title: build.title.trim(),
      image: build.image.trim(),
      alt: build.alt.trim(),
      tags: build.tags.map(tag => tag.trim()).filter(Boolean),
      link: build.link?.trim() || undefined,
      caption: build.caption?.trim() || undefined,
      completedDate: build.completedDate?.trim() || undefined,
      vehiclePlatform: build.vehiclePlatform?.trim() || undefined,
      productSlug: build.productSlug?.trim() || undefined,
    }));

    const cleanTestimonials = renumber(orderedItems(testimonials)).map(testimonial => ({
      ...testimonial,
      id: slugifyTitle(testimonial.id) || slugifyTitle(testimonial.customerName),
      quote: testimonial.quote.trim(),
      customerName: testimonial.customerName.trim(),
      customerLocation: testimonial.customerLocation?.trim() || undefined,
      productName: testimonial.productName?.trim() || undefined,
      image: testimonial.image?.trim() || undefined,
      rating: testimonial.rating || undefined,
      source: testimonial.source?.trim() || undefined,
      approvedDate: testimonial.approvedDate?.trim() || undefined,
    }));

    setRecentBuilds(cleanBuilds);
    setTestimonials(cleanTestimonials);
    setPending(prev => [
      ...prev,
      makePendingChange(
        'src/data/homepage/recent-builds.json',
        `${JSON.stringify(cleanBuilds, null, 2)}\n`,
        'Update homepage recent builds'
      ),
      makePendingChange(
        'src/data/homepage/testimonials.json',
        `${JSON.stringify(cleanTestimonials, null, 2)}\n`,
        'Update homepage testimonials'
      ),
    ]);
    setHomepageStatus('Homepage updates queued. Open Pending to preview and deploy.');
    setActiveTab('pending');
  }

  async function deploy() {
    if (!pending.length || deployStatus === 'deploying') return;

    const escalated = pending.filter(c => c.judgeDecision === 'escalate');
    if (escalated.length) {
      const ok = window.confirm(
        `${escalated.length} change(s) were flagged for escalation by the safety judge:\n\n` +
        escalated.map(c => `• ${c.description}\n  Reason: ${c.escalation_reason ?? 'See risk flags'}`).join('\n\n') +
        '\n\nDeploy anyway?'
      );
      if (!ok) return;
    }

    setDeployStatus('deploying');
    try {
      const res = await adminFetch('/.netlify/functions/admin-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: pending }),
      });
      if (redirectToLoginIfUnauthorized(res)) return;
      const data = await res.json() as { results: { path: string; ok: boolean; error?: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Deploy failed');
      const failed = data.results.filter(r => !r.ok);
      if (failed.length) {
        setDeployStatus('error');
        setDeployResults(`${failed.length} file(s) failed to commit.`);
      } else {
        setDeployStatus('done');
        setDeployResults(`${pending.length} change(s) deployed. Site rebuilds in ~30s.`);
        setPending([]);
      }
    } catch {
      setDeployStatus('error');
      setDeployResults('Deploy failed. Check your connection and try again.');
    }
  }

  const deployLabel = {
    idle: `Deploy ${pending.length} Change${pending.length !== 1 ? 's' : ''}`,
    deploying: 'Deploying…',
    done: '✓ Live in ~30s',
    error: 'Deploy Failed',
  }[deployStatus];

  const hasEscalated = pending.some(c => c.judgeDecision === 'escalate');
  const filteredProducts = products.filter((product) => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return true;
    return [product.title, product.slug, product.category, product.status]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', height: 'calc(100vh - 60px)', gap: '1rem', padding: '1rem', fontFamily: 'inherit' }}>
      {/* Chat panel */}
      <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #333', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <span>Admin Chat</span>
          <button
            onClick={() => setShowHelp(true)}
            style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Help
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: m.role === 'user' ? '#E8540A' : '#222',
              color: '#fff',
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', color: '#888', fontSize: '0.85rem' }}>Thinking…</div>
          )}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid #333' }}>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: '#222', border: '1px solid #444', color: '#aaa', borderRadius: '6px', padding: '0 0.75rem', cursor: 'pointer', fontSize: '1.1rem' }}
            title="Upload image"
          >📎</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Type a change… (Enter to send)"
            style={{ flex: 1, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.9rem', outline: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0 1rem', cursor: 'pointer', fontWeight: 600 }}
          >→</button>
        </div>
      </div>

      {/* Admin tools panel */}
      <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#111', borderRadius: '8px', border: '1px solid #333' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #333' }}>
          {(['dashboard', 'products', 'media', 'homepage', 'enquiries', 'knowledge', 'pending'] as PanelTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? '#E8540A' : 'transparent',
                color: activeTab === tab ? '#fff' : '#aaa',
                border: 'none',
                borderRight: tab !== 'pending' ? '1px solid #333' : 'none',
                padding: '0.75rem 0.25rem',
                cursor: 'pointer',
                fontWeight: 700,
                textTransform: 'capitalize',
                fontSize: '0.72rem',
              }}
            >
              {tab === 'pending' ? `Pending (${pending.length})` : tab}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <AdminSectionBoundary>
            <AdminDashboard pendingCount={pending.length} />
          </AdminSectionBoundary>
        )}

        {activeTab === 'products' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: editProduct ? 0 : '0.45rem' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>{editProduct ? 'Edit Product' : 'Product Manager'}</div>
                  {editProduct && <div style={{ color: '#888', fontSize: '0.74rem', marginTop: '0.18rem' }}>{editProduct.slug}</div>}
                </div>
                {editProduct && (
                  <button onClick={() => setEditProduct(null)} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '0.42rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                    Back
                  </button>
                )}
              </div>
              {!editProduct && (
                <input
                  value={productFilter}
                  onChange={e => setProductFilter(e.target.value)}
                  placeholder="Search products..."
                  style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem 0.65rem', fontSize: '0.82rem', outline: 'none' }}
                />
              )}
            </div>
            {!editProduct && (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {productsLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading products...</p>}
                {!productsLoading && filteredProducts.map(product => (
                  <div key={product.slug} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)' }}>
                    <AdminProductThumb src={product.heroImage} title={product.title} />
                    <div style={{ padding: '0.65rem 0.7rem', minWidth: 0, display: 'grid', gap: '0.35rem', alignContent: 'center' }}>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.25 }}>{product.title}</div>
                      <div style={{ color: '#aaa', fontSize: '0.74rem' }}>
                        {product.price} · {product.category} · {product.status} · {product.galleryCount ?? 0} photos
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                        <button
                          onClick={() => startStructuredEdit(product)}
                          style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => requestProductUpdate(product, `This product has sold. Remove it from active product listings and make sure the old URL redirects to ${product.category === 'caravan' ? '/our-caravans/' : product.category === 'expedition' ? '/expedition/' : '/our-slide-on-campers/'}.`)}
                          style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                        >
                          Sold
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!productsLoading && filteredProducts.length === 0 && (
                  <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>No matching products</p>
                )}
              </div>
            )}
            {editProduct && (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.85rem', display: 'grid', gap: '0.6rem', alignContent: 'start', background: '#141414' }}>
                <input value={editProduct.title} onChange={e => setEditProduct(p => p && ({ ...p, title: e.target.value }))} placeholder="Title" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <input value={editProduct.price} onChange={e => setEditProduct(p => p && ({ ...p, price: e.target.value }))} placeholder="$72,000" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  <select value={editProduct.status} onChange={e => setEditProduct(p => p && ({ ...p, status: e.target.value as ProductStatus }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                    <option value="available">Available</option>
                    <option value="on-sale">On sale</option>
                    <option value="coming-soon">Coming soon</option>
                  </select>
                </div>
                <input value={editProduct.tagline} onChange={e => setEditProduct(p => p && ({ ...p, tagline: e.target.value }))} placeholder="Tagline" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr)', gap: '0.55rem', alignItems: 'center', border: '1px solid #333', borderRadius: '6px', padding: '0.45rem', background: '#101010' }}>
                  <ProductImagePreview src={editProduct.heroImage} title={`${editProduct.title} hero`} />
                  <div style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
                    <div style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 700 }}>Hero Image</div>
                    <input value={editProduct.heroImage} onChange={e => setEditProduct(p => p && ({ ...p, heroImage: e.target.value }))} placeholder="Hero image URL or path" style={{ minWidth: 0, background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', color: '#ddd', fontSize: '0.78rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.onSale} onChange={e => setEditProduct(p => p && ({ ...p, onSale: e.target.checked }))} />
                    On sale
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input type="checkbox" checked={editProduct.featured} onChange={e => setEditProduct(p => p && ({ ...p, featured: e.target.checked }))} />
                    Featured
                  </label>
                </div>
                <ProductGalleryEditor form={editProduct} onChange={setEditProduct} />
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div style={{ color: '#aaa', fontSize: '0.74rem', fontWeight: 700 }}>Related Products</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', maxHeight: '96px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px', padding: '0.45rem', background: '#101010' }}>
                    {products.filter(product => product.slug !== editProduct.slug).map(product => (
                      <label key={product.slug} style={{ color: '#ddd', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={editProduct.relatedSlugs.includes(product.slug)}
                          onChange={e => setEditProduct(p => {
                            if (!p) return p;
                            const relatedSlugs = e.target.checked
                              ? [...p.relatedSlugs, product.slug]
                              : p.relatedSlugs.filter(slug => slug !== product.slug);
                            return { ...p, relatedSlugs };
                          })}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <textarea value={editProduct.notes} onChange={e => setEditProduct(p => p && ({ ...p, notes: e.target.value }))} placeholder="Optional notes for copy/spec changes" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <button onClick={() => setEditProduct(null)} style={{ background: '#222', color: '#aaa', border: '1px solid #444', borderRadius: '6px', padding: '0.55rem', cursor: 'pointer', fontWeight: 700 }}>
                    Cancel
                  </button>
                  <button onClick={queueStructuredEdit} disabled={loading} style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.55rem', cursor: 'pointer', fontWeight: 700 }}>
                    Queue Edit
                  </button>
                </div>
              </div>
            )}
            {!editProduct && <div style={{ padding: '0.85rem', borderTop: '1px solid #333', display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.86rem' }}>Add Product Draft</div>
              <input value={newProduct.title} onChange={e => setNewProduct(p => ({ ...p, title: e.target.value }))} placeholder="Product title" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value as ProductCategory }))} style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
                  <option value="slide-on">Slide-on</option>
                  <option value="caravan">Caravan</option>
                  <option value="expedition">Expedition</option>
                </select>
                <input value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} placeholder="$72,000" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              </div>
              <input value={newProduct.tagline} onChange={e => setNewProduct(p => ({ ...p, tagline: e.target.value }))} placeholder="Short tagline" style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }} />
              <textarea value={newProduct.keySpecs} onChange={e => setNewProduct(p => ({ ...p, keySpecs: e.target.value }))} placeholder="Key specs, one per line" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
              <textarea value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder="Product description" rows={3} style={{ resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem', lineHeight: 1.4 }} />
              <button onClick={queueNewProduct} disabled={loading} style={{ background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem', cursor: 'pointer', fontWeight: 700 }}>
                Queue Product Draft
              </button>
            </div>}
          </div>
        )}

        {activeTab === 'media' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'grid', gap: '0.55rem' }}>
              <div style={{ color: '#fff', fontWeight: 700 }}>Media Manager</div>
              <select
                value={mediaSlug}
                onChange={e => setMediaSlug(e.target.value)}
                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.82rem' }}
              >
                {products.map(product => (
                  <option key={product.slug} value={product.slug}>{product.title}</option>
                ))}
              </select>
              <input
                value={mediaAlt}
                onChange={e => setMediaAlt(e.target.value)}
                placeholder="Alt text for uploaded image"
                style={{ background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.82rem' }}
              />
              <button
                onClick={() => mediaFileRef.current?.click()}
                disabled={!mediaSlug || mediaLoading}
                style={{ background: mediaSlug ? '#E8540A' : '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem', cursor: mediaSlug ? 'pointer' : 'not-allowed', fontWeight: 700 }}
              >
                Upload Image
              </button>
              <input ref={mediaFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={uploadMedia} />
              {mediaStatus && <p style={{ margin: 0, color: mediaStatus.includes('Could') || mediaStatus.includes('failed') || mediaStatus.includes('Unsupported') ? '#f87' : '#8f8', fontSize: '0.78rem' }}>{mediaStatus}</p>}
              <p style={{ margin: 0, color: '#888', fontSize: '0.76rem', lineHeight: 1.35 }}>
                Uploaded images are stored in Netlify Blobs and can be used as product hero or gallery images without adding files to Git.
              </p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.65rem', alignContent: 'start' }}>
              {mediaLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading media...</p>}
              {!mediaLoading && mediaFiles.length === 0 && (
                <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>No uploaded media for this product yet</p>
              )}
              {!mediaLoading && mediaFiles.map(file => (
                <div key={file.key} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', overflow: 'hidden' }}>
                  <img src={file.optimizedUrl} alt={file.metadata.alt ?? ''} style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '0.65rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ color: '#ddd', fontSize: '0.76rem', overflowWrap: 'anywhere' }}>{file.metadata.filename ?? file.key.split('/').pop()}</div>
                    {file.metadata.alt && <div style={{ color: '#888', fontSize: '0.72rem' }}>{file.metadata.alt}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem' }}>
                      <button onClick={() => applyMediaToProduct(file.url, 'hero')} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                        Hero
                      </button>
                      <button onClick={() => applyMediaToProduct(file.url, 'gallery')} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                        Gallery
                      </button>
                      <button onClick={() => deleteMedia(file.key)} style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'homepage' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'grid', gap: '0.45rem' }}>
              <div style={{ color: '#fff', fontWeight: 700 }}>Homepage Sections</div>
              <p style={{ color: '#888', fontSize: '0.78rem', lineHeight: 1.4, margin: 0 }}>
                Edit Recent Builds and customer testimonials. Changes are queued as structured JSON files for review before deployment.
              </p>
              {homepageStatus && (
                <p style={{ color: homepageStatus.startsWith('Fix') ? '#f87' : '#8f8', fontSize: '0.78rem', lineHeight: 1.35, margin: 0 }}>{homepageStatus}</p>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
              <section style={{ display: 'grid', gap: '0.55rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '0.9rem' }}>Recent Builds</h3>
                  <button onClick={addRecentBuild} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.38rem 0.55rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                    Add
                  </button>
                </div>
                {orderedItems(recentBuilds).map((build, index) => (
                  <div key={build.id} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', padding: '0.7rem', display: 'grid', gap: '0.45rem' }}>
                    {build.image && <img src={adminImageUrl(build.image)} alt="" style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px' }} />}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.35rem', alignItems: 'center' }}>
                      <input value={build.title} onChange={e => updateRecentBuild(build.id, { title: e.target.value })} placeholder="Build title" style={{ minWidth: 0, background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <button onClick={() => moveRecentBuild(build.id, -1)} disabled={index === 0} style={{ background: '#222', color: index === 0 ? '#555' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
                      <button onClick={() => moveRecentBuild(build.id, 1)} disabled={index === recentBuilds.length - 1} style={{ background: '#222', color: index === recentBuilds.length - 1 ? '#555' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: index === recentBuilds.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
                      <button onClick={() => removeRecentBuild(build.id)} style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer' }}>×</button>
                    </div>
                    <select
                      value={build.productSlug ?? ''}
                      onChange={e => applyProductToRecentBuild(build.id, e.target.value)}
                      style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }}
                    >
                      <option value="">Use product hero image...</option>
                      {products.map(product => (
                        <option key={product.slug} value={product.slug}>{product.title}</option>
                      ))}
                    </select>
                    <input value={build.image} onChange={e => updateRecentBuild(build.id, { image: e.target.value })} placeholder="Image path" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    <input value={build.alt} onChange={e => updateRecentBuild(build.id, { alt: e.target.value })} placeholder="Image alt text" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    <input value={build.link ?? ''} onChange={e => updateRecentBuild(build.id, { link: e.target.value })} placeholder="/product-link/" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    <textarea
                      value={build.tags.join('\n')}
                      onChange={e => updateRecentBuild(build.id, { tags: e.target.value.split('\n') })}
                      placeholder="Tags, one per line"
                      rows={3}
                      style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem', lineHeight: 1.35 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ddd', fontSize: '0.76rem' }}>
                      <input type="checkbox" checked={build.isVisible} onChange={e => updateRecentBuild(build.id, { isVisible: e.target.checked })} />
                      Show on homepage
                    </label>
                  </div>
                ))}
              </section>

              <section style={{ display: 'grid', gap: '0.55rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '0.9rem' }}>Testimonials</h3>
                  <button onClick={addTestimonial} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.38rem 0.55rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                    Add
                  </button>
                </div>
                {orderedItems(testimonials).map((testimonial, index) => (
                  <div key={testimonial.id} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', padding: '0.7rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.35rem', alignItems: 'center' }}>
                      <input value={testimonial.customerName} onChange={e => updateTestimonial(testimonial.id, { customerName: e.target.value })} placeholder="Customer display name" style={{ minWidth: 0, background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <button onClick={() => moveTestimonial(testimonial.id, -1)} disabled={index === 0} style={{ background: '#222', color: index === 0 ? '#555' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
                      <button onClick={() => moveTestimonial(testimonial.id, 1)} disabled={index === testimonials.length - 1} style={{ background: '#222', color: index === testimonials.length - 1 ? '#555' : '#fff', border: '1px solid #444', borderRadius: '5px', padding: '0.42rem', cursor: index === testimonials.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
                      <button onClick={() => removeTestimonial(testimonial.id)} style={{ background: '#2a1410', color: '#fb923c', border: '1px solid #63301f', borderRadius: '5px', padding: '0.42rem', cursor: 'pointer' }}>×</button>
                    </div>
                    <textarea
                      value={testimonial.quote}
                      onChange={e => updateTestimonial(testimonial.id, { quote: e.target.value })}
                      placeholder="Exact customer quote"
                      rows={4}
                      style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem', lineHeight: 1.35 }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <input value={testimonial.productName ?? ''} onChange={e => updateTestimonial(testimonial.id, { productName: e.target.value })} placeholder="Product/build" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <input value={testimonial.customerLocation ?? ''} onChange={e => updateTestimonial(testimonial.id, { customerLocation: e.target.value })} placeholder="Location" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: '0.4rem' }}>
                      <input value={testimonial.source ?? ''} onChange={e => updateTestimonial(testimonial.id, { source: e.target.value })} placeholder="Source or approval note" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                      <input type="number" min={1} max={5} value={testimonial.rating ?? ''} onChange={e => updateTestimonial(testimonial.id, { rating: e.target.value ? Number(e.target.value) : undefined })} placeholder="Rating" style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '5px', padding: '0.45rem', fontSize: '0.76rem' }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ddd', fontSize: '0.76rem' }}>
                      <input type="checkbox" checked={testimonial.isVisible} onChange={e => updateTestimonial(testimonial.id, { isVisible: e.target.checked })} />
                      Show on homepage
                    </label>
                  </div>
                ))}
              </section>
            </div>
            <div style={{ padding: '0.75rem', borderTop: '1px solid #333' }}>
              <button onClick={queueHomepageUpdate} style={{ width: '100%', background: '#E8540A', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>
                Queue Homepage Updates
              </button>
            </div>
          </div>
        )}

        {activeTab === 'enquiries' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700 }}>Recent Enquiries</div>
                <div style={{ color: '#888', fontSize: '0.76rem', marginTop: '0.2rem' }}>Stored contact form submissions</div>
              </div>
              <button
                onClick={loadEnquiries}
                disabled={enquiriesLoading}
                style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}
              >
                Refresh
              </button>
            </div>
            {contactConfig && (
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #333', background: contactConfig.ready ? '#102416' : '#2a1410', color: contactConfig.ready ? '#8f8' : '#fb923c', fontSize: '0.78rem', lineHeight: 1.45 }}>
                {contactConfig.ready
                  ? `Email notifications are configured for ${contactConfig.toEmail}.`
                  : `Email notifications need setup. Missing: ${contactConfig.missing.join(', ')}.`}
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gap: '0.65rem', alignContent: 'start' }}>
              {enquiriesStatus && <p style={{ color: '#fb923c', fontSize: '0.85rem', lineHeight: 1.45 }}>{enquiriesStatus}</p>}
              {enquiriesLoading && <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>Loading enquiries...</p>}
              {!enquiriesLoading && enquiries.length === 0 && (
                <p style={{ color: '#777', fontSize: '0.85rem', textAlign: 'center' }}>
                  No stored enquiries yet. Email notifications may still have been sent.
                </p>
              )}
              {!enquiriesLoading && enquiries.map(enquiry => (
                <div key={enquiry.id} style={{ background: '#1a1a1a', border: '1px solid #303030', borderRadius: '6px', padding: '0.75rem', display: 'grid', gap: '0.4rem' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>{enquiry.name}</div>
                  <div style={{ color: '#aaa', fontSize: '0.76rem' }}>
                    {new Date(enquiry.submittedAt).toLocaleString()} · {enquiry.product_interest || 'General enquiry'}
                  </div>
                  <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.78rem' }}>
                    <a href={`tel:${enquiry.phone}`} style={{ color: '#E8540A', textDecoration: 'none' }}>{enquiry.phone}</a>
                    <a href={`mailto:${enquiry.email}`} style={{ color: '#E8540A', textDecoration: 'none' }}>{enquiry.email}</a>
                  </div>
                  {(enquiry.callback_date || enquiry.callback_time) && (
                    <div style={{ color: '#ccc', fontSize: '0.76rem' }}>
                      Callback: {[enquiry.callback_date, enquiry.callback_time].filter(Boolean).join(' ')}
                    </div>
                  )}
                  <div style={{ color: '#ddd', fontSize: '0.78rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{enquiry.message}</div>
                  {enquiry.referral_source_self_reported && (
                    <div style={{ color: '#777', fontSize: '0.72rem' }}>
                      Heard about us: {enquiry.referral_source_self_reported}{enquiry.referral_source_other ? ` - ${enquiry.referral_source_other}` : ''}
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid #303030', marginTop: '0.25rem', paddingTop: '0.55rem', display: 'grid', gap: '0.45rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                      <select
                        value={enquiry.leadStatus?.status ?? 'new'}
                        onChange={e => saveLeadStatus(enquiry, { status: e.target.value as NonNullable<EnquiryRecord['leadStatus']>['status'] })}
                        disabled={leadSaving === enquiry.id}
                        style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="quoted">Quoted</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                        <option value="spam">Spam</option>
                      </select>
                      <input
                        type="date"
                        value={enquiry.leadStatus?.nextFollowUpDate ?? enquiry.callback_date ?? ''}
                        onChange={e => saveLeadStatus(enquiry, { nextFollowUpDate: e.target.value })}
                        disabled={leadSaving === enquiry.id}
                        style={{ background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem' }}
                      />
                    </div>
                    <textarea
                      value={enquiry.leadStatus?.notes ?? ''}
                      onChange={e => setEnquiries(prev => prev.map(item => item.id === enquiry.id ? {
                        ...item,
                        leadStatus: {
                          enquiryId: enquiry.id,
                          status: item.leadStatus?.status ?? 'new',
                          nextFollowUpDate: item.leadStatus?.nextFollowUpDate ?? item.callback_date ?? '',
                          updatedAt: item.leadStatus?.updatedAt ?? item.submittedAt,
                          notes: e.target.value,
                        },
                      } : item))}
                      onBlur={e => saveLeadStatus(enquiry, { notes: e.target.value })}
                      placeholder="Lead notes"
                      rows={2}
                      disabled={leadSaving === enquiry.id}
                      style={{ resize: 'vertical', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.45rem', fontSize: '0.76rem', lineHeight: 1.35 }}
                    />
                    {leadSaving === enquiry.id && (
                      <div style={{ color: '#777', fontSize: '0.72rem' }}>Saving lead status...</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div style={{ padding: '1rem', overflowY: 'auto' }}>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: '0.45rem' }}>Chatbot Knowledge</div>
            <p style={{ color: '#888', fontSize: '0.82rem', lineHeight: 1.45, margin: '0 0 0.7rem' }}>
              Add facts the website chatbot should know about the business, stock, process, or policies.
            </p>
            <textarea
              value={knowledgeInput}
              onChange={e => setKnowledgeInput(e.target.value)}
              placeholder="Example: Customers can inspect campers by appointment at Mutdapilly. Ask them to call first."
              rows={9}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: '#1a1a1a', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.65rem', fontSize: '0.84rem', lineHeight: 1.45, outline: 'none' }}
            />
            <button
              onClick={queueKnowledgeUpdate}
              disabled={loading || !knowledgeInput.trim()}
              style={{ width: '100%', marginTop: '0.6rem', background: knowledgeInput.trim() ? '#E8540A' : '#333', color: knowledgeInput.trim() ? '#fff' : '#666', border: 'none', borderRadius: '6px', padding: '0.65rem', cursor: knowledgeInput.trim() ? 'pointer' : 'not-allowed', fontWeight: 700 }}
            >
              Queue Knowledge Update
            </button>
          </div>
        )}

        {activeTab === 'pending' && (
          <>
            <div style={{ padding: '1rem', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: '#fff' }}>Pending Changes ({pending.length})</span>
              {hasEscalated && (
                <span style={{ fontSize: '0.7rem', background: '#3a2010', color: '#fb923c', padding: '2px 6px', borderRadius: '4px' }}>
                  ⚠ Needs review
                </span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pending.length === 0 && (
                <p style={{ color: '#555', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>No changes yet</p>
              )}
              {pending.map((c, i) => {
                const vs = VERDICT_STYLE[c.judgeDecision] ?? VERDICT_STYLE.allow;
                return (
                  <div key={i} style={{ background: '#1a1a1a', border: vs.border, borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ color: '#E8540A' }}>✏️ {c.path.split('/').pop()}</span>
                      <span style={{ color: vs.color, fontSize: '0.7rem', fontWeight: 600 }}>{vs.label}</span>
                    </div>
                    <div style={{ color: '#ccc', lineHeight: 1.4 }}>{c.description}</div>
                    {c.judgeDecision === 'escalate' && c.escalation_reason && (
                      <div style={{ color: '#fb923c', fontSize: '0.72rem', marginTop: '0.3rem', lineHeight: 1.3 }}>
                        ⚠ {c.escalation_reason}
                      </div>
                    )}
                    {c.risk_flags?.length > 0 && c.judgeDecision !== 'allow' && (
                      <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                        Flags: {c.risk_flags.join(', ')}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.45rem' }}>
                      <button
                        onClick={() => setPreviewChange(c)}
                        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                      >Preview</button>
                      <button
                        onClick={() => setPending(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                      >✕ remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '0.75rem', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {deployResults && (
                <p style={{ fontSize: '0.8rem', color: deployStatus === 'error' ? '#f87' : '#8f8', margin: 0 }}>{deployResults}</p>
              )}
              <button
                onClick={deploy}
                disabled={pending.length === 0 || deployStatus === 'deploying'}
                style={{
                  background: pending.length === 0 ? '#333' : hasEscalated ? '#7c3a10' : '#E8540A',
                  color: pending.length === 0 ? '#666' : '#fff',
                  border: hasEscalated ? '1px solid #fb923c' : 'none',
                  borderRadius: '6px',
                  padding: '0.7rem',
                  fontWeight: 700,
                  cursor: pending.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >{hasEscalated ? `⚠ ${deployLabel}` : deployLabel}</button>
              {deployStatus === 'done' && (
                <button
                  onClick={() => { setDeployStatus('idle'); setDeployResults(''); }}
                  style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}
                >Make more changes</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    {showHelp && (
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div style={{ width: 'min(860px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #333', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Admin Help</h2>
            <button
              onClick={() => setShowHelp(false)}
              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: '1rem 1.1rem 1.2rem', display: 'grid', gap: '1rem', fontSize: '0.9rem', lineHeight: 1.55 }}>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>How the admin works</h3>
              <p style={{ margin: 0, color: '#ddd' }}>
                The admin has two jobs: show the owner what needs attention, and prepare safe site changes for review. Dashboard, Enquiries, and Media save operational data directly. Product, homepage, content, and chatbot changes are queued in Pending Changes so they can be previewed before deployment.
              </p>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Read the dashboard</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open Dashboard first. It summarises product stock, listed value, recent leads, due follow-ups, email readiness, and pending changes.</li>
                <li>Use the 7, 30, and 90 day buttons to change the reporting window for lead and analytics signals.</li>
                <li>Check Due Follow-Ups first. Overdue follow-ups need action before browsing product statistics.</li>
                <li>Check Email Delivery and Launch Readiness. Red items are setup blockers, orange items are warnings, and green items are ready.</li>
                <li>Use Products Needing Attention to find weak listings, stale stock, or products that need better photos or copy.</li>
                <li>Use Product Interest, Funnel, and Traffic Quality to understand which products and marketing sources are producing enquiries.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Manage enquiries and follow-ups</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open Enquiries to see contact form submissions backed up from the website.</li>
                <li>Use the phone and email links to contact the customer.</li>
                <li>Set the lead status to New, Contacted, Quoted, Won, Lost, or Spam.</li>
                <li>Set the follow-up date for the next call or email. Due and overdue items appear on Dashboard.</li>
                <li>Add short notes after each contact attempt, quote, or outcome. Do not store passwords, payment details, or unnecessary private information.</li>
                <li>Marking a lead Won does not automatically remove a product from the website. Use Products or Admin Chat to make stock changes deliberately.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Update a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open the Products tab and search for the product, or type the product name directly in chat.</li>
                <li>Use Edit to change safe fields like price, status, tagline, sale state, featured state, hero image, gallery order, or related products.</li>
                <li>Use Gallery Photos to see the images in order. Move photos up or down, remove photos, add a new image path, or set a gallery photo as the hero image.</li>
                <li>Use the notes box for copy or spec changes that need more explanation.</li>
                <li>Wait for the assistant to read the current product file and queue the proposed change.</li>
                <li>Open Pending, use Preview to inspect the generated file, and remove anything that looks wrong.</li>
                <li>Click Deploy. The live site usually updates after the Netlify rebuild completes.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Upload product photos</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open the Media tab and choose the product.</li>
                <li>Add short alt text, then upload a JPG, PNG, WebP, or GIF image up to 12MB.</li>
                <li>The uploaded image is stored in Netlify Blobs, so it does not need to be committed to Git.</li>
                <li>Use Hero to prepare that image as the main product image, or Gallery to add it to the product gallery list.</li>
                <li>Open Pending, preview the product file, then deploy when the image order is correct.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Update homepage proof sections</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open the Homepage tab to edit Recent Builds and customer testimonials.</li>
                <li>For Recent Builds, use a product hero image or paste an approved image path, then update the title, alt text, link, tags, and visibility.</li>
                <li>Use the arrow buttons to reorder cards. Hidden cards stay in the data file but do not appear on the homepage.</li>
                <li>For Testimonials, enter only real customer-provided wording. Do not invent names, quotes, or ratings.</li>
                <li>Click Queue Homepage Updates, then open Pending to preview the JSON files before deploying.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Add a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Use Add Product Draft in the Products tab.</li>
                <li>Provide the product title, price, category, tagline, main specs, description, and selling points.</li>
                <li>The assistant will create a draft product file using the existing product format.</li>
                <li>Upload real product photos in Media, then use Hero or Gallery to add those images to the draft.</li>
                <li>Use Preview in Pending and deploy only after the new product path, price, specs, and image order have been checked.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Remove or sell a product</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open the Products tab and click Sold on the matching product.</li>
                <li>Confirm whether it should be removed from listings or kept as coming soon.</li>
                <li>The assistant should remove it from active product content and make sure old links redirect to a relevant category page.</li>
                <li>Review the pending product and redirect changes before deploying.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Teach the chatbot</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Use the Chatbot Knowledge box for facts that apply across the business, not just one product.</li>
                <li>Add short, factual notes about process, appointments, stock, delivery, policy, warranty, or common customer questions.</li>
                <li>Do not add passwords, API keys, private customer details, or anything the public should not see.</li>
                <li>Click Queue Knowledge Update, review the pending change, then Deploy.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Deploy pending changes</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#ddd' }}>
                <li>Open Pending after asking the assistant to change a product, page, redirect, or chatbot knowledge.</li>
                <li>Use Preview to inspect the complete proposed file content before deployment.</li>
                <li>Remove any change that looks wrong or unclear.</li>
                <li>If a change is flagged for review, read the reason carefully before deciding whether to deploy.</li>
                <li>Click Deploy only when the queued changes match the intended business change. The live site normally updates after the Netlify rebuild finishes.</li>
              </ol>
            </section>
            <section>
              <h3 style={{ margin: '0 0 0.4rem', color: '#E8540A', fontSize: '1rem' }}>Best practice</h3>
              <p style={{ margin: 0, color: '#ddd' }}>
                Start each session by checking Dashboard and Enquiries. Keep product/content edits small, use exact product names and prices, and preview every queued file before deployment. Treat the dashboard value as an estimate, not accounting data, and keep customer notes factual and brief.
              </p>
            </section>
          </div>
        </div>
      </div>
    )}
    {previewChange && (
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div style={{ width: 'min(980px, 100%)', maxHeight: '88vh', overflow: 'hidden', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ borderBottom: '1px solid #333', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Pending File Preview</h2>
              <p style={{ margin: '0.25rem 0 0', color: '#888', fontSize: '0.8rem' }}>{previewChange.path}</p>
            </div>
            <button
              onClick={() => setPreviewChange(null)}
              style={{ background: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '0.4rem 0.65rem', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #333', color: '#ddd', fontSize: '0.85rem', lineHeight: 1.45 }}>
            {previewChange.description}
          </div>
          <pre style={{ margin: 0, padding: '1rem', overflow: 'auto', color: '#ddd', background: '#0b0b0b', fontSize: '0.78rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
            {previewChange.content}
          </pre>
        </div>
      </div>
    )}
    </>
  );
}
