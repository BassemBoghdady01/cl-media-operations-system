import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, AlignLeft, Hash, Zap, Target, Calendar,
  Copy, Check, RefreshCw, ChevronDown, ArrowRight,
  Film, Lightbulb, BarChart2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerationInput {
  company: string
  industry: string
  description: string
  audience: string
  product: string
  goal: string
  platform: string
  tone: string
  count: number
}

interface ContentIdea {
  id: number
  title: string
  angle: string
  hook: string
  visualDirection: string
  onScreenText: string[]
  cta: string
  duration: string
  format: string
}

interface ReelScript {
  title: string
  hook: string
  scenes: { time: string; visual: string; voiceover: string; text: string }[]
  cta: string
  shotList: string[]
  caption: string
  hashtags: string[]
}

interface Caption { main: string; short: string; hashtags: string[] }
interface Hook { text: string; type: string; explanation: string }
interface CampaignAngle { name: string; angle: string; why: string; contentFormats: string[] }

// ─── Generation Engine ────────────────────────────────────────────────────────

const INDUSTRY_HOOKS: Record<string, string[]> = {
  'Real Estate': [
    'Have you seen what\'s happening in New Capital right now?',
    'Why are Egypt\'s top investors choosing [COMPANY] in 2024?',
    'The commercial opportunity most business owners are missing...',
    'I analyzed 50 projects — here\'s why [COMPANY] stands out.',
    'If you haven\'t heard about [COMPANY] yet, you need to watch this.',
    'This is what smart money looks like in Egypt right now.',
    'The business address that changes everything.',
    'Your competition just signed a unit here. Will you?',
    'Cairo\'s next business hub is already sold out — except [COMPANY].',
    'The #1 question investors are asking in 2024? About [COMPANY].',
  ],
  'Fashion': [
    'Your summer wardrobe is missing one thing...',
    'We need to talk about Egyptian fashion in 2024.',
    'POV: You just discovered your new favorite brand.',
    'Every outfit tells a story. What\'s yours?',
    'Stop scrolling — this changed how I see [COMPANY] forever.',
    '[COMPANY] just dropped something nobody expected.',
    'This is what confidence looks like.',
    'I wore this to 7 events. Everyone asked where it\'s from.',
    'The collection that\'s already selling out.',
    'Cairo fashion week energy in one brand.',
  ],
  'Food & Beverage': [
    'I can\'t stop thinking about this dish from [COMPANY].',
    'The secret ingredient? [COMPANY] never tells — but we will.',
    'Cairo foodies, you need to try this immediately.',
    'This is what comfort food looks like in 2024.',
    'The menu item everyone is ordering at [COMPANY].',
    'I\'ve been to [COMPANY] 5 times this month. Here\'s why.',
    'Your lunch break just got an upgrade.',
    'New menu, same love. [COMPANY] changes the game again.',
    'The food review nobody asked for — but everyone needed.',
    'When the food is this good, you don\'t need filters.',
  ],
  'Technology': [
    'This product is changing how Egypt does business.',
    'I tested [PRODUCT] for 30 days. Here\'s the honest truth.',
    'The tech tool Egyptian entrepreneurs are sleeping on.',
    'What if one decision could save your business 10 hours a week?',
    'Stop using outdated tools — [COMPANY] just changed everything.',
    'The future of [INDUSTRY] in Egypt is already here.',
    'Why every startup in Cairo is switching to [COMPANY].',
    'The ROI of [PRODUCT] is honestly shocking.',
    'Engineers who saw this said "we needed this 5 years ago."',
    '[COMPANY] just solved the problem nobody could fix.',
  ],
  'Fitness': [
    'Transformation story that actually hits different.',
    'I trained at [COMPANY] for 90 days. Honest review.',
    'The only gym in Cairo where excuses don\'t survive.',
    'Your body is capable of more than you think.',
    'No filter, no edit, no excuses. Just results at [COMPANY].',
    'The community you didn\'t know you needed.',
    'This is what 60 days of commitment looks like.',
    'Coach at [COMPANY] said one thing that changed my training.',
    'They said it was too hard. Watch this.',
    '6 AM at [COMPANY]. This is why I love Mondays.',
  ],
  'Hospitality': [
    'This is what luxury feels like at [COMPANY].',
    'The hidden gem of [LOCATION] that nobody talks about.',
    'I stayed at [COMPANY] and honestly? I didn\'t want to leave.',
    'When service becomes an experience.',
    'The breakfast view alone is worth the trip.',
    'Your next staycation is already planned — it\'s [COMPANY].',
    'Behind the scenes of [COMPANY]\'s most iconic suite.',
    'Why [COMPANY] has 5-star reviews across the board.',
    'The experience you\'ll be talking about for years.',
    'Luxury doesn\'t have to be complicated. [COMPANY] proves it.',
  ],
}

const CONTENT_IDEAS_BY_INDUSTRY: Record<string, Record<string, ContentIdea[]>> = {
  'Real Estate': {
    'Attract Investors': [
      {
        id: 1, format: 'Reel', duration: '0:30',
        title: '[COMPANY] Project Walk-Through — New Capital',
        angle: 'Exclusive behind-the-scenes tour of flagship project',
        hook: 'Have you seen what [COMPANY] is building in New Capital?',
        visualDirection: 'Drone wide shot → lobby walk → unit interiors → rooftop view',
        onScreenText: ['📍 New Capital, Egypt', 'Administrative Mall', 'Units from 45m²', 'Ready Q4 2025'],
        cta: 'DM us "INVEST" to get the full project brochure',
      },
      {
        id: 2, format: 'Reel', duration: '0:45',
        title: 'Why Smart Money is Moving to [PRODUCT]',
        angle: 'ROI comparison: [COMPANY] vs traditional investment',
        hook: 'Every smart investor in Egypt is asking the same question in 2024...',
        visualDirection: 'Talking-head CEO → project renders → market data overlays → success client testimonial',
        onScreenText: ['15-25% projected ROI', 'Prime New Capital location', 'Commercial + Administrative', 'Limited units available'],
        cta: 'Book a free consultation → link in bio',
      },
      {
        id: 3, format: 'Reel', duration: '0:30',
        title: 'The Business Address That Changes Everything',
        angle: 'Prestige play — the value of being in the right place',
        hook: 'Your business address tells investors everything about you.',
        visualDirection: 'Sleek office drone shots → suited professionals entering building → [COMPANY] lobby',
        onScreenText: ['New Capital Business Hub', '[COMPANY] Administrative Mall', 'Where serious business happens'],
        cta: 'Your unit is waiting — reach out today',
      },
      {
        id: 4, format: 'Short', duration: '1:00',
        title: 'Investor Testimonial — First Year Returns at [COMPANY]',
        angle: 'Social proof from existing investor — authentic, unscripted',
        hook: 'He invested in [COMPANY] 18 months ago. Here\'s what happened.',
        visualDirection: 'Client interview → property shots → return data overlay → handshake closing shot',
        onScreenText: ['Real investor, real results', 'Name + title overlay', '[COMPANY] client since 2023'],
        cta: 'Want results like this? DM us now',
      },
      {
        id: 5, format: 'Reel', duration: '0:30',
        title: '3 Reasons Business Owners Choose [COMPANY]',
        angle: 'Decision-simplification — remove friction for undecided investors',
        hook: 'Still deciding where to put your business? 3 reasons [COMPANY] wins.',
        visualDirection: 'Text-forward motion graphic → each point with project footage',
        onScreenText: ['✓ Prime location', '✓ Flexible payment plans', '✓ Proven developer track record'],
        cta: 'See full project details → link in bio',
      },
    ],
    'Brand Awareness': [
      {
        id: 1, format: 'Reel', duration: '0:30',
        title: '[COMPANY] — Redefining Commercial Real Estate in Egypt',
        angle: 'Brand story — who we are and what we stand for',
        hook: 'Not every developer builds the same. Here\'s what makes [COMPANY] different.',
        visualDirection: 'Brand identity intro → project montage → team behind it → tagline',
        onScreenText: ['[COMPANY]', 'Building Tomorrow\'s Business Districts', 'Since [YEAR]'],
        cta: 'Follow for project updates and market insights',
      },
      {
        id: 2, format: 'Reel', duration: '0:45',
        title: 'Behind the Build — How [COMPANY] Creates Its Projects',
        angle: 'Transparency and craftsmanship story',
        hook: 'Most developers show you the finish. We\'ll show you how we get there.',
        visualDirection: 'Construction time-lapse → architect walkthrough → materials close-ups → finished space',
        onScreenText: ['Quality is our standard', 'Not a promise — a process'],
        cta: 'See more on our profile',
      },
    ],
    'Lead Generation': [
      {
        id: 1, format: 'Reel', duration: '0:30',
        title: 'Everything You Need to Know About [PRODUCT] in 90 Seconds',
        angle: 'FAQ-style education — remove knowledge barriers',
        hook: 'You have questions about [COMPANY]\'s new project. Let\'s answer them all.',
        visualDirection: 'Q&A motion graphic → project footage supporting each answer',
        onScreenText: ['Q: Price range?', 'Q: Location?', 'Q: Payment plan?', 'Q: Delivery date?'],
        cta: 'Got more questions? DM us directly',
      },
    ],
  },
  'Fashion': {
    'Brand Awareness': [
      {
        id: 1, format: 'Reel', duration: '0:30',
        title: '[COMPANY] Summer Drop — The Collection Cairo Is Talking About',
        angle: 'New collection reveal — energy and exclusivity',
        hook: '[COMPANY] just dropped the summer collection you didn\'t know you needed.',
        visualDirection: 'Model walking in golden light → close-ups of fabric → flat lay → model wearing full look',
        onScreenText: ['[COMPANY]', 'Summer 2025 Collection', 'Available now'],
        cta: 'Shop the collection → link in bio',
      },
      {
        id: 2, format: 'Reel', duration: '0:30',
        title: 'The Signature Piece — One Outfit, 5 Ways',
        angle: 'Versatility showcase — value-driven content',
        hook: 'You only need one piece from [COMPANY] to transform your entire wardrobe.',
        visualDirection: 'Same item styled 5 different ways — fast cuts — different models/settings',
        onScreenText: ['1 Piece', '5 Outfits', 'Endless possibilities'],
        cta: 'Get yours before it sells out',
      },
    ],
    'Sales': [
      {
        id: 1, format: 'Reel', duration: '0:30',
        title: 'Limited Drop — Only 50 Pieces. Here\'s Why You Need One.',
        angle: 'Scarcity + urgency — fear of missing out',
        hook: '[COMPANY] made only 50 of these. Watch before they\'re gone.',
        visualDirection: 'Close-up of item → countdown-style text → sold-out notifications → last units remaining',
        onScreenText: ['Only 50 pieces', '⚡ 38 sold in 24h', 'Last 12 remaining'],
        cta: 'Order NOW → link in bio',
      },
    ],
  },
  'Food & Beverage': {
    'Sales': [
      {
        id: 1, format: 'Reel', duration: '0:30',
        title: 'The Dish Everyone Orders at [COMPANY] (For Good Reason)',
        angle: 'Hero product spotlight — social proof through popularity',
        hook: 'The #1 dish at [COMPANY]? This is why it never leaves the menu.',
        visualDirection: 'Kitchen prep ASMR → plating close-up → customer reaction → satisfied first bite',
        onScreenText: ['[COMPANY]\'s #1 bestseller', 'The [dish name]', 'Order online now'],
        cta: 'Order today → link in bio or call us',
      },
      {
        id: 2, format: 'Reel', duration: '0:45',
        title: '[COMPANY] Ramadan Special — Limited Menu Inside',
        angle: 'Seasonal urgency — Ramadan/seasonal positioning',
        hook: 'Every year people wait for this. [COMPANY]\'s Ramadan special is finally back.',
        visualDirection: 'Warm golden tones → Ramadan decorations → full spread reveal → family-style setting',
        onScreenText: ['Ramadan 2025', 'Limited menu', 'Book your table now'],
        cta: 'Reserve your table → DM or call',
      },
    ],
  },
}

function getIdeas(input: GenerationInput): ContentIdea[] {
  const industryMap = CONTENT_IDEAS_BY_INDUSTRY[input.industry] ?? CONTENT_IDEAS_BY_INDUSTRY['Real Estate']
  const goalMap = industryMap[input.goal] ?? Object.values(industryMap)[0] ?? []
  const base = goalMap.slice(0, input.count)
  return base.map((idea) => ({
    ...idea,
    title: idea.title.replace(/\[COMPANY\]/g, input.company).replace(/\[PRODUCT\]/g, input.product || input.company),
    angle: idea.angle.replace(/\[COMPANY\]/g, input.company),
    hook: idea.hook.replace(/\[COMPANY\]/g, input.company).replace(/\[PRODUCT\]/g, input.product || input.company),
    onScreenText: idea.onScreenText.map((t) => t.replace(/\[COMPANY\]/g, input.company)),
    cta: idea.cta.replace(/\[COMPANY\]/g, input.company),
  }))
}

function generateScript(input: GenerationInput): ReelScript {
  const hooks = (INDUSTRY_HOOKS[input.industry] ?? INDUSTRY_HOOKS['Real Estate'])
  const hook = hooks[0].replace(/\[COMPANY\]/g, input.company).replace(/\[PRODUCT\]/g, input.product)

  const industryScripts: Record<string, ReelScript> = {
    'Real Estate': {
      title: `${input.company} — Why Investors Are Moving Here`,
      hook,
      scenes: [
        { time: '0–3s', visual: 'Aerial drone shot of project site / completed towers', voiceover: hook, text: '📍 New Capital, Egypt' },
        { time: '3–8s', visual: 'Walking through the lobby or main entrance', voiceover: `${input.company} isn't just another building. It's the commercial address that changes your business.`, text: 'Administrative & Commercial Units' },
        { time: '8–18s', visual: 'Close-up on unit interiors, finishes, windows with city view', voiceover: `With units starting from ${input.product || '45m²'}, designed for the serious business owner.`, text: `Units from 45m² | Prime Location | Flexible Payment` },
        { time: '18–25s', visual: 'Business people working inside unit — aspirational B-roll', voiceover: `${input.audience ? `Built for ${input.audience}.` : ''} Built to last.`, text: 'Your competition is already here.' },
        { time: '25–30s', visual: 'Logo end card with CTA', voiceover: `DM us today to get the full project brochure.`, text: 'DM "INVEST" for full details → @' + input.company.toLowerCase().replace(/\s/g, '') },
      ],
      cta: `DM "${input.company.split(' ')[0].toUpperCase()}" for full project details and payment plans`,
      shotList: [
        'Aerial drone wide shot of project + surroundings',
        'Lobby entrance walkthrough — tracking shot',
        'Unit interior — windows, finishes, space',
        'Business professional at desk in unit (lifestyle)',
        'Rooftop or common area with city view',
        'Building facade — golden hour',
        'Logo/branding end card',
      ],
      caption: `The smart money in Egypt is already here. ⬇️\n\n${input.company} — the commercial hub redefining business in New Capital.\n\nWhether you're an investor looking for high ROI or a business owner ready to level up your address — this is where it starts.\n\n✅ Prime New Capital location\n✅ Administrative & commercial units\n✅ Flexible payment plans\n✅ Proven developer\n\nBook your free consultation today 👇\nDM us or visit the link in bio.`,
      hashtags: [`#${input.company.replace(/\s/g, '')}`, '#NewCapital', '#RealEstate', '#EgyptInvestment', '#CommercialRealEstate', '#بيزنس', '#العاصمة_الإدارية', '#استثمار_عقاري', '#مكاتب_للبيع'],
    },
    'Fashion': {
      title: `${input.company} — New Drop`,
      hook,
      scenes: [
        { time: '0–3s', visual: 'Model close-up — eye contact with camera', voiceover: hook, text: input.company },
        { time: '3–10s', visual: 'Full outfit reveal — spinning shot', voiceover: `This is the piece ${input.audience || 'everyone'} has been asking for.`, text: 'New Collection — Available Now' },
        { time: '10–22s', visual: 'Multiple outfit transitions — fast cuts with trending audio', voiceover: 'Designed in Cairo. Made for the world.', text: 'Summer 2025 | Limited Stock' },
        { time: '22–28s', visual: 'Lifestyle shot — model in real setting', voiceover: `${input.company}. Style that says everything without saying a word.`, text: 'Wear your story.' },
        { time: '28–30s', visual: 'Product close-up + logo', voiceover: 'Shop now — link in bio.', text: 'Link in bio → @' + input.company.toLowerCase().replace(/\s/g, '') },
      ],
      cta: 'Shop now → link in bio. Free shipping on orders over 500 EGP.',
      shotList: [
        'Close-up eye contact intro shot',
        'Full outfit 360 spin',
        '3–5 quick outfit transition cuts',
        'Lifestyle B-roll (café, street, rooftop)',
        'Fabric close-up texture shots',
        'Product flat lay',
        'Branded end card',
      ],
      caption: `This is the summer piece you didn\'t know you needed. ☀️\n\nIntroducing [item] from ${input.company}\'s new collection — where Egyptian identity meets modern style.\n\nLimited stock. First come, first served. 🔗 Link in bio.\n\n📦 Free delivery across Egypt\n🔄 Easy returns\n✨ New drops every Friday`,
      hashtags: [`#${input.company.replace(/\s/g, '')}`, '#EgyptianFashion', '#OOTD', '#NewCollection', '#CairoStyle', '#FashionReels', '#StyleGoals', '#ArabFashion'],
    },
  }

  return industryScripts[input.industry] ?? industryScripts['Real Estate']
}

function generateCaption(input: GenerationInput): Caption {
  const toneIntro: Record<string, string> = {
    'Professional': `${input.company} sets a new standard.`,
    'Energetic': `🚀 ${input.company} just changed the game.`,
    'Inspirational': `Some opportunities only come once. ${input.company} is one of them.`,
    'Educational': `Here's everything you need to know about ${input.company}:`,
    'Humorous': `Okay, we need to talk about ${input.company}. Because nobody else will.`,
    'Luxury': `For those who don't settle. ${input.company} — where excellence is standard.`,
  }
  const intro = toneIntro[input.tone] ?? toneIntro['Professional']

  return {
    main: `${intro}\n\n${input.description || `${input.company} is redefining ${input.industry.toLowerCase()} in Egypt.`}\n\n${input.goal === 'Attract Investors' ? `If you're looking for a high-ROI opportunity — this is it.` : input.goal === 'Sales' ? `Order now and see why ${input.audience || 'thousands'} trust us.` : `Follow us for more updates.`}\n\n${input.product ? `📌 ${input.product}` : ''}\n👇 DM us or visit the link in bio.`,
    short: `${input.company} — ${input.goal.toLowerCase()}. ${input.platform}-optimized content that converts. Link in bio 🔗`,
    hashtags: [
      `#${input.company.replace(/\s/g, '')}`,
      `#${input.industry.replace(/\s/g, '').replace('&', 'and')}`,
      '#Egypt',
      '#Cairo',
      '#ContentMarketing',
      `#${input.platform.replace(/\s/g, '')}`,
      input.goal === 'Attract Investors' ? '#Investment' : input.goal === 'Sales' ? '#ShopNow' : '#BrandAwareness',
      '#EgyptBusiness',
    ],
  }
}

function generateHooks(input: GenerationInput): Hook[] {
  const base = INDUSTRY_HOOKS[input.industry] ?? INDUSTRY_HOOKS['Real Estate']
  const types = ['Curiosity', 'Challenge', 'POV', 'Problem-Solution', 'Social Proof', 'Urgency', 'Question', 'Shock', 'Relatability', 'Authority']
  const explanations = [
    'Opens with mystery — forces the viewer to keep watching to get the answer.',
    'Challenges a common belief or behavior — creates instant engagement.',
    'Puts viewer in the scene — highly relatable and shareable.',
    'Identifies the pain, then positions your brand as the solution.',
    'Uses numbers or results to build immediate credibility.',
    'Creates FOMO — time-sensitive angle drives action.',
    'Direct question to viewer — triggers self-identification.',
    'Counterintuitive statement — disrupts the scroll.',
    'Reflects the viewer\'s daily reality — "that\'s so me" response.',
    'Positions brand/person as expert — trust-building opener.',
  ]

  return base.map((text, i) => ({
    text: text.replace(/\[COMPANY\]/g, input.company).replace(/\[PRODUCT\]/g, input.product || input.company),
    type: types[i % types.length],
    explanation: explanations[i % explanations.length],
  })).slice(0, 10)
}

function generateAngles(input: GenerationInput): CampaignAngle[] {
  const baseAngles: Record<string, CampaignAngle[]> = {
    'Real Estate': [
      {
        name: 'Investor Education',
        angle: 'Position the brand as the expert guide — teach the audience about ROI, market timing, and why New Capital is the next big thing.',
        why: 'Educated investors trust more and close faster. Content that teaches converts better than content that sells.',
        contentFormats: ['3-part "New Capital 101" series', 'ROI comparison reel', 'Market analysis breakdown', '"Questions answered" Q&A format'],
      },
      {
        name: 'Lifestyle Aspiration',
        angle: 'Show the lifestyle that comes with having the right business address. Focus on what success looks like in a [COMPANY] unit.',
        why: 'Investors buy emotionally first, then justify with logic. The aspiration gets them in — the numbers close them.',
        contentFormats: ['CEO morning routine in New Capital office', 'Business meeting walk-through', 'After-hours lifestyle reel', '"A day in the life" format'],
      },
      {
        name: 'Social Proof Machine',
        angle: 'Turn every happy investor or tenant into content. Real people, real returns, real spaces.',
        why: 'Word of mouth converted to content is the most trusted format in real estate.',
        contentFormats: ['Investor testimonial series', 'Before/after investment stories', '"Why I chose [COMPANY]" videos', 'Client milestone posts'],
      },
      {
        name: 'Urgency & Scarcity',
        angle: 'Show the real demand and limited availability. Make not buying feel like a bigger risk than buying.',
        why: 'Loss aversion is stronger than desire. Showing what people might lose creates faster decisions.',
        contentFormats: ['Unit count countdown', 'Sold-out notifications', '"Last chance" time-limited posts', 'Waitlist announcement'],
      },
      {
        name: 'Behind the Brand',
        angle: 'Show the team, the process, the quality control, and the vision behind [COMPANY]. Build the developer\'s credibility.',
        why: 'Trust is the #1 barrier in real estate. Transparency builds trust at scale.',
        contentFormats: ['Construction update reels', 'Team intro series', 'Quality walkthrough BTS', 'CEO/founder story'],
      },
    ],
    'Fashion': [
      {
        name: 'Cultural Identity',
        angle: 'Own the "Egyptian made" story. Position [COMPANY] as the brand that blends heritage with modern style.',
        why: 'Cultural pride content goes viral in Egypt. It builds community and brand loyalty simultaneously.',
        contentFormats: ['Heritage-inspired design stories', 'Egyptian materials + craftsmanship reels', '"Made in Egypt, worn everywhere" series'],
      },
    ],
  }

  const angles = (baseAngles[input.industry] ?? baseAngles['Real Estate']).map((a) => ({
    ...a,
    angle: a.angle.replace(/\[COMPANY\]/g, input.company),
  }))

  return angles
}

function generateCalendar(input: GenerationInput): { week: number; day: string; type: string; title: string; platform: string }[] {
  const platforms = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const contentTypes = ['Educational', 'Product/Service Showcase', 'Social Proof', 'Behind the Scenes', 'CTA/Sales', 'Entertainment', 'Community']
  const calItems: { week: number; day: string; type: string; title: string; platform: string }[] = []

  const titles: Record<string, string[]> = {
    'Real Estate': [
      'Project location overview reel', 'Investor FAQ — 5 questions answered',
      'Unit interior walkthrough', 'Market insights post', '"Why New Capital?" educational reel',
      'Client testimonial', 'Team introduction', 'Payment plan breakdown',
      'Behind the construction BTS', 'Lifestyle in the new project', '"Limited units" urgency post', 'CEO message',
    ],
    'Fashion': [
      'New drop announcement', 'Styling tips reel', 'Behind the design process',
      'Customer OOTD feature', 'Flash sale announcement', 'Lookbook preview', 'Brand story', 'Collection tutorial',
    ],
    'Food & Beverage': [
      'Signature dish close-up', 'Chef behind the scenes', 'Customer review highlight',
      'New menu item reveal', 'Morning prep ritual', 'Weekend special offer', 'Recipe teaser', 'Team introduction',
    ],
  }

  const baseTitles = titles[input.industry] ?? titles['Real Estate']

  for (let week = 1; week <= 4; week++) {
    const postsThisWeek = week === 1 ? 3 : 3
    for (let p = 0; p < postsThisWeek; p++) {
      const idx = (week - 1) * 3 + p
      calItems.push({
        week,
        day: platforms[(idx * 2) % 7],
        type: contentTypes[idx % contentTypes.length],
        title: (baseTitles[idx % baseTitles.length] || 'Content post').replace('[COMPANY]', input.company),
        platform: input.platform,
      })
    }
  }

  return calItems
}

// ─── UI Components ────────────────────────────────────────────────────────────

const SAMPLE_INPUT: GenerationInput = {
  company: 'Al Naseel',
  industry: 'Real Estate',
  description: 'A real estate developer in New Capital building administrative malls and commercial projects targeting business owners and investors.',
  audience: 'Investors and business owners',
  product: 'Commercial units in New Capital',
  goal: 'Attract Investors',
  platform: 'Instagram',
  tone: 'Professional',
  count: 5,
}

const TOOLS = [
  { id: 'ideas', label: 'Content Ideas', icon: Lightbulb, color: '#F59E0B', desc: 'Generate platform-specific reel ideas' },
  { id: 'script', label: 'Reel Script', icon: AlignLeft, color: '#8B5CF6', desc: 'Full timecoded video script + shot list' },
  { id: 'caption', label: 'Caption Builder', icon: Hash, color: '#3B82F6', desc: 'Platform-optimized captions + hashtags' },
  { id: 'hooks', label: 'Hook Generator', icon: Zap, color: '#EF4444', desc: '10 scroll-stopping openers with analysis' },
  { id: 'angles', label: 'Campaign Angles', icon: Target, color: '#10B981', desc: 'Strategic campaign directions' },
  { id: 'calendar', label: 'Content Calendar', icon: Calendar, color: '#06B6D4', desc: '30-day content plan' },
] as const

type ToolId = typeof TOOLS[number]['id']

const INDUSTRIES = ['Real Estate', 'Fashion', 'Food & Beverage', 'Technology', 'Fitness', 'Hospitality', 'E-Commerce', 'Healthcare', 'Education', 'Other']
const GOALS = ['Attract Investors', 'Brand Awareness', 'Lead Generation', 'Sales', 'Community Building', 'Product Launch', 'Employer Branding']
const PLATFORMS = ['Instagram', 'TikTok', 'YouTube Shorts', 'Facebook', 'LinkedIn']
const TONES = ['Professional', 'Energetic', 'Inspirational', 'Educational', 'Humorous', 'Luxury', 'Bold', 'Emotional']

export default function AIStudio() {
  const [activeTool, setActiveTool] = useState<ToolId>('ideas')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [input, setInput] = useState<GenerationInput>(SAMPLE_INPUT)

  // Generated outputs
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [script, setScript] = useState<ReelScript | null>(null)
  const [caption, setCaption] = useState<Caption | null>(null)
  const [hooks, setHooks] = useState<Hook[]>([])
  const [angles, setAngles] = useState<CampaignAngle[]>([])
  const [calendar, setCalendar] = useState<{ week: number; day: string; type: string; title: string; platform: string }[]>([])

  const updateInput = (k: keyof GenerationInput, v: string | number) =>
    setInput((prev) => ({ ...prev, [k]: v }))

  const handleGenerate = useCallback(() => {
    setLoading(true)
    setGenerated(false)
    setTimeout(() => {
      setIdeas(getIdeas(input))
      setScript(generateScript(input))
      setCaption(generateCaption(input))
      setHooks(generateHooks(input))
      setAngles(generateAngles(input))
      setCalendar(generateCalendar(input))
      setLoading(false)
      setGenerated(true)
    }, 1600)
  }, [input])

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => handleCopy(text, id)}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-all flex-shrink-0"
      style={{ background: copied === id ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)', color: copied === id ? '#34D399' : '#64748B' }}>
      {copied === id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied === id ? 'Copied!' : 'Copy'}
    </button>
  )

  const activeTool_ = TOOLS.find((t) => t.id === activeTool)!

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white">AI Studio</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-purple-400"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
              Beta
            </span>
          </div>
          <p className="text-slate-400 text-sm">Dynamic content generation trained for media production agencies. Fill the form, click Generate.</p>
        </div>
        <button
          onClick={() => { setInput(SAMPLE_INPUT); setGenerated(false) }}
          className="btn-secondary text-xs py-2 px-4">
          <Film className="w-3.5 h-3.5" /> Load Al Naseel Example
        </button>
      </div>

      <div className="grid xl:grid-cols-[320px_1fr] gap-6">

        {/* ─── Left: Input Form ─────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Tool selector */}
          <div className="glass-blue rounded-2xl p-4">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Choose Tool</p>
            <div className="space-y-1.5">
              {TOOLS.map(({ id, label, icon: Icon, color, desc }) => (
                <button key={id} onClick={() => setActiveTool(id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3"
                  style={{
                    background: activeTool === id ? `${color}12` : 'transparent',
                    border: `1px solid ${activeTool === id ? `${color}30` : 'transparent'}`,
                  }}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: activeTool === id ? color : '#475569' }} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold ${activeTool === id ? 'text-white' : 'text-slate-400'}`}>{label}</div>
                    <div className="text-[9px] text-slate-600 truncate">{desc}</div>
                  </div>
                  {activeTool === id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <div className="glass-blue rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Brand Details</p>

            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Company / Brand Name *</label>
              <input className="input text-xs py-2" placeholder="e.g. Al Naseel" value={input.company}
                onChange={(e) => updateInput('company', e.target.value)} />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Industry *</label>
              <select className="input text-xs py-2" value={input.industry} onChange={(e) => updateInput('industry', e.target.value)}>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Business Description</label>
              <textarea className="input text-xs py-2 resize-none" rows={2}
                placeholder="Briefly describe what the company does..."
                value={input.description} onChange={(e) => updateInput('description', e.target.value)} />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Target Audience</label>
              <input className="input text-xs py-2" placeholder="e.g. Investors and business owners"
                value={input.audience} onChange={(e) => updateInput('audience', e.target.value)} />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Product / Service</label>
              <input className="input text-xs py-2" placeholder="e.g. Commercial units in New Capital"
                value={input.product} onChange={(e) => updateInput('product', e.target.value)} />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-500 mb-1 block">Campaign Goal *</label>
              <select className="input text-xs py-2" value={input.goal} onChange={(e) => updateInput('goal', e.target.value)}>
                {GOALS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-slate-500 mb-1 block">Platform</label>
                <select className="input text-xs py-2" value={input.platform} onChange={(e) => updateInput('platform', e.target.value)}>
                  {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-500 mb-1 block">Tone</label>
                <select className="input text-xs py-2" value={input.tone} onChange={(e) => updateInput('tone', e.target.value)}>
                  {TONES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {activeTool === 'ideas' && (
              <div>
                <label className="text-[10px] font-medium text-slate-500 mb-1 block">Number of ideas: {input.count}</label>
                <input type="range" min={1} max={5} value={input.count}
                  onChange={(e) => updateInput('count', parseInt(e.target.value))}
                  className="w-full accent-blue-500" />
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !input.company}
              className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </div>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate {activeTool_?.label}</>
              )}
            </button>
          </div>
        </div>

        {/* ─── Right: Output Panel ──────────────────────────────────── */}
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">

            {/* Empty state */}
            {!loading && !generated && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-blue rounded-2xl flex flex-col items-center justify-center min-h-[500px] text-center p-12">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: `${activeTool_?.color}15` }}>
                  {activeTool_ && <activeTool_.icon className="w-8 h-8" style={{ color: activeTool_?.color }} />}
                </div>
                <h3 className="text-lg font-black text-white mb-2">{activeTool_?.label}</h3>
                <p className="text-slate-500 text-sm max-w-xs">{activeTool_?.desc}</p>
                <p className="text-slate-600 text-xs mt-4">Fill the form and click Generate — or load the Al Naseel example.</p>
              </motion.div>
            )}

            {/* Loading */}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-blue rounded-2xl flex flex-col items-center justify-center min-h-[500px]">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #8B5CF680, #3B82F680)' }}>
                    <Sparkles className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="absolute -inset-2 rounded-2xl animate-pulse"
                    style={{ background: 'rgba(139,92,246,0.1)', filter: 'blur(8px)' }} />
                </div>
                <p className="text-white font-bold text-base mb-2">Generating content for {input.company}…</p>
                <p className="text-slate-500 text-xs">Analyzing {input.industry} · {input.goal} · {input.platform}</p>
                <div className="flex gap-1 mt-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Content Ideas */}
            {generated && activeTool === 'ideas' && (
              <motion.div key="ideas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-white">{ideas.length} Content Ideas — {input.company} · {input.platform}</h2>
                  <button onClick={handleGenerate} className="btn-secondary text-xs py-1.5 px-3">
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </div>
                {ideas.map((idea, i) => (
                  <motion.div key={idea.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="glass-blue rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>{i + 1}</span>
                        <h3 className="text-sm font-bold text-white">{idea.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-md text-slate-400" style={{ background: 'rgba(255,255,255,0.05)' }}>{idea.format} · {idea.duration}</span>
                        <CopyBtn text={`${idea.title}\n\nHook: ${idea.hook}\n\nAngle: ${idea.angle}\n\nVisual: ${idea.visualDirection}\n\nCTA: ${idea.cta}`} id={`idea-${i}`} />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)' }}>
                        <p className="text-[9px] text-amber-600 uppercase tracking-wide mb-1">Hook</p>
                        <p className="text-slate-300 italic">"{idea.hook}"</p>
                      </div>
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)' }}>
                        <p className="text-[9px] text-blue-500 uppercase tracking-wide mb-1">Content Angle</p>
                        <p className="text-slate-300">{idea.angle}</p>
                      </div>
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.06)' }}>
                        <p className="text-[9px] text-purple-500 uppercase tracking-wide mb-1">Visual Direction</p>
                        <p className="text-slate-300">{idea.visualDirection}</p>
                      </div>
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)' }}>
                        <p className="text-[9px] text-green-600 uppercase tracking-wide mb-1">On-Screen Text</p>
                        <div className="space-y-0.5">
                          {idea.onScreenText.map((t) => <p key={t} className="text-slate-300">• {t}</p>)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-[10px] text-slate-500"><span className="text-slate-600">CTA:</span> {idea.cta}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Reel Script */}
            {generated && activeTool === 'script' && script && (
              <motion.div key="script" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-white">Script: {script.title}</h2>
                  <div className="flex gap-2">
                    <CopyBtn text={`${script.title}\n\nHOOK: ${script.hook}\n\n${script.scenes.map((s) => `[${s.time}]\nVisual: ${s.visual}\nVO: ${s.voiceover}\nText: ${s.text}`).join('\n\n')}\n\nCTA: ${script.cta}`} id="full-script" />
                    <button onClick={handleGenerate} className="btn-secondary text-xs py-1.5 px-3"><RefreshCw className="w-3 h-3" /></button>
                  </div>
                </div>

                <div className="glass-blue rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                      <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase tracking-wide">Opening Hook</p>
                      <p className="text-sm font-bold text-white italic">"{script.hook}"</p>
                    </div>
                    <CopyBtn text={script.hook} id="hook" />
                  </div>

                  <div className="space-y-3">
                    {script.scenes.map((scene, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                        className="flex gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.025)' }}>
                        <div className="w-16 flex-shrink-0">
                          <span className="text-[10px] font-bold text-blue-400 font-mono">[{scene.time}]</span>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex gap-1.5">
                            <span className="text-[9px] text-slate-600 uppercase font-medium w-12 flex-shrink-0">Visual</span>
                            <span className="text-xs text-slate-300">{scene.visual}</span>
                          </div>
                          <div className="flex gap-1.5">
                            <span className="text-[9px] text-slate-600 uppercase font-medium w-12 flex-shrink-0">VO</span>
                            <span className="text-xs text-slate-200 italic">"{scene.voiceover}"</span>
                          </div>
                          <div className="flex gap-1.5">
                            <span className="text-[9px] text-slate-600 uppercase font-medium w-12 flex-shrink-0">Text</span>
                            <span className="text-[10px] text-blue-300">{scene.text}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <p className="text-[10px] text-green-600 uppercase tracking-wide mb-1">CTA</p>
                    <p className="text-xs text-green-300">{script.cta}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="glass-blue rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-white">Shot List</p>
                      <CopyBtn text={script.shotList.join('\n')} id="shotlist" />
                    </div>
                    <div className="space-y-1.5">
                      {script.shotList.map((shot, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[9px] font-bold text-purple-400 mt-0.5">#{i + 1}</span>
                          <span className="text-xs text-slate-300">{shot}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-blue rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-white">Caption + Hashtags</p>
                      <CopyBtn text={`${script.caption}\n\n${script.hashtags.join(' ')}`} id="script-caption" />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line mb-3">{script.caption.slice(0, 200)}…</p>
                    <div className="flex flex-wrap gap-1">
                      {script.hashtags.map((h) => (
                        <span key={h} className="text-[9px] px-1.5 py-0.5 rounded-md text-blue-400"
                          style={{ background: 'rgba(59,130,246,0.1)' }}>{h}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Caption */}
            {generated && activeTool === 'caption' && caption && (
              <motion.div key="caption" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-white">Caption for {input.company} — {input.platform}</h2>
                  <button onClick={handleGenerate} className="btn-secondary text-xs py-1.5 px-3"><RefreshCw className="w-3 h-3" /></button>
                </div>

                <div className="glass-blue rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-white">Full Caption</p>
                    <CopyBtn text={caption.main} id="caption-main" />
                  </div>
                  <pre className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">{caption.main}</pre>
                </div>

                <div className="glass-blue rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-white">Short Version (Stories / TikTok)</p>
                    <CopyBtn text={caption.short} id="caption-short" />
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{caption.short}</p>
                </div>

                <div className="glass-blue rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-white">Hashtags</p>
                    <CopyBtn text={caption.hashtags.join(' ')} id="hashtags" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {caption.hashtags.map((h) => (
                      <span key={h} className="text-xs px-2.5 py-1 rounded-xl text-blue-400 cursor-pointer hover:bg-blue-500/20 transition-colors"
                        style={{ background: 'rgba(59,130,246,0.1)' }}>{h}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Hooks */}
            {generated && activeTool === 'hooks' && (
              <motion.div key="hooks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-white">10 Hooks — {input.company} · {input.industry}</h2>
                  <button onClick={handleGenerate} className="btn-secondary text-xs py-1.5 px-3"><RefreshCw className="w-3 h-3" /></button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  {hooks.map((hook, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="glass-blue rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-amber-400"
                            style={{ background: 'rgba(245,158,11,0.15)' }}>#{i + 1}</span>
                          <span className="text-[10px] text-slate-500">{hook.type}</span>
                        </div>
                        <CopyBtn text={hook.text} id={`hook-${i}`} />
                      </div>
                      <p className="text-sm font-semibold text-white mb-2">"{hook.text}"</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{hook.explanation}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Campaign Angles */}
            {generated && activeTool === 'angles' && (
              <motion.div key="angles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-white">Campaign Angles — {input.company} · {input.goal}</h2>
                  <button onClick={handleGenerate} className="btn-secondary text-xs py-1.5 px-3"><RefreshCw className="w-3 h-3" /></button>
                </div>
                {angles.map((angle, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="glass-blue rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black text-white"
                        style={{ background: 'linear-gradient(135deg, #10B981, #06B6D4)' }}>{i + 1}</span>
                      <h3 className="text-sm font-bold text-white">{angle.name}</h3>
                      <CopyBtn text={`${angle.name}\n\n${angle.angle}\n\nWhy it works: ${angle.why}\n\nContent formats:\n${angle.contentFormats.join('\n')}`} id={`angle-${i}`} />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">{angle.angle}</p>
                    <div className="p-3 rounded-xl mb-3" style={{ background: 'rgba(16,185,129,0.06)' }}>
                      <p className="text-[9px] text-green-600 uppercase tracking-wide mb-1">Why it works</p>
                      <p className="text-xs text-slate-400">{angle.why}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-600 uppercase tracking-wide mb-2">Content Formats</p>
                      <div className="flex flex-wrap gap-1.5">
                        {angle.contentFormats.map((f) => (
                          <span key={f} className="text-[10px] px-2 py-0.5 rounded-md text-slate-300"
                            style={{ background: 'rgba(255,255,255,0.05)' }}>• {f}</span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Content Calendar */}
            {generated && activeTool === 'calendar' && (
              <motion.div key="calendar" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-white">30-Day Content Calendar — {input.company} · {input.platform}</h2>
                  <button onClick={handleGenerate} className="btn-secondary text-xs py-1.5 px-3"><RefreshCw className="w-3 h-3" /></button>
                </div>
                {[1, 2, 3, 4].map((week) => {
                  const weekItems = calendar.filter((c) => c.week === week)
                  return (
                    <div key={week} className="glass-blue rounded-2xl p-4">
                      <p className="text-xs font-bold text-white mb-3">Week {week}</p>
                      <div className="space-y-2">
                        {weekItems.map((item, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                            className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <span className="text-[10px] font-bold text-blue-400 w-8 flex-shrink-0">{item.day}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md text-slate-500 flex-shrink-0"
                              style={{ background: 'rgba(255,255,255,0.05)' }}>{item.type}</span>
                            <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">{item.title}</span>
                            <span className="text-[9px] text-blue-400 flex-shrink-0">{item.platform}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
